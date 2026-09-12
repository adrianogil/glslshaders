// Verify the frozen model and compile both standalone Shadertoy pass bodies.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fragmentHeader,fragmentFooter} from '../03_raymarching/neural_eye_runtime.mjs';

const directory = fileURLToPath(new URL('../03_raymarching/', import.meta.url));
const names = ['09_controllable_neural_eye.frag', '10_neural_iris_material.frag'];
const [image, material] = names.map(name => readFileSync(join(directory,name),'utf8'));
const preview = readFileSync(join(directory,'09_controllable_neural_eye_preview.html'),'utf8');
const inlineModule = preview.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineModule, 'The preview must contain its shader-loading module.');
const syntax = spawnSync(process.execPath,['--check','--input-type=module'],{input:inlineModule,encoding:'utf8'});
assert.equal(syntax.status,0,`Preview module syntax: ${syntax.stderr}`);
const model = material.split('// BEGIN ORIGINAL NEURAL FUNCTION\n')[1]?.split('// END ORIGINAL NEURAL FUNCTION')[0];
assert.ok(model, 'The neural function and its provenance markers must be present.');
assert.equal(createHash('sha256').update(model).digest('hex'),
  '01761925c263394e6dfa01167d46ec6ea1fa3a6abc8389f18a98bc3a5393892b',
  'The 2,659-parameter model must match the accepted POC export exactly.');
assert.equal((model.match(/float l[0-2]_\d+ = sin\(/g) ?? []).length, 96, 'Three sine layers of 32 neurons.');
assert.ok(!image.includes('neuralEye('), 'Neural inference stays out of the per-frame image program.');
for (const source of [image, material]) {
  assert.ok(source.includes('void mainImage('));
  assert.ok(!/#include|#version|uniform\s/.test(source), 'Paste pass bodies directly into Shadertoy.');
}
assert.ok(material.includes('abs(controls.z-previous.z)<1e-6&&cached.a>.5'));
assert.ok(material.includes('notEqual(metadata.zw,iResolution.xy)'), 'Invalidate material after resize.');
assert.ok(image.includes('clamp(yaw,25.0,82.0)'), 'Never use a frontal eye view.');

const evidence = JSON.parse(readFileSync(join(directory,'neural_eye_validation.json'),'utf8'));
assert.equal(evidence.passed, true);
assert.equal(Object.keys(evidence.checks).length, 14);
assert.ok(Object.values(evidence.checks).every(value=>value===true));
assert.equal(evidence.readback, 'RGBA32F');
assert.equal(evidence.states_checked, 16);
assert.deepEqual(evidence.gl_errors, []);
assert.equal(evidence.console_warnings_or_errors, 0);
assert.ok(evidence.measurements.loop_mae < 1e-5);
assert.ok(evidence.measurements.view_mae > .005);
assert.ok(evidence.measurements.pupil_mae > .0001);
assert.ok(evidence.measurements.hue_pigment_mae > .01);
for (const [name, hash] of Object.entries({...evidence.source_sha256,...evidence.host_sha256})) {
  assert.equal(createHash('sha256').update(readFileSync(join(directory,name))).digest('hex'), hash,
    `Stale GPU evidence for ${name}; rerun browser validation after source edits.`);
}

const temporary = mkdtempSync(join(tmpdir(),'neural-eye-glsl-'));
const generated = [];
try {
  for (const [index, source] of [image, material].entries()) {
    const path = join(temporary,names[index]); generated.push(path);
    writeFileSync(path,fragmentHeader+source+fragmentFooter);
    const result = spawnSync('glslangValidator',['-S','frag',path],{encoding:'utf8'});
    if (result.error) throw new Error(`glslangValidator is required: ${result.error.message}`);
    assert.equal(result.status,0,`${names[index]}\n${result.stdout}\n${result.stderr}`);
    console.log(`GLSL ES 3.00 compilation passed: ${names[index]}`);
  }
} finally {
  generated.forEach(path=>unlinkSync(path)); rmdirSync(temporary);
}
console.log('Frozen model, layer count, Shadertoy interface, cache invalidation, oblique-view, and GPU evidence provenance checks passed.');
