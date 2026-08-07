// Chromatic Fault.
// Standalone GLSL adaptation of the procedural Ren'Py shader PoC.
#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

void main(void) {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 position = uv * 2.0 - 1.0;
    position.x *= u_resolution.x / max(u_resolution.y, 1.0);

    float time = u_time * 0.32;
    float warp = sin(position.y * 7.0 + time * 2.1) * 0.10;
    warp += cos(position.x * 5.0 - time * 1.3) * 0.07;

    float radius = length(position + vec2(warp, -warp * 0.4));
    float rings = 0.5 + 0.5 * sin((radius * 4.5 - time) * 9.0);
    rings = smoothstep(0.30, 0.98, rings) * exp(-radius * 0.75);

    float scanlines = 0.86 + 0.14 * sin(uv.y * u_resolution.y + u_time * 18.0);
    float core = 1.0 - smoothstep(0.0, 0.34, radius);

    vec3 background = vec3(0.015, 0.008, 0.045);
    vec3 magenta = vec3(0.95, 0.18, 0.75);
    vec3 color = background + magenta * (rings * scanlines + core * 0.8);

    gl_FragColor = vec4(color, 1.0);
}
