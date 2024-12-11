#ifdef GL_ES
precision mediump float;
#extension GL_OES_standard_derivatives : enable
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define NEAR_CLIPPING_PLANE 0.1
#define FAR_CLIPPING_PLANE 100.0
#define NUMBER_OF_MARCH_STEPS 40
#define EPSILON 0.01
#define DISTANCE_BIAS 0.7

// Helper functions
float fmod(float a, float b) {
    if (a < 0.0) {
        return b - mod(abs(a), b);
    }
    return mod(a, b);
}

// Signed distance to a sphere
float sdSphere(vec3 p, vec3 c, float s) {
    return length(p - c) - s;
}

// Scene setup: sun, earth, moon
// Material IDs: 1 = Sun, 2 = Earth, 3 = Moon
vec2 scene(vec3 position) {
    // Orbital parameters
    float earthOrbitRadius = 1.5;
    float earthSpeed = 0.3;
    float moonOrbitRadius = 0.4;
    float moonSpeed = 1.0;

    vec3 sunPos   = vec3(0.0, 0.0, 0.0);
    vec3 earthPos = vec3(earthOrbitRadius * cos(u_time * earthSpeed), 0.0, earthOrbitRadius * sin(u_time * earthSpeed));
    vec3 moonPos  = earthPos + vec3(moonOrbitRadius * cos(u_time * moonSpeed), 0.0, moonOrbitRadius * sin(u_time * moonSpeed));

    float dSun   = sdSphere(position, sunPos,   0.4);
    float dEarth = sdSphere(position, earthPos, 0.2);
    float dMoon  = sdSphere(position, moonPos,  0.1);

    float dist = dSun;
    float id   = 1.0;

    if (dEarth < dist) {
        dist = dEarth;
        id = 2.0;
    }

    if (dMoon < dist) {
        dist = dMoon;
        id = 3.0;
    }

    return vec2(dist, id);
}

// Raymarching
vec2 raymarch(vec3 position, vec3 direction) {
    float total_distance = NEAR_CLIPPING_PLANE;
    for (int i = 0; i < NUMBER_OF_MARCH_STEPS; ++i) {
        vec2 result = scene(position + direction * total_distance);
        if (result.x < EPSILON) {
            return vec2(total_distance, result.y);
        }
        total_distance += result.x * DISTANCE_BIAS;
        if (total_distance > FAR_CLIPPING_PLANE)
            break;
    }
    return vec2(FAR_CLIPPING_PLANE, 0.0);
}

// Calculate normal via gradient
vec3 calcNormal(vec3 pos) {
    float delta = 0.001;
    vec3 dx = vec3(delta, 0.0, 0.0);
    vec3 dy = vec3(0.0, delta, 0.0);
    vec3 dz = vec3(0.0, 0.0, delta);

    float nx = scene(pos + dx).x - scene(pos - dx).x;
    float ny = scene(pos + dy).x - scene(pos - dy).x;
    float nz = scene(pos + dz).x - scene(pos - dz).x;

    return normalize(vec3(nx, ny, nz));
}

// Procedural color for each object
// Simple patterns using sine/cosine to give some variation
vec3 sunColor(vec3 p) {
    // Bright and warm
    float pattern = sin(p.x*10.0 + u_time*2.0)*0.1 + 0.9;
    return vec3(pattern, pattern*0.9, 0.2);
}

vec3 earthColor(vec3 p) {
    // Earth: green and blue patches
    float lat = sin(p.z*5.0 + p.x*5.0 + u_time*0.5);
    float colFactor = (lat * 0.5 + 0.5);
    // Blend ocean (blue) and land (green)
    vec3 land = vec3(0.1, 0.5, 0.1);
    vec3 ocean = vec3(0.0, 0.2, 0.5);
    return mix(ocean, land, colFactor);
}

vec3 moonColor(vec3 p) {
    // Moon: grayscale with subtle variation
    float pattern = sin((p.x + p.z)*20.0 + u_time)*0.1;
    return vec3(0.5 + pattern);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 direction = normalize(vec3(uv, 2.5));
    vec3 camera_origin = vec3(0.0, 0.0, -3.5);

    vec2 result = raymarch(camera_origin, direction);

    vec3 color = vec3(0.0);

    if (result.y > 0.0) {
        vec3 hitPos = camera_origin + direction * result.x;
        vec3 normal = calcNormal(hitPos);

        // Simple directional light from one side
        vec3 lightDir = normalize(vec3(1.0, 0.5, 0.5));
        float diff = max(dot(normal, lightDir), 0.0);

        // Assign colors based on material ID
        if (result.y == 1.0) {
            color = sunColor(hitPos)* (0.7 + 0.3*diff);
        } else if (result.y == 2.0) {
            color = earthColor(hitPos) * (0.4 + 0.6*diff);
        } else if (result.y == 3.0) {
            color = moonColor(hitPos) * (0.4 + 0.6*diff);
        }
    } else {
        // Improved background with scattered stars
        // Scale factor for star field density
        float scaleFactor = 100.0;
        vec2 st = uv * scaleFactor;
        // Take the floor to get grid cell coordinates
        vec2 grid = floor(st);

        // Simple hash for pseudo-randomness
        float hashVal = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);

        // Threshold to determine which cells contain a star
        float starThreshold = 0.995;
        float starPresent = step(starThreshold, hashVal);

        // Add some subtle variation in brightness or color
        float brightness = mix(0.8, 1.0, hashVal);

        // Combine with existing color:
        // If there's a star, we add a bright pixel, else remain background
        vec3 starColor = vec3(brightness);
        vec3 bgColor = vec3(0.0); // dark background
        color = mix(bgColor, starColor, starPresent);
    }

    gl_FragColor = vec4(color, 1.0);
}
