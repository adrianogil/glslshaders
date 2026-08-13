#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

// Simple distance function for a circle
float circle(vec2 uv, vec2 pos, float rad) {
    return length(uv - pos) - rad;
}

void main(void)
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.y = uv.y * 2.0 - 1.0; // [-1, 1] range for y
    uv.x = uv.x * 2.0 - 1.0; // [-1, 1] range for x
    
    // A main body wave
    float wave = 0.3 * sin(5.0 * uv.x + u_time*0.5);
    
    // Create a 'spine' of the dragon
    float spine = smoothstep(0.03, 0.035, abs(uv.y - wave));
    
    // Create head of the dragon using a circle
    float head = circle(uv, vec2(mod(u_time-0.8, 2.0)-0.8, wave + 0.05), 0.1);
    float headMask = step(0.0, head);
    
    // Combine the body and the head
    float dragon = max(spine, headMask);
    
    vec3 col = dragon > 0.5 ? vec3(0.0) : vec3(1.0);
    
    gl_FragColor = vec4(col, 1.0);
}