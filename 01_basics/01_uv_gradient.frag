#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    vec3 color = vec3(st, 0.0);

    gl_FragColor = vec4(color,1.0);
}