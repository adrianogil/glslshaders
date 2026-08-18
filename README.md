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
