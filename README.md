# GLSL shaders

A fragment-shader playground organized for predictable browsing and gallery generation.

## Naming convention

- Category directories use `NN_lower_snake_case`, with contiguous numbers starting at `01`.
- Fragment shaders use `NN_descriptive_lower_snake_case.frag`, numbered contiguously within each category.
- Preview pages are colocated with their shader and use `<shader-stem>_preview.html`.
- Supporting assets use descriptive `lower_snake_case` names and remain colocated with the shaders that consume them.
- Names are English topic or effect descriptions; avoid generic stems such as `simple`, spelling variants, and non-fragment extensions such as `.glsl`.

Append new categories and shaders with the next available number. If an item is reordered or renamed, keep its category contiguous and update every preview or tool reference in the same change.

## Validation

Run the dependency-free naming and reference check from the repository root:

```sh
python3 scripts/validate_naming.py
```

The hinged-square study also includes a discrete geometry/colour check:

```sh
node scripts/validate_hinged_square_coloring.mjs
```

## Local previews

Preview pages load their paired shader with `fetch`, so serve the repository
instead of opening the HTML directly. For example:

```sh
python3 -m http.server 8000
```

Then open `/07_animation/14_hinged_square_map_coloring_preview.html`. Its
30-second loop contains five unfoldings. Press Space to pause, use the arrow
keys to scrub, and press 0–4 for the final, hinge, parity, colour-index, and
seam-ownership views.

## Wide two-axis neural saccades (shader 12)

[12_full_neural_saccadic_eye.frag](03_raymarching/12_full_neural_saccadic_eye.frag)
extends the whole-image network with a **learned pitch input**. It does not fake
vertical gaze by moving or rotating the image. All RGB—including the eye,
reflections, shadow, and background—still comes directly from one network
evaluation per pixel. The older fixed-pitch shader 11 and its evidence remain
unchanged.

The new model is **7→96→96→96→96→3, 28,995 parameters**: only 96 more weights,
with the same 384 hidden sine activations and 7,176 packed dot products. This is
an operation-count comparison, not a new measured performance guarantee.
Training starts from the refined shader-11 checkpoint with an initially zero
pitch column, then fits 768 offline 3D teacher states at 256×256. Of those,
128 retain the original −5° pitch for rehearsal. Training uses 4,718,592
pixel/neighbor pairs, 40,000 Adam updates, and a mix of global, eye, and
iris-focused sampling with RGB and neighboring-pixel difference losses.

The trained domain is yaw **32–76°**, pitch **−28–22°**, pupil/hue 0–1. The
ten-second animation mixes diagonal, horizontal-only, and vertical-only jumps,
with irregular fixations and slight settling. Its largest target changes are
about **37° horizontally and 36° vertically**, roughly twice the previous
horizontal-only saccade span. Mouse X/Y now controls **yaw/pitch**, not pupil;
release resumes saccades. Set `IRIS_HUE` and `PUPIL_SIZE` in the single Image
source. No channels or buffers are needed.

