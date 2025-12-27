#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void main() {
    vec2 position = (gl_FragCoord.xy / u_resolution.xy) - vec2(0.5);
    float strength = (0.9 + 0.2*sin(u_time)) - sqrt(dot(position, position));
    strength = pow(strength, 3.0);

    vec3 color = vec3(1.5, 0.2, 0.0) * strength;

    float noise = rand(vec2(u_time, position.y * 50.0)) * strength;
    color += noise * vec3(2.0, 1.0, 0.0);

    gl_FragColor = vec4(color, 1.0);
}