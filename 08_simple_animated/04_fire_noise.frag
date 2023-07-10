#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main(){
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    vec3 color = vec3(0.0);

    // Gradient colors
    vec3 topColor = vec3(1.0,0.0,0.0);
    vec3 bottomColor = vec3(0.0,0.0,1.0);

    // Interpolate between the two colors based on y position
    color = mix(bottomColor, topColor, st.y);

    // Add a sin wave over time and space
    float wave = sin(st.y * 20.0 + u_time * 2.0);
    color += vec3(wave, wave, wave);

    gl_FragColor = vec4(color,1.0);
}