"""Extend full-image eye inference to learned yaw AND pitch, without image warps.

The old hybrid renderer is used offline only. Shader 11 and its evidence stay
unchanged. This script generates the separate shader 12 and its own evidence.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw
import torch
from torch import nn

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCENE = ROOT / '03_raymarching'
WORK = HERE / 'work'
sys.path.insert(0, str(HERE.parent / 'full_eye'))
import train as base

SEED = 20260913
PITCH_CENTER = .46  # -5 degrees in the new [-28,22] degree domain.
base.WORK = WORK


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class FullGaze(base.FullEye):
    def __init__(self):
        super().__init__(96, 4)
        self.layers[0] = nn.Linear(7, 96)


def encode(xy, controls):
    c = np.broadcast_to(controls, (len(xy), 4))
    return np.column_stack((xy * .8, (c[:, 0] * 2 - 1) * .45,
                            (c[:, 1] * 2 - 1) * .2,
                            np.cos(2 * np.pi * c[:, 2]) * .15,
                            np.sin(2 * np.pi * c[:, 2]) * .15,
                            (c[:, 3] - PITCH_CENTER) * .55)).astype(np.float32)


def warm_model():
    model = FullGaze()
    checkpoint = torch.load(HERE.parent / 'full_eye/full_neural_eye.pt', map_location='cpu')
    weights = checkpoint['model']
    expanded = torch.zeros((96, 7))
    expanded[:, :6] = weights['layers.0.weight']
    weights['layers.0.weight'] = expanded
    model.load_state_dict(weights)
    return model


def capture():
    WORK.mkdir(exist_ok=True)
    base.prepare_teacher()
    teacher = WORK / 'teacher_source.txt'
    source = teacher.read_text()
    assert '32.0+44.0*captureControls.x,-5.0' in source
    teacher.write_text(source.replace('32.0+44.0*captureControls.x,-5.0',
                                      '32.0+44.0*captureControls.x,-28.0+50.0*captureControls.w'))
    rng = np.random.default_rng(SEED)
    train = np.column_stack([(rng.permutation(768) + rng.random(768)) / 768 for _ in range(4)]).astype(np.float32)
    for k in range(4):
        train[k*16:k*16+8, k] = 0
        train[k*16+8:k*16+16, k] = 1
    train[-128:, 3] = PITCH_CENTER
    val = np.random.default_rng(SEED+1).random((40, 4)).astype(np.float32)
    val[:8] = [[.1,.35,.56,.08],[.9,.35,.56,.92],[.1,.35,.56,.92],[.9,.35,.56,.08],
               [.5,.35,.56,0],[.5,.35,.56,1],[.5,.35,.56,.46],[.5,.8,.04,.46]]
    for kind, states in [('train', train), ('validation', val)]:
        states.tofile(WORK/f'{kind}_states.f32')
        subprocess.run([str(WORK/'capture'), str(WORK/'material_source.txt'), str(teacher),
                        str(WORK/f'{kind}_states.f32'), str(WORK/f'{kind}_rgba.f32'), '256', '256'], check=True)
    manifest = {'seed': SEED, 'resolution': 256, 'train_states': 768, 'validation_states': 40,
                'yaw_degrees': [32,76], 'pitch_degrees': [-28,22], 'pupil': [0,1], 'hue': [0,1],
                'screen_domain': [-1.4,1.4], 'old_pitch_rehearsal_states': 128,
                'teacher_files': {p.name: sha(p) for p in [SCENE/'09_controllable_neural_eye.frag',
                    SCENE/'10_neural_iris_material.frag', HERE.parent/'full_eye/capture.cpp', teacher]},
                'capture_hashes': {p.name: sha(p) for p in WORK.glob('*_*.f32')}}
    (WORK/'dataset.json').write_text(json.dumps(manifest, indent=2)+'\n')


def dataset():
    controls = np.fromfile(WORK/'train_states.f32', np.float32).reshape(-1,4)
    targets = np.memmap(WORK/'train_rgba.f32', np.float32, mode='r', shape=(len(controls),256*256,4))
    xy = base.grid(256)
    focus = np.flatnonzero((np.abs(xy[:,0])<1.04)&(np.abs(xy[:,1])<1.04))
    rng = np.random.default_rng(SEED+2)
    xs, ys, yns, offsets = [], [], [], []
    for k,c in enumerate(controls):
        rgb = np.asarray(targets[k,:,:3])
        iris = np.flatnonzero((rgb.max(1)-rgb.min(1)>.12)&(np.abs(xy[:,0])<1.08)&(np.abs(xy[:,1])<1.08))
        if not len(iris): iris = focus
        ids = np.concatenate((rng.integers(0,len(xy),2048),rng.choice(focus,2048),rng.choice(iris,2048)))
        direction = rng.integers(0,2,len(ids))
        adjacent = np.where(direction==0, np.minimum(ids//256+1,255)*256+ids%256,
                            (ids//256)*256+np.minimum(ids%256+1,255))
        xs.append(encode(xy[ids],c));ys.append(rgb[ids]);yns.append(rgb[adjacent]);offsets.append((xy[adjacent]-xy[ids])*.8)
    return tuple(torch.from_numpy(np.concatenate(items)) for items in (xs,ys,yns,offsets))


@torch.no_grad()
def evaluate(model, name, kind='validation'):
    controls=np.fromfile(WORK/f'{kind}_states.f32',np.float32).reshape(-1,4)
    targets=np.memmap(WORK/f'{kind}_rgba.f32',np.float32,mode='r',shape=(len(controls),256*256,4))
    xy=base.grid(256);eye=(np.abs(xy[:,0])<1.04)&(np.abs(xy[:,1])<1.04)
    rows=[];images=[]
    for k,c in enumerate(controls):
        target=np.asarray(targets[k,:,:3]);prediction=base.predict(model,encode(xy,c))
        error=((prediction-target)**2).mean(1)
        iris=(target.max(1)-target.min(1)>.12)&eye
        rows.append({'controls':c.tolist(),'psnr':-10*math.log10(max(float(error.mean()),1e-12)),
                     'eye_psnr':-10*math.log10(max(float(error[eye].mean()),1e-12)),
                     'iris_mse':float(error[iris].mean()) if iris.any() else None})
        if k<8: images.append((target,prediction))
    result={'states':rows,'mean_psnr':float(np.mean([r['psnr'] for r in rows])),
            'mean_eye_psnr':float(np.mean([r['eye_psnr'] for r in rows])),
            'worst_eye_psnr':min(r['eye_psnr'] for r in rows),
            'scope':f'{len(controls)} {kind} states excluded from training loss; 256x256 display RGB, eye box ±1.04.'}
    sheet=Image.new('RGB',(1024,1120),'#11191d');draw=ImageDraw.Draw(sheet)
    for k,pair in enumerate(images):
        x=(k%2)*512;y=(k//2)*280
        for j,pixels in enumerate(pair):
            sheet.paste(Image.fromarray(np.uint8(np.clip(pixels.reshape(256,256,3)[::-1],0,1)*255+.5)),(x+j*256,y+24))
        draw.text((x+5,y+5),f'{k}: teacher / full neural | yaw {32+44*controls[k,0]:.0f}, pitch {-28+50*controls[k,3]:.0f}',fill='white')
    sheet.save(WORK/f'{name}_{kind}.png')
    (WORK/f'{name}_{kind}.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='states'}),flush=True)
    return result


def train(args):
    torch.set_num_threads(4);torch.manual_seed(SEED)
    model=warm_model();history=[]
    if args.resume:
        previous=torch.load(WORK/f'{args.resume}.pt',map_location='cpu')
        model.load_state_dict(previous['model']);history=previous['history']
    x,y,yn,delta=dataset()
    optimizer=torch.optim.Adam(model.parameters(),lr=args.lr)
    gen=torch.Generator().manual_seed(SEED+3)
    started=time.monotonic();trace=[]
    print(f'{len(x)} training pairs, {sum(p.numel() for p in model.parameters())} parameters',flush=True)
    for step in range(args.steps):
        ids=torch.randint(len(x),(2048,),generator=gen)
        inputs=x[ids];neighbors=inputs.clone();neighbors[:,:2]+=delta[ids]
        prediction=model(torch.cat((inputs,neighbors)))
        p,pn=prediction[:2048],prediction[2048:]
        bg=((inputs[:,0].abs()>.832)|(inputs[:,1].abs()>.832))&(y[ids].max(1).values<.36)
        white=(y[ids].min(1).values>.65)&((y[ids].max(1).values-y[ids].min(1).values)<.16)
        weights=1+7*bg.float()+3*white.float()
        rgb=(.5*((p-y[ids]).square().mean(1)+(pn-yn[ids]).square().mean(1))*weights).mean()
        gradient=((pn-p)-(yn[ids]-y[ids])).square().mean(1)
        gradient=(gradient*(1+15*bg.float()+7*white.float())).mean()
        loss=rgb+.25*gradient
        optimizer.zero_grad(set_to_none=True);loss.backward();optimizer.step()
        lr=args.lr*(args.end_lr/args.lr)**((step+1)/args.steps)
        for group in optimizer.param_groups:group['lr']=lr
        if step==0 or (step+1)%1000==0:
            item={'step':step+1,'loss':float(loss),'seconds':time.monotonic()-started,'lr':lr};trace.append(item);print(json.dumps(item),flush=True)
        if (step+1)%10000==0 or step+1==args.steps:
            stage={'steps':step+1,'arguments':vars(args),'trace':trace}
            torch.save({'model':model.state_dict(),'history':history+[stage],'warm_start_sha256':sha(HERE.parent/'full_eye/full_neural_eye.pt')},WORK/f'{args.name}.pt')
            evaluate(model,args.name)


def capture_test():
    """Fresh test controls, generated only after choosing the final checkpoint."""
    manifest=json.loads((WORK/'dataset.json').read_text())
    assert sha(WORK/'teacher_source.txt')==manifest['teacher_files']['teacher_source.txt']
    rng=np.random.default_rng(SEED+90)
    states=rng.random((64,4)).astype(np.float32)
    # Separate controls near the broad automatic fixation family, including
    # intermediate poses, rather than reusing the validation selection states.
    targets=np.array([[.08,.16],[.92,.84],[.12,.84],[.12,.12],[.88,.72],[.82,.20],[.18,.76],[.48,.46]])
    previous=np.roll(targets,1,axis=0)
    for i in range(32):
        k=i//4;blend=[0.,.25,.75,1.][i%4]
        pose=previous[k]*(1-blend)+targets[k]*blend
        states[32+i]=[pose[0],.4+.12*math.sin(i*.2+.8),.56,pose[1]]
    states.tofile(WORK/'test_states.f32')
    subprocess.run([str(WORK/'capture'),str(WORK/'material_source.txt'),str(WORK/'teacher_source.txt'),
                    str(WORK/'test_states.f32'),str(WORK/'test_rgba.f32'),'256','256'],check=True)
    (WORK/'test_manifest.json').write_text(json.dumps({'seed':SEED+90,'random_states':32,'gaze_family_states':32,
        'states_sha256':sha(WORK/'test_states.f32'),'targets_sha256':sha(WORK/'test_rgba.f32')},indent=2)+'\n')


def deliver(name):
    torch.set_num_threads(4)
    checkpoint=torch.load(WORK/f'{name}.pt',map_location='cpu');model=FullGaze();model.load_state_dict(checkpoint['model'])
    result=evaluate(model,name)
    test=evaluate(model,name,'test')
    base.export(model,name)
    network=(WORK/f'{name}_network.txt').read_text().replace('vec3 controls)', 'vec4 controls)').replace(
        'sin(6.28318530718*controls.z)*.15,0,0)', 'sin(6.28318530718*controls.z)*.15,(controls.w-.46)*.55,0)')
    shader=(HERE/'shader_template.txt').read_text().replace('__NETWORK__',network)
    (SCENE/'12_full_neural_saccadic_eye.frag').write_text(shader)
    shutil.copyfile(WORK/f'{name}.pt',HERE/'full_neural_saccadic_eye.pt')
    shutil.copyfile(WORK/f'{name}_validation.png',SCENE/'full_neural_saccadic_eye_comparison.png')
    rng=np.random.default_rng(SEED+4);xy=rng.uniform(-1.3,1.3,(128,2)).astype(np.float32);c=rng.random((128,4)).astype(np.float32)
    fixture={'xy':xy.tolist(),'controls':c.tolist(),'rgb':base.predict(model,encode(xy,c)).tolist()}
    (SCENE/'full_neural_saccadic_eye_parity.json').write_text(json.dumps(fixture,separators=(',',':'))+'\n')
    metadata={'representation':'Full-image neural RGB with learned horizontal AND vertical gaze; no image warp or procedural RGB.',
              'architecture':[7,96,96,96,96,3],'parameter_count':sum(p.numel() for p in model.parameters()),
              'activation':'sin(24*affine); linear RGB head clamped to [0,1]',
              'controls':['yaw normalized','pupil','hue','pitch normalized'],
              'inputs':['x*.8','y*.8','(yaw*2-1)*.45','(pupil*2-1)*.2','cos(2*pi*hue)*.15','sin(2*pi*hue)*.15','(pitch-.46)*.55'],
              'yaw_degrees':[32,76],'pitch_degrees':[-28,22],'training':checkpoint['history'],
              'new_training_steps':sum(s['steps'] for s in checkpoint['history']),
              'warm_start_sha256':checkpoint['warm_start_sha256'],'dataset':json.loads((WORK/'dataset.json').read_text()),
              'independent_test':{'manifest':json.loads((WORK/'test_manifest.json').read_text()),'metrics':test},
              'sampling':'6144 pairs/state: 1/3 uniform, 1/3 eye box, 1/3 teacher chroma region; adjacent-pixel supervision.',
              'loss':'Paired display RGB MSE, background weight 8/sclera 4, plus .25*neighbor-difference MSE with background weight 16/sclera 8.',
              'training_runtime':{'torch':torch.__version__,'device':'CPU','threads':4,'batch_pairs':2048},
              'holdout':result,'shader_sha256':sha(SCENE/'12_full_neural_saccadic_eye.frag'),
              'checkpoint_sha256':sha(HERE/'full_neural_saccadic_eye.pt'),
              'training_source_sha256':sha(__file__),'template_sha256':sha(HERE/'shader_template.txt'),
              'base_source_sha256':sha(HERE.parent/'full_eye/train.py'),
              'parity_sha256':sha(SCENE/'full_neural_saccadic_eye_parity.json'),
              'comparison_sha256':sha(SCENE/'full_neural_saccadic_eye_comparison.png'),
              'limits':['Bounded image function, not arbitrary-camera neural geometry.','Fine detail and unseen control combinations remain approximate.','New 2-axis model has not inherited the old model quality/performance claims.']}
    (SCENE/'full_neural_saccadic_eye_model.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print('Exported separate two-axis neural eye shader.',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['capture','train','capture-test','deliver'])
    parser.add_argument('--name',default='gaze');parser.add_argument('--resume')
    parser.add_argument('--steps',type=int,default=40000);parser.add_argument('--lr',type=float,default=8e-5)
    parser.add_argument('--end-lr',type=float,default=5e-6);args=parser.parse_args()
    if args.mode=='capture':capture()
    elif args.mode=='train':train(args)
    elif args.mode=='capture-test':capture_test()
    else:deliver(args.name)
