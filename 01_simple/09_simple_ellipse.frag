#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;


float ellipse(vec2 uv, vec2 center, float a, float b)
{
    return ( pow(uv.x - center.x, 2.0) / pow(a, 2.0) + 
             pow(uv.y - center.y, 2.0) / pow(b, 2.0));
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float scale = 1.0;

    vec2 uv = scale * 2.0 * (st - vec2(0.5, 0.5));

    float value = ellipse(uv, vec2(0, 0), 0.2, 0.1);

    vec3 color = vec3(value, 0.0, 0.0);

    if (abs(value) <= 1.0)
    {
        color = vec3(value, 0.0, 0.0);
    } else
    {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color,1.0);
}
