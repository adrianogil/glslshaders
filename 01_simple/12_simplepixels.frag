#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {
    vec2 pixelSize = 1.0 / u_resolution;      // Size of one pixel in normalized coordinates
    vec2 lineSize = 50.0 * pixelSize;

    // Snap the coordinates to 10-pixel blocks
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 snappedUV = floor(uv / lineSize) * lineSize;

    // Create color based on snapped coordinates
    vec3 color = vec3(snappedUV, 0.0);

    gl_FragColor = vec4(color, 1.0);
}
