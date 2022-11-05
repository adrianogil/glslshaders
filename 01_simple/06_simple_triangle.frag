#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;


float crossSign(vec2 p1, vec2 p2, vec2 p3)
{
     return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

float triangle(vec2 uv, vec2 center, vec2 p1, vec2 p2, vec2 p3)
{
    p1 = p1 + center;
    p2 = p2 + center;
    p3 = p3 + center;

    float d1 = crossSign(uv, p1, p2);
    float d2 = crossSign(uv, p2, p3);
    float d3 = crossSign(uv, p3, p1);

    if (((d1 < 0.0) || (d2 < 0.0) || (d3 < 0.0)) && 
        ((d1 > 0.0) || (d2 > 0.0) || (d3 > 0.0))) {
         return 0.0;
    }

    return 0.5;
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float scale = 1.0;

    vec2 uv = scale * 2.0 * (st - vec2(0.5, 0.5));

    float value = triangle(uv, vec2(0, 0), vec2(0, 0.5), vec2(0.2, 0.2), vec2(-0.6, -0.2));

    vec3 color = vec3(value, 0.0, 0.0);

    if (abs(value) > 0.1)
    {
        color = vec3(value, 0.0, 0.0);
    } else
    {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color,1.0);
}
