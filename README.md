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

## Controllable neural 3D eye

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
