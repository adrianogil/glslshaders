#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float scale = 2.0;

    vec2 xy = scale * 2.0 * (st - vec2(0.5, 0.5));

    float value = pow(xy.x, 4.0) - 2.0 * pow(xy.x, 2.0) + 
                  pow(xy.y, 4.0) - 2.0 * pow(xy.y, 2.0);

    vec3 color = vec3(value, 0.0, 0.0);

    if (abs(value) < 0.5)
    {
        color = vec3(1.0, 0.0, 0.0);
    } else
    {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color,1.0);
}
