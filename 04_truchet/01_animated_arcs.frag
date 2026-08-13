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

void main(void)
{
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy)/u_resolution.xy;

    vec3 col = vec3(0);

    uv += u_time * 0.2;
    uv *= 10.;
    vec2 gv = fract(uv) - 0.5;
    vec2 id = floor(uv);

    float n = Hash21(id); //random number between 0 and 1
    float width = 0.2;

    if (n < 0.5) gv.x *= -1.; // random flip

    // Lines
    // float d = abs(abs(gv.x + gv.y) - 0.5);
    //float mask = smoothstep(0.01, -0.01, d - width);

    // Curves
    float d = abs(abs(gv.x + gv.y) - 0.5);
    vec2 cUv = gv - sign(gv.x + gv.y + 0.001) * 0.5;
    d = length(cUv);
    float mask = smoothstep(0.01, -0.01, abs(d - 0.5) - width);
    float angle = atan(cUv.x, cUv.y); // -pi to pi
    float checker = mod(id.x + id.y, 2.) * 2.0 - 1.0;
    float flow = sin(u_time + checker*angle * 10.0);

    float x = fract(angle / 1.57);
    float y = (d - (0.5 - width)) / (2.0 * width);
    y = abs(y - 0.5) * 2.0;

    vec2 tUv = vec2(x, y);
    col.rg += tUv * mask;
    //col.rg += id *.2;
    //col += n;
    // col += checker;

    // if (gv.x > 0.48 || gv.y > 0.48) col = vec3(1,0,0);

    gl_FragColor = vec4(col,1.0);
}