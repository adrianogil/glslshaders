#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float square(vec2 uv, vec2 center, float size) {
    float diffx = abs(uv.x - center.x);
    float diffy = abs(uv.y - center.y);
    if (diffx <= size && diffy <= size) {
        return 0.1 + 0.9 * max(diffx, diffy) / 0.2;
    }
    return 0.0;
}

float bayerDither(vec2 coord) {
    ivec2 pos = ivec2(mod(floor(coord), 4.0));
    int x = pos.x;
    int y = pos.y;


    if (y == 0) {
        if (x == 0) return 0.0/16.0;
        if (x == 1) return 8.0/16.0;
        if (x == 2) return 2.0/16.0;
        if (x == 3) return 10.0/16.0;
    } else if (y == 1) {
        if (x == 0) return 12.0/16.0;
        if (x == 1) return 4.0/16.0;
        if (x == 2) return 14.0/16.0;
        if (x == 3) return 6.0/16.0;
    } else if (y == 2) {
        if (x == 0) return 3.0/16.0;
        if (x == 1) return 11.0/16.0;
        if (x == 2) return 1.0/16.0;
        if (x == 3) return 9.0/16.0;
    } else { // y == 3
        if (x == 0) return 15.0/16.0;
        if (x == 1) return 7.0/16.0;
        if (x == 2) return 13.0/16.0;
        if (x == 3) return 5.0/16.0;
    }

    return 0.0; // Default fallback
}

void main(void) {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 uv = 2.0 * (st - 0.5);

    float scale = 3.0;
    uv *= (1.0/scale);

    float value = square(uv, vec2(0,0), 0.2);

    if (value > 0.0) {
        float threshold = bayerDither(gl_FragCoord.xy);
        float quantized = floor((value + threshold * 0.2) * 2.0) / 2.0;
        gl_FragColor = vec4(quantized, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = vec4(0.0);
    }
}
