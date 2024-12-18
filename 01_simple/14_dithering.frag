#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float bayerDither(vec2 coord) {
    // Scale down coords to enlarge the dithering pattern visually
    vec2 scaledCoord = coord * 0.5;
    ivec2 pos = ivec2(mod(floor(scaledCoord), 4.0));
    int x = pos.x;
    int y = pos.y;

    // 4x4 Bayer matrix
    if (y == 0) {
        if (x == 0) return  0.0/16.0;
        if (x == 1) return  8.0/16.0;
        if (x == 2) return  2.0/16.0;
        if (x == 3) return 10.0/16.0;
    } else if (y == 1) {
        if (x == 0) return 12.0/16.0;
        if (x == 1) return  4.0/16.0;
        if (x == 2) return 14.0/16.0;
        if (x == 3) return  6.0/16.0;
    } else if (y == 2) {
        if (x == 0) return  3.0/16.0;
        if (x == 1) return 11.0/16.0;
        if (x == 2) return  1.0/16.0;
        if (x == 3) return  9.0/16.0;
    } else {
        if (x == 0) return 15.0/16.0;
        if (x == 1) return  7.0/16.0;
        if (x == 2) return 13.0/16.0;
        if (x == 3) return  5.0/16.0;
    }

    return 0.0;
}

void main (void) {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 xy = 2.0 * (st - vec2(0.5, 0.5));

    float value = sqrt(max(xy.x, 0.0)) + sqrt(max(xy.y, 0.0));
    // Using max() to avoid NaNs if x or y < 0.0.
    // If you really want negative coords with sqrt, consider another approach,
    // but for now this ensures visible results.

    // Get dithering threshold
    float threshold = bayerDither(gl_FragCoord.xy);
    // Apply a strong influence to the threshold (center around zero, amplify)
    // This shifts the boundary around 1.0 by up to about ±0.25 depending on the pixel.
    float shift = (threshold - 0.5) * 0.5;

    vec3 color;
    if (value > 1.0 + shift) {
        color = vec3(0.0, 0.0, 0.0);
    } else {
        color = vec3(1.0, 0.0, 0.0);
    }

    gl_FragColor = vec4(color, 1.0);
}
