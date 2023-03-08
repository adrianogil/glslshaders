#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 p = gl_FragCoord.xy/400.;

    vec2 c1 = vec2(sin(u_time)+0.5, cos(u_time)+0.8);
    vec2 c2 = vec2(cos(u_time)+0.9, sin(u_time)+0.4);
    vec2 c3 = vec2(sin(2.0 * u_time), cos(2.0 * u_time));

    float d1 = distance(p, c1);
    float d2 = distance(p, c2);
    float d3 = distance(p, c3);

    gl_FragColor = vec4(
        d1 * cos(p.x+p.y+sin(u_time)),
        d2 * sin(p.x-p.y+cos(u_time)),
        d3 * cos(p.x+p.y+u_time),
        1.);
}
