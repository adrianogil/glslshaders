#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2  u_resolution;

void main(){
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 pos = uv * 2.0 - 1.0;
    // correct aspect
    pos.x *= u_resolution.x / u_resolution.y;

    // convert to polar coords
    float r = length(pos);
    float a = atan(pos.y, pos.x);

    // add a time + radius‐dependent twist
    float twist = (1.0 - r) * 5.0   // stronger near center
                + u_time * 0.5;    // continuous spin
    a += twist;

    // reconstruct warped position (not actually used for color,
    // but shows how you’d sample a texture or noise)
    vec2 warped = r * vec2(cos(a), sin(a));

    // build a simple stripe pattern
    float stripes = sin(10.0 * r - u_time * 4.0 + a * 3.0);

    // pick two colors and mix
    vec3 col1 = vec3(0.2784, 0.2078, 0.4745);
    vec3 col2 = vec3(1.0, 0.6, 0.1);
    vec3 color = mix(col1, col2, stripes * 0.5 + 0.5);

    // fade out at the edge
    float edge = smoothstep(1.0, 0.4, r);
    color *= edge;

    // output
    gl_FragColor = vec4(color, 1.0);
}
