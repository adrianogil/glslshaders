#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    vec2 xy = 2.0 * (st - vec2(0.5, 0.5));

    float value = sqrt(xy.x) + sqrt(xy.y);

    vec3 color = vec3(value, 0.0, 0.0);

    if (value > 1.0)
    {
        color = vec3(0.0);
    } else
    {
        color = vec3(1.0, 0.0, 0.0);
    }

    gl_FragColor = vec4(color,1.0);
}
