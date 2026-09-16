// Validate the entire-image neural path, weights and Shadertoy portability.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {header,footer} from '../03_raymarching/full_neural_eye_runtime.mjs';
import {graphSignature} from '../03_raymarching/full_neural_eye_benchmark.mjs';
import {verifyTrainingFile,verifyRecordedSceneFile} from './neural_eye_pipeline_paths.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const scene=join(root,'03_raymarching');
const file=join(scene,'11_full_neural_eye.frag'),source=readFileSync(file,'utf8');
const metadata=JSON.parse(readFileSync(join(scene,'full_neural_eye_model.json'),'utf8'));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(hash(file),metadata.shader_sha256,'Shader weights must match measured checkpoint.');
verifyTrainingFile('scripts/full_eye/full_neural_eye.pt',metadata.checkpoint_sha256);
verifyTrainingFile('scripts/full_eye/train.py',metadata.training_source_sha256);
assert.equal(hash(join(scene,'full_neural_eye_parity.json')),metadata.parity_fixture_sha256);
assert.equal(hash(join(scene,'full_neural_eye_comparison.png')),metadata.comparison_sha256);
assert.deepEqual(metadata.architecture,[6,96,96,96,96,3]);assert.equal(metadata.parameter_count,28899);
const quality=JSON.parse(readFileSync(join(scene,'full_neural_eye_quality.json'),'utf8'));
verifyTrainingFile('scripts/full_eye/refine_quality.py',quality.source_sha256);
assert.equal(quality.baseline_shader_sha256,hash(join(scene,'full_neural_eye_baseline.txt')));
assert.equal(graphSignature(source),graphSignature(readFileSync(join(scene,'full_neural_eye_baseline.txt'),'utf8')),
  'Quality refinement must change weight literals only, not the per-pixel execution graph.');
const baseline=readFileSync(join(scene,'full_neural_eye_baseline.txt'),'utf8');
const outsideNetwork=s=>s.replace(/\/\/ BEGIN TRAINED FULL-IMAGE NETWORK[\s\S]*?\/\/ END TRAINED FULL-IMAGE NETWORK/,'__NETWORK__');
assert.equal(outsideNetwork(source),outsideNetwork(baseline),'Camera framing, controls and direct RGB output must be byte-identical.');
assert.deepEqual(source.match(/  vec4 x[01]=[^\n]+/g),baseline.match(/  vec4 x[01]=[^\n]+/g),'Input encoding must be unchanged.');
assert.deepEqual(quality,metadata.quality_refinement);
const fresh=quality.independent_test.comparison;
assert.equal(fresh.states_count,64);assert.equal(quality.independent_test.manifest.random_states,24);
assert.equal(quality.independent_test.manifest.orbit_states,40);
for(const key of ['mse','eye_mse','iris_mse','edge_mse','gradient_mse','sclera_mse']){
  assert.ok(fresh.after_before_mse_ratio[key]<1,`Fresh test regression in ${key}`);
  assert.ok(Math.abs(fresh.after[key]/fresh.before[key]-fresh.after_before_mse_ratio[key])<1e-12);
}
assert.ok(fresh.temporal.after_before_ratio<1,'Temporal reconstruction must also improve.');
assert.equal(fresh.after_weights_sha256,quality.comparison.after_weights_sha256);
const timing=JSON.parse(readFileSync(join(scene,'full_neural_eye_performance.json'),'utf8'));
assert.equal(timing.passed,true);assert.equal(timing.identical_execution_graph,true);
assert.equal(timing.samples_per_model_per_resolution,48);assert.equal(timing.draws_per_sample,8);
const median=a=>{const s=[...a].sort((a,b)=>a-b);return(s[(s.length-1)>>1]+s[s.length>>1])/2;};
for(const r of timing.results){
  for(const name of ['before','after']){
    assert.equal(r.samples_ms[name].length,48);assert.ok(r.samples_ms[name].every(v=>Number.isFinite(v)&&v>0));
    assert.ok(Math.abs(median(r.samples_ms[name])-r[name+'_median_ms'])<1e-10);
  }
  assert.ok(r.after_before_ratio<=1.05&&r.paired_ratio_median<=1.05,'Measured performance regression.');
  assert.ok(Math.abs(r.after_median_ms/r.before_median_ms-r.after_before_ratio)<1e-12);
}
for(const [name,digest] of Object.entries(timing.source_sha256))verifyRecordedSceneFile(name,digest);
const code=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
assert.ok(!/texture|texelFetch|sampler|iChannel|refract|reflect|smoothstep|sphereRoots|irisPigment|scene\(/.test(code),
  'No textures, caches, analytic eye geometry, material or optical renderer may enter the full-neural runtime.');
assert.ok(code.includes('fragColor=vec4(neuralFullEye(p,eyeConditions()),1.);'),
  'The final entire pixel must come directly from the network, with no mask or procedural RGB blend.');
assert.equal((code.match(/float n[0-3]_\d+=sin\(/g)??[]).length,384,'Four sine layers of 96 neurons each.');
assert.equal(metadata.holdout.states.length,20);
assert.ok(metadata.holdout.mean_eye_box_psnr>30,'Held-out eye-region reconstruction must remain above the recorded acceptance floor.');
const fixture=JSON.parse(readFileSync(join(scene,'full_neural_eye_parity.json'),'utf8'));
assert.equal(fixture.xy.length,128);assert.equal(fixture.rgb.length,128);
assert.ok(fixture.rgb.flat().every(v=>Number.isFinite(v)&&v>=0&&v<=1));
const gpu=JSON.parse(readFileSync(join(scene,'full_neural_eye_validation.json'),'utf8'));
assert.equal(gpu.passed,true);assert.equal(Object.keys(gpu.checks).length,11);
assert.ok(Object.values(gpu.checks).every(v=>v===true));assert.equal(gpu.probes,128);
assert.ok(gpu.measurements.parity_max<.0005);assert.equal(gpu.measurements.loop_mae,0);
assert.equal(gpu.checks.zero_network_removes_whole_image,true);assert.deepEqual(gpu.gl_errors,[]);
for(const [name,digest] of Object.entries(gpu.source_sha256))verifyRecordedSceneFile(name,digest);
const preview=readFileSync(join(scene,'11_full_neural_eye_preview.html'),'utf8');
assert.ok(!/fetch\([^)]*(?:09_controllable|10_neural|material)/.test(preview));
const module=preview.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];assert.ok(module);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:module,encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr);
const temporary=mkdtempSync(join(tmpdir(),'full-neural-eye-'));
const generated=[];
try {
  const toyHeader='#version 300 es\nprecision highp float;\nuniform vec3 iResolution;\nuniform float iTime;\nuniform vec4 iMouse;\nout vec4 outputColor;\n';
  for(const [name,h] of [['shadertoy',toyHeader],['preview',header]]) {
    const path=join(temporary,name+'.frag');generated.push(path);writeFileSync(path,h+source+footer);
    const result=spawnSync('glslangValidator',['-S','frag',path],{encoding:'utf8'});
    if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
    console.log('GLSL ES 3.00 compilation passed: '+name);
  }
}finally{generated.forEach(p=>unlinkSync(p));rmdirSync(temporary);}
console.log('Full-neural render path, identical execution graph, 128 GPU probes, 64 fresh quality states, and paired GPU performance evidence passed.');
