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
