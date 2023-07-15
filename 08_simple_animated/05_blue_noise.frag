#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float rand(vec2 n) {  
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 st) {
    vec2 ipos = floor(st);  // integer
    vec2 fpos = fract(st); // fraction

    // random values at the corners of the cell using permutation formula
    float a = rand(ipos);
    float b = rand(ipos + vec2(1.0, 0.0));
    float c = rand(ipos + vec2(0.0, 1.0));
    float d = rand(ipos + vec2(1.0, 1.0));

    // smooth interpolation between the values:
    vec2 cubic = fpos*fpos*(3.0-2.0*fpos);

    // interpolate across x
    float ab = mix(a, b, cubic.x);
    float cd = mix(c, d, cubic.x);

    // interpolate across y
    float result = mix(ab, cd, cubic.y);

    return result; // return final noise value
}

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.x *= u_resolution.x/u_resolution.y;

    vec3 color = vec3(0.0);
    vec2 pos = vec2(st*3.0-u_time/15.0);

    // Create blue noise
    float water = 0.0;
    water += 0.6*noise(pos);
    pos = pos*2.0;
    water += 0.5*noise(pos);
    pos = pos*2.0;
    water += 0.3*noise(pos);
    pos = pos*2.0;
    water += 0.1*noise(pos);

    color = vec3(0.0, 0.0, 0.05) + water*vec3(0.1, 0.5, 0.8);

    gl_FragColor = vec4(color,1.0);
}