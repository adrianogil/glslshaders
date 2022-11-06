#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float square(vec2 uv, vec2 center, float size)
{
    float diffx = abs(uv.x - center.x);
    float diffy = abs(uv.y - center.y);
    
    if (diffx <= size && diffy <= size)
    {
        return 0.1 + 0.9 * max(diffx, diffy) / 0.2;
    }
    return 0.0;
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float scale = 1.0;

    vec2 uv = scale * 2.0 * (st - vec2(0.5, 0.5));

    float value = square(uv, vec2(0, 0), 0.2);

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
