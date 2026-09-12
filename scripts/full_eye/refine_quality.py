"""Quality-only weight refinement; the deployed network graph stays identical.

No filtering, extra inference, resolution changes or procedural RGB at runtime.
Use the existing offline teacher captures. Region/gradient information affects
training sampling/loss only and never becomes a student input.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import time
import numpy as np
from PIL import Image, ImageDraw
import torch
import train as base

WORK=base.WORK
BASELINE=WORK/'quality_baseline.pt'
SEED=20260913


def load(path):
    checkpoint=torch.load(path,map_location='cpu')
    model=base.FullEye(checkpoint['width'],checkpoint['depth'])
    model.load_state_dict(checkpoint['model'])
    return model,checkpoint


def weights_sha(model):
    digest=hashlib.sha256()
    for name,value in model.state_dict().items():
        digest.update(name.encode());digest.update(np.asarray(value.shape,dtype='<i4').tobytes())
        digest.update(value.detach().numpy().astype('<f4').tobytes())
    return digest.hexdigest()


def snapshot():
    WORK.mkdir(exist_ok=True)
    # Reproducing after this upgrade must still start from the original version.
    for relative,dst in [('scripts/full_eye/full_neural_eye.pt',BASELINE),
                         ('03_raymarching/11_full_neural_eye.frag',WORK/'quality_baseline_shader.txt'),
                         ('03_raymarching/11_full_neural_eye.frag',base.SCENE/'full_neural_eye_baseline.txt'),
                         ('03_raymarching/full_neural_eye_model.json',WORK/'quality_baseline_model.json')]:
        if not dst.exists():dst.write_bytes(subprocess.check_output(['git','show','b8ae3dc:'+relative],cwd=base.ROOT))


def history(path):
    path=Path(path)
    if not path.is_absolute():path=base.ROOT/path
    if path.resolve()==BASELINE.resolve():return json.loads((WORK/'quality_baseline_model.json').read_text())['training']['stages']
    item=torch.load(path,map_location='cpu')
    previous=item.get('previous_stages')
    if previous is None:previous=history(item['arguments']['resume'])
    return previous+[{k:item[k] for k in ['steps','trace','arguments']}]


def regions(image,xy):
    chroma=image.max(axis=-1)-image.min(axis=-1)
    # Broad teacher-derived color region includes iris but excludes most sclera.
    iris=(chroma>.12)&(xy[:,0]>.03)&(xy[:,0]<1.05)&(np.abs(xy[:,1])<.65)
    res=round(math.sqrt(len(xy)));rgb=image.reshape(res,res,3)
    gx=np.max(np.abs(np.roll(rgb,-1,axis=1)-rgb),axis=-1)
    gy=np.max(np.abs(np.roll(rgb,-1,axis=0)-rgb),axis=-1)
    gradient=np.maximum(gx,gy).ravel()
    edges=gradient>.025
    return iris,edges,gradient


def dataset(samples=8192):
    manifest=json.loads((WORK/'dataset.json').read_text());res=manifest['resolution']
    controls=np.fromfile(WORK/'train_states.f32',np.float32).reshape(-1,4)
    images=np.memmap(WORK/'train_rgba.f32',np.float32,mode='r',shape=(len(controls),res*res,4))
    xy=base.grid(res);rng=np.random.default_rng(SEED)
    eye=np.flatnonzero((np.abs(xy[:,0])<1.03)&(np.abs(xy[:,1])<.94))
    xs=[];ys=[];yns=[];deltas=[]
    for k,c in enumerate(controls):
        rgb=np.asarray(images[k,:,:3]);iris,edges,_=regions(rgb,xy)
        iris_ids=np.flatnonzero(iris);edge_ids=np.flatnonzero(edges)
        if not len(iris_ids):iris_ids=eye
        if not len(edge_ids):edge_ids=eye
        ids=np.concatenate((rng.integers(0,len(xy),samples//4),rng.choice(eye,samples//4),
                            rng.choice(iris_ids,3*samples//8),rng.choice(edge_ids,samples//8)))
        # A neighboring target supervises local color differences without
        # differentiating through a procedural teacher or adding runtime inputs.
        direction=rng.integers(0,2,len(ids))
        neighbor=np.where(direction==0,np.minimum(ids//res+1,res-1)*res+ids%res,
                          (ids//res)*res+np.minimum(ids%res+1,res-1))
        xs.append(base.encode(xy[ids],c));ys.append(rgb[ids]);yns.append(rgb[neighbor]);
        deltas.append((xy[neighbor]-xy[ids])*.8)
    return tuple(torch.from_numpy(np.concatenate(v)) for v in (xs,ys,yns,deltas))


def compare(model,label,dataset_name='validation'):
    previous,_=load(BASELINE)
    manifest=json.loads((WORK/'dataset.json').read_text());res=manifest['resolution']
    controls=np.fromfile(WORK/f'{dataset_name}_states.f32',np.float32).reshape(-1,4)
    targets=np.memmap(WORK/f'{dataset_name}_rgba.f32',np.float32,mode='r',shape=(len(controls),res*res,4))
    xy=base.grid(res);eye=(np.abs(xy[:,0])<1.03)&(np.abs(xy[:,1])<.94)
    sums={kind:{k:0. for k in ['mse','eye_mse','iris_mse','edge_mse','gradient_mse','background_mse','sclera_mse']} for kind in ['before','after']}
    records=[];pictures=[];temporal={kind:[] for kind in ['before','after']};last_images={}
    for k,c in enumerate(controls):
        rgb=np.asarray(targets[k,:,:3]);iris,edges,_=regions(rgb,xy)
        bg=(rgb.max(axis=1)<.36)&(~eye)
        sclera=(rgb.min(axis=1)>.65)&((rgb.max(axis=1)-rgb.min(axis=1))<.16)&eye
        reference=rgb.reshape(res,res,3)
        record={'controls':c[:3].tolist()};predictions=[]
        for kind,m in [('before',previous),('after',model)]:
            p=base.predict(m,base.encode(xy,c));err=np.mean((p-rgb)**2,axis=1)
            im=p.reshape(res,res,3)
            grad_err=.5*(np.mean((np.diff(im,axis=0)-np.diff(reference,axis=0))**2)+
                         np.mean((np.diff(im,axis=1)-np.diff(reference,axis=1))**2))
            metrics={'mse':float(err.mean()),'eye_mse':float(err[eye].mean()),
                     'iris_mse':float(err[iris].mean()),'edge_mse':float(err[edges].mean()),
                     'gradient_mse':float(grad_err),'background_mse':float(err[bg].mean()),
                     'sclera_mse':float(err[sclera].mean())}
            record[kind]=metrics
            if dataset_name=='quality_test' and k>=24:
                if k>24:
                    last_pred,last_target=last_images[kind]
                    temporal[kind].append(float(np.mean(((p-last_pred)-(rgb-last_target))**2)))
                last_images[kind]=(p.copy(),rgb.copy())
            for key,value in metrics.items():sums[kind][key]+=value/len(controls)
            predictions.append(p)
        records.append(record)
        if k<8:pictures.append([rgb,*predictions])
    ratio={key:sums['after'][key]/sums['before'][key] for key in sums['before']}
    result={'before':sums['before'],'after':sums['after'],'after_before_mse_ratio':ratio,
            'before_weights_sha256':weights_sha(previous),'after_weights_sha256':weights_sha(model),
            'states':records,'region_definitions':{'eye_box':'x ±1.03, y ±.94',
            'iris':'teacher RGB max-min > .12, .03 < x < 1.05, abs(y) < .65',
            'edge':'max forward RGB difference in x/y > .025',
            'background':'outside eye box, teacher max RGB < .36',
            'sclera':'inside eye box, teacher min RGB > .65, max-min < .16'},'states_count':len(controls),
            'scope':f'{len(controls)} control states excluded from training loss; same teacher images for both models.',
            'dataset':dataset_name}
    if temporal['before']:
        result['temporal']={kind:{'delta_error_rmse':float(np.sqrt(np.mean(values)))} for kind,values in temporal.items()}
        result['temporal']['after_before_ratio']=result['temporal']['after']['delta_error_rmse']/result['temporal']['before']['delta_error_rmse']
    (WORK/f'{label}_quality.json').write_text(json.dumps(result,indent=2)+'\n')
    sheet=Image.new('RGB',(res*3,res*4+24*4),'#11191d');draw=ImageDraw.Draw(sheet)
    for row,k in enumerate([0,2,4,5]):
        for col,values in enumerate(pictures[k]):
            im=Image.fromarray(np.uint8(np.clip(values.reshape(res,res,3)[::-1],0,1)*255+.5))
            sheet.paste(im,(col*res,row*(res+24)+24));draw.text((col*res+5,row*(res+24)+5),['Teacher','Before','After'][col],fill='white')
    sheet.save(WORK/f'{label}_quality.png')
    # Enlarged iris crops are nearest-neighbor, with no sharpening or retouching.
    crops=Image.new('RGB',(3*300,4*240),'#11191d');draw=ImageDraw.Draw(crops)
    for row,k in enumerate([0,1,4,5]):
        for col,values in enumerate(pictures[k]):
            im=Image.fromarray(np.uint8(np.clip(values.reshape(res,res,3)[::-1],0,1)*255+.5))
            im=im.crop((int(.50*res),int(.28*res),int(.87*res),int(.69*res))).resize((270,210),Image.Resampling.NEAREST)
            crops.paste(im,(col*300+10,row*240+25));draw.text((col*300+10,row*240+5),['Teacher','Before','After'][col],fill='white')
    crops.save(WORK/f'{label}_crops.png')
    print(json.dumps({'label':label,'after_before_mse_ratio':ratio}),flush=True)
    return result


def capture_test():
    # New states are not inspected while selecting refinement hyperparameters.
    # 24 independent conditions, then 40 evenly spaced states of the default orbit.
    base.prepare_teacher();rng=np.random.default_rng(SEED+20)
    controls=np.zeros((64,4),np.float32);controls[:24,:3]=rng.random((24,3))
    t=np.arange(40)/40;phase=2*np.pi*t
    controls[24:,0]=.46+.34*np.sin(phase);controls[24:,1]=.40+.19*np.sin(phase+.8);controls[24:,2]=.56
    controls.tofile(WORK/'quality_test_states.f32')
    subprocess.run([str(WORK/'capture'),str(WORK/'material_source.txt'),str(WORK/'teacher_source.txt'),
        str(WORK/'quality_test_states.f32'),str(WORK/'quality_test_rgba.f32'),'256','256'],check=True)
    (WORK/'quality_test_manifest.json').write_text(json.dumps({'seed':SEED+20,'random_states':24,'orbit_states':40,
        'resolution':[256,256],'states_sha256':base.sha(WORK/'quality_test_states.f32'),
        'targets_sha256':base.sha(WORK/'quality_test_rgba.f32')},indent=2)+'\n')


def refine(args):
    snapshot();torch.set_num_threads(args.threads);torch.manual_seed(SEED)
    model,checkpoint=load(args.resume or BASELINE)
    x,y,yn,delta=dataset(args.samples_per_state)
    optimizer=torch.optim.Adam(model.parameters(),lr=args.lr)
    generator=torch.Generator().manual_seed(SEED+1)
    start=time.monotonic();trace=[]
    print(f'{len(x)} detail-focused pairs, same {sum(p.numel() for p in model.parameters())} parameters.',flush=True)
    for step in range(args.steps):
        ids=torch.randint(len(x),(args.batch,),generator=generator)
        inputs=x[ids];neighbors=inputs.clone();neighbors[:,:2]+=delta[ids]
        prediction=model(torch.cat((inputs,neighbors)))
        p,pn=prediction[:args.batch],prediction[args.batch:]
        # Protect low-contrast surfaces from trading away fidelity to the
        # heavily sampled iris. This weighting exists only during training.
        outside=(inputs[:,0].abs()>.824)|(inputs[:,1].abs()>.752)
        background=outside&(y[ids].max(dim=1).values<.36)
        sclera=(y[ids].min(dim=1).values>.65)&((y[ids].max(dim=1).values-y[ids].min(dim=1).values)<.16)
        weight=1+(args.background_weight-1)*background.float()+(args.sclera_weight-1)*sclera.float()
        color=(.5*((p-y[ids]).square().mean(dim=1)+(pn-yn[ids]).square().mean(dim=1))*weight).mean()
        smooth_bg=background&(yn[ids].max(dim=1).values<.36)
        smooth_sclera=sclera&(yn[ids].min(dim=1).values>.65)
        gradient_weight=1+(args.background_gradient_weight-1)*smooth_bg.float()+(args.sclera_gradient_weight-1)*smooth_sclera.float()
        gradient=(((pn-p)-(yn[ids]-y[ids])).square().mean(dim=1)*gradient_weight).mean()
        loss=color+args.gradient_weight*gradient
        optimizer.zero_grad(set_to_none=True);loss.backward();optimizer.step()
        lr=args.lr*(args.end_lr/args.lr)**((step+1)/args.steps)
        for group in optimizer.param_groups:group['lr']=lr
        if step==0 or (step+1)%1000==0:
            record={'step':step+1,'loss':float(loss),'rgb_loss':float(color),'gradient_loss':float(gradient),
                    'seconds':time.monotonic()-start,'lr':lr};trace.append(record);print(json.dumps(record),flush=True)
        if (step+1)%args.checkpoint_every==0 or step+1==args.steps:
            arguments={**vars(args),'width':96,'depth':4,'resume':str(args.resume or BASELINE)}
            output={'model':model.state_dict(),'width':96,'depth':4,'omega':base.OMEGA,'steps':step+1,
                    'seed':SEED,'trace':trace,'arguments':arguments,'dataset':checkpoint['dataset'],
                    'previous_stages':history(args.resume or BASELINE),
                    'refinement':'25% uniform, 25% eye box, 37.5% teacher iris color, 12.5% teacher edges; paired RGB + local-difference MSE'}
            torch.save(output,WORK/f'{args.name}.pt')
            compare(model,args.name)


def deliver(label):
    checkpoint=torch.load(WORK/f'{label}.pt',map_location='cpu')
    model,_=load(WORK/f'{label}.pt')
    test_path=WORK/f'{label}_test_quality.json'
    if not test_path.is_file():raise FileNotFoundError('Run the independent test before delivering a quality refinement.')
    test=json.loads(test_path.read_text());manifest=json.loads((WORK/'quality_test_manifest.json').read_text())
    if test.get('after_weights_sha256')!=weights_sha(model):raise ValueError('Stale independent test: run test on these exact weights first.')
    if test['after_before_mse_ratio']['mse']>=1 or test['after_before_mse_ratio']['iris_mse']>=1:
        raise ValueError('The candidate did not improve independent overall and iris reconstruction.')
    if 'previous_stages' not in checkpoint:
        checkpoint['previous_stages']=history(checkpoint['arguments']['resume'])
        torch.save(checkpoint,WORK/f'{label}.pt')
    base.deliver(label)
    model,_=load(WORK/f'{label}.pt');quality=compare(model,label)
    for src,dst in [(WORK/'quality_baseline_shader.txt',base.SCENE/'full_neural_eye_baseline.txt'),
                    (WORK/f'{label}_quality.png',base.SCENE/'full_neural_eye_quality.png'),
                    (WORK/f'{label}_crops.png',base.SCENE/'full_neural_eye_detail.png')]:shutil.copyfile(src,dst)
    metadata_path=base.SCENE/'full_neural_eye_model.json';metadata=json.loads(metadata_path.read_text())
    metadata['training']['loss']='Original RGB training, then quality refinement: paired display RGB MSE + '+str(checkpoint['arguments']['gradient_weight'])+' * neighbor-difference MSE'
    metadata['quality_refinement']={'description':checkpoint['refinement'],'baseline_commit':'b8ae3dc',
        'source_sha256':base.sha(Path(__file__)),'runtime_change':'Learned weight literals only; identical graph, inputs, activations, resolution and number of inference passes.',
        'comparison':quality,'sampling_seed':SEED,'baseline_checkpoint_sha256':base.sha(BASELINE),
        'baseline_shader_sha256':base.sha(WORK/'quality_baseline_shader.txt')}
    metadata['quality_refinement']['independent_test']={'manifest':manifest,'comparison':test}
    metadata['quality_refinement']['remaining_tradeoff']='Background MSE rises slightly from an already very small baseline; fine teacher fibers and residual neural surface ripples are not fully reproduced.'
    metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
    (base.SCENE/'full_neural_eye_quality.json').write_text(json.dumps(metadata['quality_refinement'],indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['snapshot','train','compare','deliver','capture-test','test'])
    parser.add_argument('--steps',type=int,default=30000);parser.add_argument('--batch',type=int,default=2048)
    parser.add_argument('--threads',type=int,default=4);parser.add_argument('--samples-per-state',type=int,default=8192)
    parser.add_argument('--lr',type=float,default=2e-5);parser.add_argument('--end-lr',type=float,default=3e-6)
    parser.add_argument('--gradient-weight',type=float,default=.4);parser.add_argument('--name',default='quality_refined')
    parser.add_argument('--background-weight',type=float,default=1);parser.add_argument('--sclera-weight',type=float,default=1)
    parser.add_argument('--background-gradient-weight',type=float,default=1);parser.add_argument('--sclera-gradient-weight',type=float,default=1)
    parser.add_argument('--resume');parser.add_argument('--checkpoint-every',type=int,default=10000)
    args=parser.parse_args();torch.set_num_threads(args.threads)
    if args.mode=='snapshot':snapshot()
    elif args.mode=='train':refine(args)
    elif args.mode=='deliver':deliver(args.name)
    elif args.mode=='capture-test':capture_test()
    elif args.mode=='test':compare(load(WORK/f'{args.name}.pt')[0],args.name+'_test','quality_test')
    else:compare(load(WORK/f'{args.name}.pt')[0],args.name)