[Open the two-axis preview](http://127.0.0.1:8766/03_raymarching/12_full_neural_saccadic_eye_preview.html)
after serving this repository. It includes manual gaze, pupil/hue controls,
GPU parity/directional checks, and a complete-source field for transfer to
ShaderToy. Its manual sliders retain a pose; ShaderToy mouse release resumes
the animation.

Forty held-out validation states measured **36.65 dB full-image / 34.16 dB
eye-box PSNR**. After the final checkpoint was selected, 64 fresh test states
(32 random plus 32 along the wide gaze family) measured **36.49 / 33.99 dB**,
with worst eye-box PSNR **29.91 dB**. The eye box is `|x|,|y| < 1.04` at
256×256. These are scores against this teacher over the new two-axis domain,
not a direct quality comparison with shader 11 or photographic realism scores.
Fine fibers, reflections, and smooth surfaces remain approximate.

See [teacher/neural views](03_raymarching/full_neural_saccadic_eye_comparison.png),
[checkpoint/training/test metadata](03_raymarching/full_neural_saccadic_eye_model.json),
and [the new pipeline](../../research/neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader/scripts/full_eye_gaze/train.py).
The pipeline, tracked checkpoint, and ignored scratch captures now live in the
research POC; see [training pipeline location](#training-pipeline-location).

All **13 GPU checks passed** on ANGLE Metal / AMD Radeon Pro 5300M: 128-probe
PyTorch/GLSL parity (maximum `7.75e-7`), separate yaw/pitch/pupil/hue responses,
both mouse axes, exact loop closure, return to animation after mouse release,
and an ablation in which zero neural output removes the entire image.
[Source-bound GPU evidence](03_raymarching/full_neural_saccadic_eye_validation.json)
is separate from shader 11's results. The new source also compiled in the
user's actual ShaderToy editor (6.1 seconds) and was visually checked there.
It was left **unsaved, private, and unpublished**; no public shader ID is claimed.

Reproduction uses Python with PyTorch/NumPy/Pillow and macOS OpenGL/clang++ for
offline capture. Run in a disposable copy when experimenting: capture/export
replace shader-12 artifacts and require new source-bound GPU evidence.

```sh
cd ../../research/neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader
python scripts/full_eye_gaze/train.py capture
python scripts/full_eye_gaze/train.py train --steps 40000 --name gaze
python scripts/full_eye_gaze/train.py capture-test
python scripts/full_eye_gaze/train.py deliver --name gaze
node ../../../graphics/glslshaders/scripts/validate_full_neural_saccadic_eye.mjs
```

## Fixed-pitch full-image neural eye (shader 11)

[11_full_neural_eye.frag](03_raymarching/11_full_neural_eye.frag) is a **whole-image
neural renderer**, unlike the older hybrid material study below. Its entire
scene output is:

```glsl
fragColor = vec4(neuralFullEye(p, eyeConditions()), 1.);
```

Every pixel, every frame, goes through the trained network. This includes the
globe silhouette, corneal bulge, pupil, iris, lighting, reflections, floor shadow,
and background. There is no analytic eye renderer, mask, material atlas,
procedural detail, texture, or image/animation cache in the deployed shader.

[Open the full-neural preview](http://127.0.0.1:8766/03_raymarching/11_full_neural_eye_preview.html)
after starting the local server described below. This page fetches only the new
shader for rendering; the old teacher and material pass are not loaded.

### Shadertoy setup: one Image pass

Paste the entire `11_full_neural_eye.frag` into **Image**. Leave all channels
empty; no Buffer or Common tab is needed. The weights are inline.

- Default: a ten-second oblique orbit and pupil breathing, both neural inputs.
- Hold and drag: horizontal position controls yaw; vertical controls dilation.
- Release: resume the orbit.
- Set `IRIS_HUE` near the top of the shader to control the learned iris hue.
- The local preview additionally exposes hue as a live slider, plus view/pupil
  sliders, arrow keys, pause/reset and render resolution. These controls change
  only the network inputs, not the image shading.

This is a Shadertoy-compatible source and a tested local WebGL host; it has not
been uploaded to or executed on shadertoy.com.

### What was actually trained

A new **28,899-parameter** `6→96→96→96→96→3` SIREN-style network learns final,
display-space RGB from screen x/y, normalized yaw, pupil dilation and periodic
hue encoding. The final linear output is clamped to [0,1]. No eye-specific
geometry features enter the network. Animation maps time to yaw/pupil inputs.

The older renderer serves strictly as an **offline image teacher**. We captured
384 continuously varied control states at 256×256, selected 3,145,728 training
pixel/condition pairs, and trained for 12,000 Adam updates followed by 24,000
lower-learning-rate updates (batch size 2,048). Half the selected pixels are
globally uniform and half concentrate on the eye area; this is training sampling,
not a runtime mask. Twenty separate continuous control states are held out of
the training loss.

After weight-only quality refinement, recorded held-out display-RGB PSNR is
**38.57 dB** full image, **35.77 dB** mean eye-region box, and **34.14 dB** worst
eye-region box (previously 37.53 / 34.64 / 33.03 dB). These compare this model
to this offline teacher, not to photographs or an anatomically calibrated eye.
See [unretouched teacher/neural comparisons](03_raymarching/full_neural_eye_comparison.png),
[training metadata](03_raymarching/full_neural_eye_model.json), and the
[reproducible training/export pipeline](../../research/neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader/scripts/full_eye/train.py).

The learned view family is bounded: yaw 32–76°, fixed pitch −5°, pupil/hue
0–1. This is a conditional image representation of a 3D eye, **not** a neural
SDF or an arbitrary-camera 3D field. Fine iris fibers remain softer than the
teacher, and subtle approximation artifacts can remain on moving boundaries
or the background. Wide/tall viewports extend the learned background by
clamping input coordinates at the trained screen-domain edges. Full-image
inference is substantially more expensive than the old cached material; use
a lower render width on slower GPUs. The preview displays observed presentation
cadence, not a controlled GPU benchmark.

### Quality upgrade without more runtime work

The upgrade changes **trained weight literals only** in the Image shader.
The execution graph, 28,899 parameters, 384 hidden sine activations, 7,176 packed
dot products, one inference per pixel, and default 384×288 resolution are all
unchanged. No sharpening filter, extra pass, resolution reduction, procedural
detail or image cache was added. The A/B timing tool loads only on request.

Additional offline training uses iris/edge-focused pixel sampling, neighboring
pixel differences, and stronger penalties for errors on smooth white/background
regions. These are training-only loss terms, not runtime masks or features.
The three refinement stages add 30,000 + 16,000 + 14,000 updates (96,000 total,
including the original training).

After choosing the weights using the original 20 validation states, a fresh
test set of **24 independent control states plus 40 animation states** measured:

| Display-RGB reconstruction error | Change from the previous shader |
|---|---:|
| Whole-image MSE | −21.8% |
| Iris-region MSE | −37.4% |
| Edge-region MSE | −29.0% |
| White-of-eye-region MSE | −45.7% |
| Animation frame-difference error, RMSE | −10.5% |

Region definitions, all per-state results and captured-data hashes are in
[quality evidence](03_raymarching/full_neural_eye_quality.json).
See [teacher / before / after](03_raymarching/full_neural_eye_quality.png) and
[enlarged iris details](03_raymarching/full_neural_eye_detail.png). Images are
direct model output; the detail sheet uses nearest-neighbor enlargement only.
The tradeoff is a small background-error increase: MSE `1.25e-5 → 1.50e-5`.
Fine teacher fibers and some faint neural surface ripples remain imperfect.

The preview's **Compare before/after GPU time** button measures the frozen
`b8ae3dc` shader and the current shader in the same context and RGBA8 target,
at 384×288 and 512×384. It warms both programs, uses alternating ABBA/BAAB order,
and collects 48 samples per version/resolution, with eight complete renders per
sample. Native GPU timers are used when their startup probe works; otherwise
all samples use completion-synchronized wall time. Compilation and UI refresh
are not part of the timed intervals. A 5% non-regression tolerance accommodates
local measurement noise; this is not a universal hardware guarantee.

[Recorded native-GPU timings](03_raymarching/full_neural_eye_performance.json)
on AMD Radeon Pro 5300M are **3.337 → 3.314 ms** at 384×288 and
**7.365 → 7.362 ms** at 512×384. Paired median ratios are 0.994 and 1.003:
effectively unchanged performance within measurement noise, not a speedup claim.

### Full-neural validation and reproduction

```sh
python3 scripts/validate_naming.py
node scripts/validate_full_neural_eye.mjs
node --check 03_raymarching/full_neural_eye_runtime.mjs
```

The validator rejects runtime textures, analytic eye geometry, optics, or
procedural RGB blending; verifies checkpoint/export/fixture hashes; and compiles
both the standalone Shadertoy source and preview variant with `glslangValidator`.
The preview's GPU checks compare 128 RGB probes against PyTorch and exercise
view, pupil, hue, time and standard Shadertoy mouse controls. A GPU ablation
replaces the network output with zero and verifies that **the entire image
becomes black**, including its background.

The [recorded GPU verification](03_raymarching/full_neural_eye_validation.json)
passes all 11 checks on ANGLE Metal / AMD Radeon Pro 5300M. Maximum RGB
disagreement with PyTorch is `9.24e-7`; the ten-second loop matches exactly.
Recorded hashes tie that result to the shipped shader, host and probe fixture.

### Training pipeline location

Offline capture, training, refinement, export templates, checkpoints, and local
`work/` data live in
[`neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader`](../../research/neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader/README.md#full-image-neural-eye-pipelines).
Only deployed GLSL, browser previews/runtime assets, exported model/evidence
files, and deployment validators remain in this repository. Running a preview
does not require the research checkout or Python.

The workspace defaults are `workspace/graphics/glslshaders` and
`workspace/research/neural-shaders-pocs`. Set `GLSLSHADERS_DIR` to the absolute
GLSL repository path for Python capture/export, or `NEURAL_SHADERS_POCS_DIR` to
the absolute research repository path for the Node deployment validators, if
your checkouts use a different layout. Full provenance checks require both
repositories; the offline teacher is read from shaders 09–10 here.

The 2026-09-16 move did not retrain or change shader weights. Historical model
metadata, resume paths, GPU reports, and performance measurements are retained
as recorded. The [relocation manifest](scripts/neural_eye_pipeline_relocation.json)
binds the three path-adjusted training sources to their original hashes. The
shader-11 preview's informational training link was updated; validation reverses
only that exact anchor replacement to verify the complete previously measured
host. No rendering code changed and no new GPU timing is claimed.

To reproduce training, use Python with `torch`, `numpy`, and `Pillow`, plus
macOS `clang++`/OpenGL for the offline teacher capture:

```sh
# Starting from the glslshaders repository root:
cd ../../research/neural-shaders-pocs/poc_animated_conditional_eye_fragment_shader
python scripts/full_eye/train.py capture --states 384 --resolution 256
python scripts/full_eye/train.py train --steps 12000 --checkpoint-every 3000 --threads 4 --width 96 --depth 4 --batch 2048 --name full_eye
python scripts/full_eye/train.py train --steps 24000 --checkpoint-every 6000 --threads 4 --width 96 --depth 4 --batch 2048 --lr .00004 --end-lr .000005 --resume scripts/full_eye/work/full_eye.pt --name full_eye_refined
python scripts/full_eye/train.py deliver --name full_eye_refined
```

The trained checkpoint is included at `scripts/full_eye/full_neural_eye.pt`
inside the POC. Generated capture/training scratch files stay ignored under
the POC's `scripts/full_eye/work/`.

To reproduce the quality upgrade after generating the teacher captures above,
continue from that same POC directory:

```sh
python scripts/full_eye/refine_quality.py snapshot
python scripts/full_eye/refine_quality.py train --steps 30000 --checkpoint-every 10000
python scripts/full_eye/refine_quality.py train --name quality_balanced --resume scripts/full_eye/work/quality_refined.pt --steps 16000 --checkpoint-every 8000 --lr .000008 --end-lr .0000015 --background-weight 12 --sclera-weight 5
python scripts/full_eye/refine_quality.py train --name quality_smooth --resume scripts/full_eye/work/quality_balanced.pt --steps 14000 --checkpoint-every 7000 --lr .000008 --end-lr .0000015 --background-weight 12 --sclera-weight 5 --background-gradient-weight 64 --sclera-gradient-weight 32
python scripts/full_eye/refine_quality.py capture-test
python scripts/full_eye/refine_quality.py test --name quality_smooth
python scripts/full_eye/refine_quality.py deliver --name quality_smooth
```

The snapshot command retrieves the original baseline from commit `b8ae3dc`,
not the already-upgraded weights. Re-run GPU verification and timing, and record
fresh source hashes, after any new export; old GPU evidence must not be reused.

## Older hybrid neural iris material (09–10)

**This older experiment does not render the whole eye with a network.** Its
geometry, lighting and animation are conventional rendering. Use shader 11
above for the corrected full-image neural implementation.

The standalone eye uses a real spherical globe, a bulging refractive corneal
cap, a recessed iris, and an open pupil. It preserves the accepted visual study
from `neural-shaders-pocs`, commit `d2872f5`, with no eyelids or face. The
ten-second orbit remains off-axis (all view angles are clamped to 25–82°).

Serve this repository and open the paired preview:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

[Open the local eye preview](http://127.0.0.1:8766/03_raymarching/09_controllable_neural_eye_preview.html).
It requires WebGL 2 and `EXT_color_buffer_float`. No package installation,
training, external textures, or files outside this repository are needed.

### ShaderToy setup

This is one effect with two passes. Copy the complete files as follows:

| ShaderToy tab | Source file | Channel 0 |
|---|---|---|
| Image | [09_controllable_neural_eye.frag](03_raymarching/09_controllable_neural_eye.frag) | Buffer A |
| Buffer A | [10_neural_iris_material.frag](03_raymarching/10_neural_iris_material.frag) | Buffer A itself, for previous-frame feedback |

Both files define `mainImage` and use ShaderToy's standard inputs; do not add
the preview's GLSL wrapper or its JavaScript. No Common tab or other channels
are required. Use a floating-point Buffer A. Sampling is explicit through
`texelFetch`, including angular wrap and radial clamp, so input filtering and
wrap settings do not change the material. Restart playback after connecting
the channels. Nothing has been uploaded or published to ShaderToy.

Controls are drawn and processed in the shaders themselves:

- Drag above the bars to pose the eye; releasing retains the pose.
- Drag the upper colored bar to change iris hue (learned conditioning).
- Drag the lower gray bar to change pupil dilation (analytic geometry).
- Click the small ring on the right of the bars to resume the default orbit.
- Resizing the buffers reinitializes the default controls and pigment.

The local preview also has accessible hue/pupil sliders, arrow-key posing,
play/pause, reset, and 640/960/1440-pixel render widths. The HTML sliders send
the same mouse protocol to the shaders; they do not implement a separate
color or pupil effect.

### Neural material and provenance

Buffer A includes the unchanged **2,659-parameter** `13→32→32→32→3` sine
network. The exact original generated function is delimited in the file and
verified by SHA-256:
`01761925c263394e6dfa01167d46ec6ea1fa3a6abc8389f18a98bc3a5393892b`.
Its foundation is [SIREN, Sitzmann et al. (2020)](https://arxiv.org/abs/2006.09661).
The eye teacher, controls, geometry, and optics are the POC's own application.

The first two texels in row zero hold normalized controls and cache metadata.
The following rows hold a linear pigment atlas of up to 512×256 texels
(smaller when the viewport is smaller). Its neural decode runs at startup,
after resize, or when hue changes. Other frames copy the previous pigment;
pose, pupil, and time do not reevaluate the network. Image performs the
geometry, single-interface refraction, studio lighting, and procedural tissue
detail. This remains a hybrid neural material, not a trained 3D field or an
anatomically calibrated optical simulation.

### Validation

```sh
python3 scripts/validate_naming.py
node scripts/validate_neural_eye.mjs
node --check 03_raymarching/neural_eye_runtime.mjs
```

The neural-eye validator requires `glslangValidator` on PATH. It checks the
frozen weights, layer count, pass interfaces, and cache/pose constraints, then
compiles both shaders as GLSL ES 3.00 using the local preview's exact wrapper.

In the preview, expand **ShaderToy setup and validation** and run **GPU checks**.
The 14 checks cover real RGBA32F readback, control response and persistence,
cached versus fresh material, unchanged pigment under pupil/pose edits, loop
closure, 16 oblique angle/time states, and small/portrait/landscape buffers.
Image-difference measurements exclude the control bars. The check resets the
eye when finished.

The [recorded validation](03_raymarching/neural_eye_validation.json) passed
on Chromium 152 / ANGLE Metal / Intel UHD Graphics 630, with zero GL errors
and zero browser warnings/errors. UI checks additionally covered hue/pupil
inputs, near-profile dragging, pause/reset, high detail, and a 390×844 page.
This validates a local ShaderToy-compatible host, not execution on ShaderToy's
website. No frame-rate, reconstruction-accuracy, or photorealism score is
claimed for this port.
