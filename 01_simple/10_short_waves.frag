#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;


void main(void)
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = gl_FragCoord.xy/u_resolution.xy * 2.0 - 1.0; // Convert to [-1, 1] range
    
    float len = length(uv);
    float wave = sin(uv.y * 10.0 + sin(uv.x * 20.0) * 0.5);
    
    float dragon = smoothstep(0.1, 0.12, wave - len);
    
    // Create shadow color based on the dragon shape
    vec3 col = mix(vec3(1.0), vec3(0.1, 0.1, 0.1), dragon);
    
    gl_FragColor = vec4(col, 1.0);
}