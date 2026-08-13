#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;


void main (void) {
    vec2 p = gl_FragCoord.xy/400.;
    gl_FragColor = vec4(
        cos(p.x+p.y+sin(u_time)),
        sin(p.x-p.y+cos(u_time)),
        cos(p.x+p.y+u_time),
        1.);
}
