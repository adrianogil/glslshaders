// Based on https://inspirnathan.com/posts/51-shadertoy-tutorial-part-5/

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

// Returns the distance from point p to the line segment from a to b
float lineSegmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba*h);
}

// Function to draw a line from p1 to p2
float drawLine(vec2 p, vec2 p1, vec2 p2, float width) {
    float d = lineSegmentDistance(p, p1, p2);
    return smoothstep(width, 0.0, d);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy; // <0, 1>
    uv = uv * 2.0 - 1.0; // Convert to [-1, 1] range

    float lineWidth = 0.01;

    vec2 p = vec2(-0.2, -0.3);

    vec2 p1 = vec2(0.2, 0.2) + p;
    vec2 p2 = vec2(0.2, 0.4) + p;
    vec2 p3 = vec2(0.35, 0.2) + p;
    vec2 p4 = vec2(0.35, 0.55) + p;
    vec2 p5 = vec2(0.5, 0.2) + p;
    vec2 p6 = vec2(0.5, 0.4) + p;
    vec2 p7 = vec2(0.2, 0.22) + p;
    vec2 p8 = vec2(0.5, 0.22) + p;
    float lineMask = drawLine(uv, p1, p2, lineWidth) + 
                     drawLine(uv, p3, p4, lineWidth) + 
                     drawLine(uv, p5, p6, lineWidth) + 
                     drawLine(uv, p7, p8, lineWidth);

    
    
    vec3 color = mix(vec3(1.0), vec3(0.0, 0.5, 0.8), lineMask);
    
    gl_FragColor = vec4(color,1.0);
}
