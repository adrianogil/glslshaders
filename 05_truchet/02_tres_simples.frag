// Based on https://www.desmos.com/calculator/zoztpexlvh
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    
    float scale = 8.0;

    vec2 xy = scale * 2.0 * (st - vec2(0.5, 0.5));

    float x1 = floor(xy.x);
    float y1 = floor(xy.y);

    float n = sign(mod(1234.23 * sin(x1 * 153.23 * 3.14 / 180.0 + y1 * 167.342 * 3.14 / 180.0), 1.0) - 0.5);

    float u = (xy.x - x1 - 0.5) * n;
    float v = xy.y - y1 - 0.5;

    float s = 0.5 * sign(u + v);

    float tr = abs(sqrt((u - s) * (u - s) + (v - s) * (v - s)) - 0.5) - 0.1;

    vec3 color = vec3(0.0);

    if (tr < 0.0)
    {
        color = vec3(st.xy, 0.0);
    }

    gl_FragColor = vec4(color,1.0);
}