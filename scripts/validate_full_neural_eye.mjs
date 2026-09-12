// Validate the entire-image neural path, weights and Shadertoy portability.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {header,footer} from '../03_raymarching/full_neural_eye_runtime.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const scene=join(root,'03_raymarching');
const file=join(scene,'11_full_neural_eye.frag'),source=readFileSync(file,'utf8');
const metadata=JSON.parse(readFileSync(join(scene,'full_neural_eye_model.json'),'utf8'));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(hash(file),metadata.shader_sha256,'Shader weights must match measured checkpoint.');
assert.equal(hash(join(root,'scripts/full_eye/full_neural_eye.pt')),metadata.checkpoint_sha256);
assert.equal(hash(join(root,'scripts/full_eye/train.py')),metadata.training_source_sha256);
assert.equal(hash(join(scene,'full_neural_eye_parity.json')),metadata.parity_fixture_sha256);
assert.equal(hash(join(scene,'full_neural_eye_comparison.png')),metadata.comparison_sha256);
assert.deepEqual(metadata.architecture,[6,96,96,96,96,3]);assert.equal(metadata.parameter_count,28899);
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
for(const [name,digest] of Object.entries(gpu.source_sha256))assert.equal(hash(join(scene,name)),digest,`Stale GPU evidence: ${name}`);
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
console.log('Full-image neural-only render path, trained weights, 128 parity fixtures, and held-out accuracy checks passed.');
