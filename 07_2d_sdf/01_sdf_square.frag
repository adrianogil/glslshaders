// Based on
// https://inspirnathan.com/posts/49-shadertoy-tutorial-part-3/
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

vec2 rotate(vec2 uv, float angle) {
    return mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * uv;
}

vec3 sdfSquare(vec2 uv, float size, vec2 offset, float angle) {

    float x = uv.x - offset.x;
    float y = uv.y - offset.y;
    vec2 rotated = rotate(vec2(x, y), angle);
    float d = max(abs(rotated.x), abs(rotated.y)) - size;

    return d > 0. ? vec3(1.) : vec3(1., 0., 0.);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy; // <0, 1>
    uv -= 0.5;
    float scale = 1.0;
    // Adjust for screen aspect ratio
    uv.x *= scale * u_resolution.x / u_resolution.y;
    
    vec2 offset = vec2(0.1, 0.0);
    vec3 col = sdfSquare(uv, 0.2, offset, u_time);

    gl_FragColor = vec4(col ,1.0);
}
