// Deployment validation stays here; offline training lives in neural-shaders-pocs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const relocation=JSON.parse(readFileSync(new URL('./neural_eye_pipeline_relocation.json',import.meta.url)));
export const pipelineRoot=join(resolve(process.env.NEURAL_SHADERS_POCS_DIR || join(root,'../../research/neural-shaders-pocs')),relocation.poc_directory);
const digest=value=>createHash('sha256').update(value).digest('hex');

export function verifyTrainingFile(relative,recordedHash){
  const actual=digest(readFileSync(join(pipelineRoot,relative)));
  if(actual===recordedHash)return;
  // Preserve the original training provenance instead of pretending the moved
  // source produced the historical checkpoint. Only the recorded path edits qualify.
  const moved=relocation.changed_training_sources[relative];
  assert(moved,`Unrecorded training source change: ${relative}`);
  assert.equal(recordedHash,moved.before_sha256,`Historical training source: ${relative}`);
  assert.equal(actual,moved.after_sha256,`Relocated training source: ${relative}`);
}

export function verifyRecordedSceneFile(name,recordedHash){
  const bytes=readFileSync(join(root,'03_raymarching',name));
  if(digest(bytes)===recordedHash)return;
  // The only preview change is an informational link outside the rendering code.
  // Reversing that exact substitution must reproduce the entire measured host.
  const link=relocation.preview_documentation_link;
  assert.equal(name,link.file,`Unrecorded measured-source change: ${name}`);
  const text=bytes.toString('utf8');
  assert.equal(text.split(link.after).length,2,'Expected exactly one relocated documentation link.');
  assert.equal(digest(text.replace(link.after,link.before)),recordedHash,`Stale GPU evidence: ${name}`);
}
