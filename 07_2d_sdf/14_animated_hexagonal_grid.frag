// Animated hexagonal grid study.
// Inspired by Andrew Hung's "Shader Art Tutorial: Hexagonal Grids".
#ifdef GL_ES
#extension GL_OES_standard_derivatives : enable
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

const float SQRT3 = 1.7320508075688772;

vec2 aspectCorrectUv(vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    return uv;
}

vec3 palette(float t) {
    vec3 a = vec3(0.18, 0.24, 0.34);
    vec3 b = vec3(0.38, 0.30, 0.46);
    vec3 c = vec3(0.72, 0.82, 0.94);
    vec3 d = vec3(0.02, 0.20, 0.36);
    return a + b * cos(6.28318 * (c * t + d));
}

float hexDistance(vec2 p) {
    p = abs(p);
    return max(dot(p, vec2(0.8660254, 0.5)), p.x);
}

vec4 hexCoords(vec2 uv, float scale) {
    vec2 p = uv * scale;
    vec2 cell = vec2(1.5, SQRT3);
    vec2 halfCell = cell * 0.5;

    vec2 localA = mod(p, cell) - halfCell;
    vec2 localB = mod(p - halfCell, cell) - halfCell;

    vec2 local = dot(localA, localA) < dot(localB, localB) ? localA : localB;
    vec2 id = p - local;

    return vec4(local, id);
}

float hexGridLine(vec2 local, float radius, float thickness) {
    float edgeDistance = abs(hexDistance(local) - radius);
    float aa = fwidth(edgeDistance) * 1.4;
    return 1.0 - smoothstep(thickness - aa, thickness + aa, edgeDistance);
}

float hexFill(vec2 local, float radius) {
    float signedDistance = hexDistance(local) - radius;
    return 1.0 - smoothstep(0.0, fwidth(signedDistance) * 1.5, signedDistance);
}

void main(void) {
    vec2 uv = aspectCorrectUv(gl_FragCoord.xy);

    float pulse = 0.5 + 0.5 * sin(u_time * 0.85);
    float scale = 4.35 + 0.35 * sin(u_time * 0.28);
    vec2 drift = vec2(0.08 * u_time, 0.05 * sin(u_time * 0.4));
    vec4 hex = hexCoords(uv + drift, scale);

    vec2 local = hex.xy;
    vec2 id = hex.zw;
    float cellWave = sin(dot(id, vec2(0.23, 0.37)) + u_time * 1.6);

    float radius = 0.48 + 0.025 * cellWave;
    float thickness = mix(0.018, 0.04, pulse);
    float line = hexGridLine(local, radius, thickness);
    float fill = hexFill(local, radius - 0.03);

    float radialGlow = 1.0 - smoothstep(0.0, 0.95, length(local));
    float waveGlow = 0.55 + 0.45 * sin(length(id) * 0.18 - u_time * 1.8);

    vec3 background = mix(vec3(0.015, 0.028, 0.055), vec3(0.05, 0.08, 0.13), uv.y * 0.5 + 0.5);
    vec3 cellColor = palette(length(id) * 0.045 + u_time * 0.06);
    vec3 lineColor = mix(vec3(0.35, 0.84, 1.0), vec3(1.0, 0.55, 0.22), pulse);

    vec3 color = background;
    color += cellColor * fill * radialGlow * 0.16;
    color += lineColor * line * (0.75 + 0.25 * waveGlow);
    color += lineColor * line * radialGlow * 0.55;

    gl_FragColor = vec4(color, 1.0);
}
