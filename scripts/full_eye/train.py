"""Train a full-image conditional SIREN; the old renderer is an OFFLINE teacher only.

No ray intersections, materials, masks, normals or lighting enter the student.
Its six inputs are screen x/y, yaw, pupil, cos(hue), sin(hue); its output is RGB.
Dependencies: Python 3.9+, numpy, Pillow, torch. Capture additionally uses macOS
OpenGL and clang++. Work files are ignored; the exported weights are standalone.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import shutil
import platform
import time
import numpy as np
from PIL import Image, ImageDraw
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SCENE = ROOT / '03_raymarching'
WORK = HERE / 'work'
SEED = 20260912
EXTENT = 1.4
OMEGA = 24.0
WIDTH = 96
DEPTH = 4


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_teacher():
    WORK.mkdir(exist_ok=True)
    material = (SCENE / '10_neural_iris_material.frag').read_text()
    material = material[material.index('vec3 neuralEye('):material.index('void mainImage(')]
    (WORK / 'material_source.txt').write_text('#version 330 core\nuniform float captureHue;out vec4 fragColor;\n' + material + '''
void main(){vec2 uv=(gl_FragCoord.xy-vec2(0,1))/vec2(512,256);fragColor=vec4(decodePigment(uv,captureHue),1);}
''')
    teacher = (SCENE / '09_controllable_neural_eye.frag').read_text()
    teacher = teacher[teacher.index('vec2 u_resolution'):teacher.index('vec3 controlOverlay(')]
    # Desktop GLSL reserves noise3; GLES does not provide that legacy overload.
    teacher = teacher.replace('noise3(', 'teacherNoise3(')
    (WORK / 'teacher_source.txt').write_text('''#version 330 core
uniform sampler2D iChannel0;uniform vec3 iResolution;uniform vec4 captureControls;out vec4 fragColor;
''' + teacher + '''
void main(){
  u_pose=radians(vec2(32.0+44.0*captureControls.x,-5.0));
  u_pupil=captureControls.y;u_time=0.;u_view=0;u_refraction=1;
  vec2 xy=(2.*gl_FragCoord.xy/iResolution.xy-1.)*1.4;
  vec2 uv=xy*.49;
  vec3 camera=vec3(0,.48,4.6),target=vec3(0,-.04,0);
  vec3 forward=normalize(target-camera),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
  vec3 ray=normalize(forward*1.75+right*uv.x+up*uv.y);
  fragColor=vec4(displayColor(scene(camera,ray)),1);
}
''')
    subprocess.run(['clang++', '-std=c++17', '-O2', str(HERE/'capture.cpp'), '-framework', 'OpenGL', '-o', str(WORK/'capture')], check=True)


def capture(count, resolution):
    prepare_teacher()
    rng = np.random.default_rng(SEED)
    # Stratified continuous conditions; validation uses independent off-grid states.
    states = np.zeros((count, 4), np.float32)
    for k in range(3):
        states[:, k] = (rng.permutation(count) + rng.random(count)) / count
    # Include domain faces so controls do not extrapolate at their endpoints.
    for k in range(3):
        states[k*16:k*16+8, k] = 0
        states[k*16+8:k*16+16, k] = 1
    states.tofile(WORK/'train_states.f32')
    # Fixed, independent states with varied pose, pupil and hue, plus loop states.
    val = np.zeros((20,4),np.float32)
    val[:,:3] = np.random.default_rng(SEED+1).random((20,3))
    val[:8,:3] = [[.365,.35,.56],[.05,.35,.56],[.95,.35,.56],[.365,.05,.56],
                   [.365,.95,.56],[.365,.35,.04],[.365,.35,.31],[.365,.35,.81]]
    val.tofile(WORK/'validation_states.f32')
    for kind in ['train','validation']:
        subprocess.run([str(WORK/'capture'),str(WORK/'material_source.txt'),str(WORK/'teacher_source.txt'),
                        str(WORK/f'{kind}_states.f32'),str(WORK/f'{kind}_rgba.f32'),str(resolution),str(resolution)],check=True)
    manifest = {'seed':SEED,'train_states':count,'validation_states':len(val),'resolution':resolution,
                'extent':EXTENT,'yaw_degrees':[32,76],'pitch_degrees':-5,'pupil':[0,1],'hue':[0,1],
                'teacher_files':{p.name:sha(p) for p in [SCENE/'09_controllable_neural_eye.frag',SCENE/'10_neural_iris_material.frag']},
                'capture_files':{p.name:sha(p) for p in [HERE/'capture.cpp',WORK/'teacher_source.txt',WORK/'material_source.txt']}}
    (WORK/'dataset.json').write_text(json.dumps(manifest,indent=2)+'\n')


def encode(xy, controls):
    controls=np.broadcast_to(controls,(len(xy),4))
    return np.column_stack((xy*.8,(controls[:,0]*2-1)*.45,(controls[:,1]*2-1)*.2,
                            np.cos(2*np.pi*controls[:,2])*.15,np.sin(2*np.pi*controls[:,2])*.15)).astype(np.float32)


class FullEye(nn.Module):
    def __init__(self,width=WIDTH,depth=DEPTH):
        super().__init__()
        sizes=[6]+[width]*depth+[3]
        self.layers=nn.ModuleList(nn.Linear(a,b) for a,b in zip(sizes,sizes[1:]))
        with torch.no_grad():
            for i,layer in enumerate(self.layers):
                bound=1/layer.in_features if i==0 else math.sqrt(6/layer.in_features)/OMEGA
                layer.weight.uniform_(-bound,bound);layer.bias.uniform_(-bound,bound)
            # RGB is learned in display space. A linear head has better dark
            # boundary gradients than a saturating sigmoid; only clamp at output.
            self.layers[-1].bias.fill_(.35)
    def forward(self,x):
        for layer in self.layers[:-1]: x=torch.sin(OMEGA*layer(x))
        return self.layers[-1](x)


def grid(res,extent=EXTENT):
    axis=(2*(np.arange(res,dtype=np.float32)+.5)/res-1)*extent
    xx,yy=np.meshgrid(axis,axis)
    return np.column_stack((xx.ravel(),yy.ravel()))


def dataset(samples_per_state=8192):
    manifest=json.loads((WORK/'dataset.json').read_text());res=manifest['resolution']
    controls=np.fromfile(WORK/'train_states.f32',np.float32).reshape(-1,4)
    images=np.memmap(WORK/'train_rgba.f32',np.float32,mode='r',shape=(len(controls),res*res,4))
    xy=grid(res);rng=np.random.default_rng(SEED+2)
    # Half globally uniform; half concentrated on the eye and corneal highlights.
    focus=np.flatnonzero((np.abs(xy[:,0])<1.02)&(np.abs(xy[:,1])<.94))
    xs=[];ys=[]
    for k,c in enumerate(controls):
        ids=np.concatenate((rng.integers(0,len(xy),samples_per_state//2),rng.choice(focus,samples_per_state//2)))
        xs.append(encode(xy[ids],c));ys.append(np.asarray(images[k,ids,:3]))
    return torch.from_numpy(np.concatenate(xs)),torch.from_numpy(np.concatenate(ys))


@torch.no_grad()
def predict(model,x):
    return np.concatenate([model(torch.from_numpy(x[i:i+16384])).clamp(0,1).numpy() for i in range(0,len(x),16384)])


def evaluate(model,label):
    manifest=json.loads((WORK/'dataset.json').read_text());res=manifest['resolution']
    controls=np.fromfile(WORK/'validation_states.f32',np.float32).reshape(-1,4)
    targets=np.memmap(WORK/'validation_rgba.f32',np.float32,mode='r',shape=(len(controls),res*res,4))
    xy=grid(res);eye=(np.abs(xy[:,0])<1.03)&(np.abs(xy[:,1])<.94)
    records=[];predictions=[]
    for k,c in enumerate(controls):
        pred=predict(model,encode(xy,c));target=targets[k,:,:3]
        mse=float(np.mean((pred-target)**2));emse=float(np.mean((pred[eye]-target[eye])**2))
        records.append({'controls':c[:3].tolist(),'psnr':-10*math.log10(max(mse,1e-12)),
                        'eye_box_psnr':-10*math.log10(max(emse,1e-12)),'mae':float(np.abs(pred-target).mean())})
        predictions.append(pred)
    metrics={'states':records,'mean_psnr':float(np.mean([r['psnr'] for r in records])),
             'mean_eye_box_psnr':float(np.mean([r['eye_box_psnr'] for r in records])),
             'worst_eye_box_psnr':min(r['eye_box_psnr'] for r in records)}
    # Unretouched raw model output beside the offline teacher, flipped to display orientation.
    sheet=Image.new('RGB',(res*4,res*4+24*4),'#11191d');draw=ImageDraw.Draw(sheet)
    for k in range(8):
        col=(k%2)*res*2;row=(k//2)*(res+24)
        for j,values in enumerate([targets[k,:,:3],predictions[k]]):
            im=Image.fromarray(np.uint8(np.clip(values.reshape(res,res,3)[::-1],0,1)*255+.5))
            sheet.paste(im,(col+j*res,row+24))
        draw.text((col+5,row+5),f'{k}: teacher / full neural RGB',fill='white')
    sheet.save(WORK/f'{label}_comparison.png')
    (WORK/f'{label}_metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print(json.dumps({k:v for k,v in metrics.items() if k!='states'}),flush=True)
    # Pixel-level fixtures compare the exact exported GLSL against PyTorch.
    rng=np.random.default_rng(SEED+3);xyf=rng.uniform(-1.3,1.3,(128,2)).astype(np.float32)
    cf=np.zeros((128,4),np.float32);cf[:,:3]=rng.random((128,3))
    (WORK/'parity.json').write_text(json.dumps({'xy':xyf.tolist(),'controls':cf[:,:3].tolist(),
        'rgb':predict(model,encode(xyf,cf)).tolist()},separators=(',',':'))+'\n')
    return metrics


def train(args):
    torch.set_num_threads(args.threads);torch.manual_seed(SEED)
    model=FullEye(args.width,args.depth)
    if args.resume: model.load_state_dict(torch.load(args.resume,map_location='cpu')['model'])
    x,y=dataset(args.samples_per_state)
    optimizer=torch.optim.Adam(model.parameters(),lr=args.lr)
    rng=torch.Generator().manual_seed(SEED+4)
    start=time.monotonic();trace=[]
    print(f'Training {sum(p.numel() for p in model.parameters())} parameters on {len(x)} samples; {args.threads} CPU threads',flush=True)
    for step in range(args.steps):
        ids=torch.randint(len(x),(args.batch,),generator=rng);pred=model(x[ids]);target=y[ids]
        # Full display-space RGB; modest contrast weighting preserves pupil edges
        # and reflections without supplying geometry, normals or masks as inputs.
        weight=1+.7*(target.max(dim=1).values-target.min(dim=1).values)
        loss=((pred-target).square().mean(dim=1)*weight).mean()
        optimizer.zero_grad(set_to_none=True);loss.backward();optimizer.step()
        lr=args.lr*(args.end_lr/args.lr)**((step+1)/args.steps)
        for group in optimizer.param_groups:group['lr']=lr
        if step==0 or (step+1)%500==0:
            record={'step':step+1,'loss':float(loss),'seconds':time.monotonic()-start,'lr':lr};trace.append(record)
            print(json.dumps(record),flush=True)
        if (step+1)%args.checkpoint_every==0 or step+1==args.steps:
            checkpoint={'model':model.state_dict(),'width':args.width,'depth':args.depth,'omega':OMEGA,'steps':step+1,
                        'seed':SEED,'trace':trace,'arguments':vars(args),'dataset':json.loads((WORK/'dataset.json').read_text())}
            torch.save(checkpoint,WORK/f'{args.name}.pt')
            evaluate(model,args.name)
            export(model,args.name)


def number(value):
    text=f'{float(value):.8g}'
    if '.' not in text and 'e' not in text:text+='.'
    return text


def export(model,label):
    # Scalar output / vec4 dot arithmetic avoids large mat4 compiler expansions.
    # These are explicit trained weights, not lookups or hidden image textures.
    lines=['// BEGIN TRAINED FULL-IMAGE NETWORK',
           'vec3 neuralFullEye(vec2 p,vec3 controls) {',
           '  vec4 x0=vec4(p*.8,(controls.x*2.-1.)*.45,(controls.y*2.-1.)*.2);',
           '  vec4 x1=vec4(cos(6.28318530718*controls.z)*.15,sin(6.28318530718*controls.z)*.15,0,0);']
    previous=['x0','x1']
    for index,layer in enumerate(model.layers):
        weight=layer.weight.detach().numpy();bias=layer.bias.detach().numpy()
        hidden=index<len(model.layers)-1
        if hidden: weight=weight*OMEGA;bias=bias*OMEGA
        names=[]
        for row in range(len(bias)):
            terms=[]
            for col in range(0,weight.shape[1],4):
                values=np.pad(weight[row,col:col+4],(0,max(0,col+4-weight.shape[1])))
                terms.append(f'dot({previous[col//4]},vec4('+','.join(number(v) for v in values)+'))')
            expr=number(bias[row])+'+'+'+'.join(terms)
            if hidden:expr='sin('+expr+')'
            name=f'n{index}_{row}';names.append(name);lines.append(f'  float {name}={expr};')
        if hidden:
            previous=[]
            for row in range(0,len(names),4):
                name=f'v{index}_{row//4}';previous.append(name)
                lines.append(f'  vec4 {name}=vec4('+','.join(names[row:row+4])+');')
        else:lines.append('  return clamp(vec3('+','.join(names)+'),0.,1.);')
    lines+=['}','// END TRAINED FULL-IMAGE NETWORK']
    (WORK/f'{label}_network.txt').write_text('\n'.join(lines)+'\n')


def deliver(label):
    torch.set_num_threads(4)
    checkpoint=torch.load(WORK/f'{label}.pt',map_location='cpu')
    model=FullEye(checkpoint['width'],checkpoint['depth']);model.load_state_dict(checkpoint['model'])
    metrics=evaluate(model,label);export(model,label)
    network=(WORK/f'{label}_network.txt').read_text()
    shader=(HERE/'shader_template.txt').read_text().replace('__NETWORK__',network)
    (SCENE/'11_full_neural_eye.frag').write_text(shader)
    shutil.copyfile(WORK/f'{label}_comparison.png',SCENE/'full_neural_eye_comparison.png')
    shutil.copyfile(WORK/'parity.json',SCENE/'full_neural_eye_parity.json')
    shutil.copyfile(WORK/f'{label}.pt',HERE/'full_neural_eye.pt')
    stages=[]
    def history(item):
        resume=item['arguments'].get('resume')
        if 'previous_stages' in item:
            stages.extend(item['previous_stages'])
        elif resume:
            path=Path(resume)
            if not path.is_absolute():path=ROOT/path
            if path.is_file():history(torch.load(path,map_location='cpu'))
            else:raise FileNotFoundError(f'Missing training provenance checkpoint: {path}')
        stages.append({k:item[k] for k in ['steps','trace','arguments']})
    history(checkpoint)
    metadata={
        'representation':'Full-image conditional SIREN: screen coordinates and controls directly to display RGB',
        'architecture':[6]+[checkpoint['width']]*checkpoint['depth']+[3],
        'parameter_count':sum(p.numel() for p in model.parameters()),'hidden_activation':f'sin({OMEGA} * affine)',
        'output_activation':'linear then clamp(0,1)','seed':SEED,
        'inputs':['screen_x * .8','screen_y * .8','(yaw_normalized*2-1)*.45',
                  '(pupil*2-1)*.2','cos(2*pi*hue)*.15','sin(2*pi*hue)*.15'],
        'training':{'total_steps':sum(stage['steps'] for stage in stages),'stages':stages,'dataset':checkpoint['dataset'],
                    'samples_per_stage':checkpoint['dataset']['train_states']*checkpoint['arguments']['samples_per_state'],
                    'loss':'Display RGB MSE weighted per sample by 1 + .7*(target max channel - target min channel)',
                    'torch':torch.__version__,'numpy':np.__version__,'platform':platform.platform(),'device':'CPU'},
        'holdout':metrics,'holdout_scope':'20 independent continuous control states. Display-space PSNR. Eye box is x ±1.03, y ±.94.',
        'runtime':'Every pixel calls neuralFullEye every frame. No textures, image feedback, analytic eye geometry, masks, shading or procedural detail.',
        'limits':['Yaw 32–76 degrees; fixed pitch -5 degrees; not arbitrary-camera 3D.',
                  'Pupil and hue trained in [0,1]. Screen domain [-1.4,1.4]^2; edge inputs clamped on wide/tall viewports.',
                  'Learned approximation can lose fine iris detail and soften silhouettes/reflections.',
                  'Offline teacher uses the original hybrid shader, but no teacher code or neural pigment pass executes in deployment.'],
        'shader_sha256':sha(SCENE/'11_full_neural_eye.frag'),
        'checkpoint_sha256':sha(HERE/'full_neural_eye.pt'),
        'parity_fixture_sha256':sha(SCENE/'full_neural_eye_parity.json'),
        'comparison_sha256':sha(SCENE/'full_neural_eye_comparison.png'),
        'training_source_sha256':sha(HERE/'train.py'),
        'training_data_sha256':{name:sha(WORK/name) for name in ['train_states.f32','validation_states.f32','train_rgba.f32','validation_rgba.f32']},
    }
    (SCENE/'full_neural_eye_model.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print('Exported full-image Shadertoy shader and reproducible model evidence.',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['capture','train','evaluate','deliver'])
    parser.add_argument('--states',type=int,default=384);parser.add_argument('--resolution',type=int,default=256)
    parser.add_argument('--steps',type=int,default=10000);parser.add_argument('--batch',type=int,default=2048)
    parser.add_argument('--threads',type=int,default=4);parser.add_argument('--width',type=int,default=WIDTH)
    parser.add_argument('--depth',type=int,default=DEPTH);parser.add_argument('--lr',type=float,default=3e-4)
    parser.add_argument('--end-lr',type=float,default=3e-5);parser.add_argument('--resume')
    parser.add_argument('--samples-per-state',type=int,default=8192);parser.add_argument('--name',default='full_eye')
    parser.add_argument('--checkpoint-every',type=int,default=5000)
    args=parser.parse_args()
    if args.mode=='capture':capture(args.states,args.resolution)
    elif args.mode=='train':train(args)
    elif args.mode=='deliver':deliver(args.name)
    else:
        torch.set_num_threads(args.threads);checkpoint=torch.load(WORK/f'{args.name}.pt',map_location='cpu')
        model=FullEye(checkpoint['width'],checkpoint['depth']);model.load_state_dict(checkpoint['model'])
        evaluate(model,args.name);export(model,args.name)
