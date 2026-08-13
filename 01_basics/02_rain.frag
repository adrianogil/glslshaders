#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float Hash21(vec2 p)
{
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);

    return fract(p.x*p.y);
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float alpha = 0.9;

    float b = st.y - (alpha * st.x);
    float small_b2 = fract(b / 0.03);
    float small_b1 = fract(b / 0.025);

    vec3 color = vec3(1.0);

    float p = Hash21(vec2(b, 0.0));
    float p2 = Hash21(vec2(small_b2, small_b2));

    if (small_b2 > 0.6)
    {
        if (st.x > p2 || st.y > p2)
        {
            if (p > 0.5)
            {
                color = vec3(sin(b + 0.5*p), 0.0, 0.0);
            }
        }

    }

    gl_FragColor = vec4(color,1.0);
}