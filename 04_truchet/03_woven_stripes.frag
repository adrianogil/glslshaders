#ifdef GL_ES
precision mediump float;
#endif
#extension GL_OES_standard_derivatives : enable

uniform float u_time;
uniform vec2  u_mouse;
uniform vec2  u_resolution;

// -------------------- utils --------------------
float hash21(vec2 p) {
    // tiny 2D -> 1D hash
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

mat2 rot90(int k) {
    // k in {0,1,2,3} -> multiples of 90 degrees
    if (k == 0) return mat2(1.0,0.0,0.0,1.0);
    if (k == 1) return mat2(0.0,-1.0,1.0,0.0);
    if (k == 2) return mat2(-1.0,0.0,0.0,-1.0);
    return            mat2(0.0,1.0,-1.0,0.0);
}

// signed distance to a ring (circle outline)
float sdRing(vec2 p, float r, float w) {
    // distance to circle of radius r, thickness w
    return abs(length(p) - r) - w;
}

// AA helper
float aa(float d, float w) {
    // smoothstep around zero with pixel-width aware smoothing
    float px = fwidth(d) * 0.7;
    return smoothstep(w + px, w - px, d);
}

// palette (two tones)
vec3 palette(float t) {
    vec3 a = vec3(0.12, 0.14, 0.18); // background
    vec3 b = vec3(0.92, 0.78, 0.45); // light rope
    vec3 c = vec3(0.35, 0.80, 0.95); // alt rope
    return mix(b, c, t);
}

// -------------------- main --------------------
void main() {
    // normalized coords: keep aspect
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // parameters to tweak
    float zoom      = 6.0;     // tiles per screen height
    float pipeW     = 0.085;   // pipe half-thickness
    float gap       = 0.018;   // gap between pipe and tile edge
    float stripeF   = 5.0;     // stripe frequency along arc
    float stripeAmp = 0.45;    // stripe contrast
    float speed     = 0.6;     // stripe scroll speed

    // tile space
    vec2  tuv = uv * zoom;
    vec2  id  = floor(tuv);
    vec2  gv  = fract(tuv) - 0.5;

    // per-tile randomness
    float n   = hash21(id);
    int   rK  = int(floor(n * 4.0));         // 0..3 rotation
    float pick = step(0.5, fract(n * 7.0));  // choose tile variant

    // rotate local coords by 0/90/180/270 so the set is isotropic
    gv = rot90(rK) * gv;

    // --- tile recipe (two quarter-circle "pipes") ---
    // Variant A (classic quarter-arc corners in opposing corners)
    // Variant B (the other diagonal) chosen via 'pick'
    vec2 c0 = mix(vec2(-0.5 + gap, -0.5 + gap), vec2(-0.5 + gap,  0.5 - gap), pick);
    vec2 c1 = mix(vec2( 0.5 - gap,  0.5 - gap), vec2( 0.5 - gap, -0.5 + gap), pick);

    // ring SDFs for both arcs
    float r = 0.5 - gap;
    float d0 = sdRing(gv - c0, r, pipeW);
    float d1 = sdRing(gv - c1, r, pipeW);

    // keep only quarter arcs (mask by quadrant)
    // Keep angles that stay within the tile corner 90°
    vec2 v0 = normalize(gv - c0);
    vec2 v1 = normalize(gv - c1);

    // corner normals (pointing roughly to the center)
    vec2 n0 = normalize(vec2( 1.0,  1.0)) * (1.0 - pick) + normalize(vec2( 1.0, -1.0)) * pick;
    vec2 n1 = normalize(vec2(-1.0, -1.0)) * (1.0 - pick) + normalize(vec2(-1.0,  1.0)) * pick;

    // if dot < 0, outside the quarter we want -> discard by inflating distance
    d0 += step(0.0, -dot(v0, n0)) * 1e3;
    d1 += step(0.0, -dot(v1, n1)) * 1e3;

    // choose nearest arc; track which one for coloring / over-under
    float d  = min(d0, d1);
    float which = step(d0, d1); // 1 if d1 closer, 0 if d0 closer

    // base visibility of pipe (alpha-like mask)
    float pipeMask = aa(d, 0.0);

    // --- woven over/under effect ---
    // use checkerboard + which to alternate stacking
    float parity = mod(id.x + id.y, 2.0);
    float over   = step(0.5, abs(which - parity)); // 1.0 if "over", 0.0 if "under"

    // subtle drop shadow where under
    float shadow = smoothstep(0.02, 0.0, d) * (1.0 - over) * 0.55;

    // --- stripes flowing along arcs ---
    // azimuth angle around the corresponding center
    vec2  pc = mix(gv - c0, gv - c1, which);
    float ang = atan(pc.y, pc.x);           // -pi..pi
    float t   = u_time * speed;
    float stripe = 0.5 + 0.5 * sin(ang * stripeF + t * 6.2831853);

    // mix color per-arc so two families of pipes pop apart
    vec3 baseCol = palette(which);
    // apply stripes inside the pipe only
    baseCol *= mix(1.0 - stripeAmp, 1.0, stripe * pipeMask);

    // simple rim light (fake normal from gradient)
    float rim = smoothstep(0.015, 0.0, abs(d + pipeW) - 0.002) * 0.25;

    // background
    vec3 bg = vec3(0.08, 0.09, 0.11);
    // subtle grid backdrop
    vec2 g = abs(fract(tuv) - 0.5);
    float grid = smoothstep(0.49, 0.495, max(g.x, g.y));
    bg = mix(bg, bg * 0.6, grid * 0.5);

    // compose
    vec3 col = bg;
    col = mix(col, baseCol, pipeMask);
    // shading passes
    col *= 1.0 - shadow;
    col += rim * pipeMask;

    gl_FragColor = vec4(col, 1.0);
}
