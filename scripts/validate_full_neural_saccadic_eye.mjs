// Separate validation for shader 12; does not rewrite shader 11 evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {header,footer} from '../03_raymarching/full_neural_saccadic_eye_runtime.mjs';
import {verifyTrainingFile} from './neural_eye_pipeline_paths.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),scene=join(root,'03_raymarching');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const source=readFileSync(join(scene,'12_full_neural_saccadic_eye.frag'),'utf8');
const model=JSON.parse(readFileSync(join(scene,'full_neural_saccadic_eye_model.json')));
assert.deepEqual(model.architecture,[7,96,96,96,96,3]);assert.equal(model.parameter_count,28995);
for(const [key,path] of Object.entries({shader_sha256:'03_raymarching/12_full_neural_saccadic_eye.frag',parity_sha256:'03_raymarching/full_neural_saccadic_eye_parity.json',comparison_sha256:'03_raymarching/full_neural_saccadic_eye_comparison.png'}))assert.equal(model[key],hash(join(root,path)),key);
for(const [key,path] of Object.entries({checkpoint_sha256:'scripts/full_eye_gaze/full_neural_saccadic_eye.pt',training_source_sha256:'scripts/full_eye_gaze/train.py',base_source_sha256:'scripts/full_eye/train.py',template_sha256:'scripts/full_eye_gaze/shader_template.txt'}))verifyTrainingFile(path,model[key]);
assert.equal(model.dataset.train_states,768);assert.equal(model.holdout.states.length,40);
assert.equal(model.independent_test.metrics.states.length,64);
assert.ok(model.independent_test.metrics.mean_eye_psnr>31,'Independent eye reconstruction acceptance floor.');
const code=source.replace(/\/\/[^\n]*/g,'');
assert.ok(!/texture|texelFetch|sampler|iChannel|refract|reflect|sphereRoots|irisPigment/.test(code));
assert.equal((code.match(/float n[0-3]_\d+=sin\(/g)??[]).length,384);
assert.equal((code.match(/dot\(/g)??[]).length,7176,'Same packed dot count as shader 11; one additional active input component.');
assert.ok(code.includes('(controls.w-.46)*.55'),'Pitch must be a real learned input.');
const main=code.slice(code.indexOf('void mainImage('));
assert.ok(main.includes('fragColor=vec4(neuralFullEye(p,eyeConditions()),1.);'));
assert.ok(!/saccade|rotate|sin\(|cos\(|mix\(/.test(main),'No animation-dependent screen warp; animation enters the network as controls.');
// Evaluate the exact scalar/vector control algorithm across its full loop.
const spans=Array.from(source.matchAll(/endpoints=vec4\(([^)]+)\);\s*(?:vec2 )?window=vec2\(([^)]+)\)/g),m=>{const p=m[1].split(',').map(Number),w=m[2].split(',').map(Number);return [p.slice(0,2),p.slice(2),...w];});
assert.equal(spans.length,8,'Test the actual exported fixation schedule.');
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const v=clamp((x-a)/(b-a));return v*v*(3-2*v);};
function gaze(time){const t=((time%10)+10)%10,s=spans.find(s=>t>=s[2]&&t<s[3]),age=t-s[2],delta=s[1].map((v,i)=>v-s[0][i]);const flight=.065+.055*Math.hypot(...delta),u=clamp(age/flight),ease=u*u*u*(u*(u*6-15)+10),tail=clamp((age-flight)/.16),hold=smooth(.26,.42,age)*(1-smooth(s[3]-s[2]-.16,s[3]-s[2],age));return delta.map((d,i)=>clamp(s[0][i]+d*ease+.025*d*Math.sin(6.28318530718*tail)*(1-tail)**2+.0007*hold*Math.sin([11.3,14.9][i]*age)));}
const minimum=[1,1],maximum=[0,0];for(let i=0;i<=100000;i++){const v=gaze(i/10000);for(let k=0;k<2;k++){assert(Number.isFinite(v[k])&&v[k]>=0&&v[k]<=1);minimum[k]=Math.min(minimum[k],v[k]);maximum[k]=Math.max(maximum[k],v[k]);}}
assert.deepEqual(gaze(0),gaze(10));for(const span of spans){const a=gaze(span[2]-1e-7),b=gaze(span[2]+1e-7);assert(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<1e-6);}
assert((maximum[0]-minimum[0])*44>36);assert((maximum[1]-minimum[1])*50>35);
const fixture=JSON.parse(readFileSync(join(scene,'full_neural_saccadic_eye_parity.json')));
assert.equal(fixture.xy.length,128);assert(fixture.controls.every(c=>c.length===4));
if(!process.argv.includes('--without-gpu-record')){
 const gpu=JSON.parse(readFileSync(join(scene,'full_neural_saccadic_eye_validation.json')));
 assert(gpu.passed);assert(Object.values(gpu.checks).every(v=>v===true));assert(gpu.measurements.parity_max<.0005);
 assert(gpu.checks.pitch_response&&gpu.checks.vertical_mouse_gaze&&gpu.checks.zero_network_removes_whole_image);
 for(const [name,digest] of Object.entries(gpu.source_sha256))assert.equal(hash(join(scene,name)),digest,name);
}
const temp=mkdtempSync(join(tmpdir(),'neural-gaze-')),files=[];
try{for(const [name,h] of [['preview',header],['shadertoy','#version 300 es\nprecision highp float;\nuniform vec3 iResolution;uniform float iTime;uniform vec4 iMouse;out vec4 outputColor;\n']]){const path=join(temp,name+'.frag');files.push(path);writeFileSync(path,h+source+footer);const out=spawnSync('glslangValidator',['-S','frag',path],{encoding:'utf8'});assert.equal(out.status,0,out.stdout+out.stderr);}}
finally{files.forEach(p=>unlinkSync(p));rmdirSync(temp);}
console.log(JSON.stringify({passed:true,parameters:model.parameter_count,packed_dots:7176,fixation_range_degrees:{yaw:[32+44*minimum[0],32+44*maximum[0]],pitch:[-28+50*minimum[1],-28+50*maximum[1]]},mean_independent_eye_psnr:model.independent_test.metrics.mean_eye_psnr}));
