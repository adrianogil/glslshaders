#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

// Random color point structure
struct RandomColorPoint {
    vec3 position;
    float size;
    vec3 color;
};

float rand(vec2 n) {  
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

// Generate a random number [0, 1)
float random(in float seed) {
    return fract(sin(seed) * 43758.5453);
}

// Create a new star
RandomColorPoint createRandomColorPoint(in float seed) {
    RandomColorPoint randomColorPoint;
    randomColorPoint.position = vec3(random(seed) * 2.0 - 1.0, random(seed + 1000.0) * 2.0 - 1.0, random(seed + 2000.0));
    randomColorPoint.size = random(seed + 3000.0) * 0.01;
    randomColorPoint.color = vec3(random(seed + 4000.0), random(seed + 4500.0), random(seed + 4800.0));
    return randomColorPoint;
}

// Draw a star
vec3 drawColorPoint(in RandomColorPoint randomColorPoint, in vec2 uv) {
    float dist = length(uv - randomColorPoint.position.xy);
    float intensity = 0.0;
    if (dist < randomColorPoint.size) {
        intensity = 1.0;
    }
    return randomColorPoint.color * intensity;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 color = vec3(0.0);

    for (float i = 0.0; i < 100.0; i++) {
        RandomColorPoint randomColorPoint = createRandomColorPoint(i * 12345.6789 + u_time * 50.0);
        color += drawColorPoint(randomColorPoint, uv);
    }

    gl_FragColor = vec4(color, 1.0);
}