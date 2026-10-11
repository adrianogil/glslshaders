# Oscillating Point Ribbons

Single-pass, fragment-only GLSL adaptation of [@yuruyurau's sketch](https://x.com/yuruyurau/status/2108944867930132499).
The equations come from the supplied code transcription saved in ResearchNotes,
`ComputerGraphics/ProceduralArt/Procedural Art - yuruyurau - Oscillating Point Ribbons.md`.
The original tweet was not independently fetched or its animation verified.

## Run

Paste all of `01_oscillating_point_ribbons.frag` into a Shadertoy **Image** tab.
Leave every channel empty. No Common tab, buffers, textures, custom uniforms,
vertex computations of point positions, or CPU-generated point data are needed.
Shadertoy supplies `iTime`, `iResolution`, and the `mainImage` wrapper.

For the local WebGL 2 preview, serve the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/09_point_ribbons/01_oscillating_point_ribbons_preview.html>.
The preview offers pause, reset, time scrubbing, and render resolution.
Its vertex shader only emits a full-screen triangle. All artwork is computed in
the fragment shader loaded from the paired file.

## Translation

- Retains all original indices `0..9999`, `y=i/299`, the auxiliary distance,
  radial modulation, and even/odd angular offset of nine radians.
- Fits the original 400×400 coordinate space into the shorter viewport dimension
  and flips Y to match p5.js. Wider viewports reveal more surrounding background.
- Converts frame time to seconds assuming 60 FPS: `t=iTime*PI+PI/60`.
  The equations repeat after eight seconds at the default `SPEED=1`.
- Replaces `point()` with a soft disc evaluated at each fragment. The radius is
  0.5 original-canvas pixels; the smooth edge spans one output pixel.
- Accumulates white source-over opacity using the product of transparencies.
  Every frame starts with `9/255` gray. There is no feedback or temporal trail.

Positions follow the original equations; rasterization is an approximation of
p5.js's antialiasing, not a promise of pixel-identical Canvas output. At reduced
resolution very fine fringes can lose brightness.

## Conservative culling

A full scan would evaluate 10,000 positions for every output pixel. This shader
groups 100 consecutive indices and rejects groups whose radial lines cannot
reach the pixel. Because `e<0` throughout the original index range and `|k|<=5`,
each group has provable bounds on `d=length(k,e)-6`.

Invert the angle relation `c=d/4-t/4+parity*9` for each pixel and both parities.
The tolerated angular difference is `asin(pointSupport/distanceFromCenter)`;
the support includes the entire soft edge. Comparing modulo PI treats lines in
both directions, so negative radii remain safe. Near the center all angular
directions are admitted. Surviving samples receive the same angular test before
their more expensive radial deformation is evaluated.

This keeps all contributing samples but is still substantially more expensive
than drawing 10,000 vertices. Start at 400×400 or 240×240 on slower GPUs.
Set `RIBBON_CULLING` to `0` for the full-scan reference (especially expensive at
large resolutions). Culling relies on the original sample count and index
mapping; changing those requires re-deriving the bounds. `POINT_COUNT` must
remain divisible by `BLOCK_SIZE`.

The source is intended for Shadertoy's GLSL ES 3.00 environment; nothing is
uploaded or published by the local preview.

## Validation performed

- Repository naming/reference validator passed (9 categories, 64 shaders).
- Both culling variants compiled with `glslangValidator` under GLSL ES 3.00.
- Native OpenGL float framebuffer comparisons gave zero pixel difference
  between culled and full-scan rendering at `(width,height,time)` values
  `(400,400,0)`, `(400,400,1)`, `(241,161,3.7)`, and `(161,241,7.99)`.
  Odd-sized rectangular targets also exercise the exact center pixel.
- At 400×400, independent CPU splatting of the original equations at time zero
  differed from the GPU by 0.000128 RMS / 0.004113 maximum in normalized RGB.
  This comparison uses the same soft-disc coverage, not p5.js rasterization.
- The eight-second loop endpoint differed by at most 0.000123 in normalized
  RGB, consistent with finite-precision trigonometry.
- Local WebGL 2 preview compiled and rendered; pause, reset, resolution, and
  keyboard time scrubbing were checked in the browser.

On an AMD Radeon Pro 5300M, a small native OpenGL timing check at 400×400 and
time zero measured roughly 22 ms/frame culled versus 95 ms/frame full scan.
This was three completion-synchronized draws after one warmup, not a browser
benchmark or a frame-rate guarantee. No execution on shadertoy.com is claimed.
