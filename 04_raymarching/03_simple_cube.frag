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

float fmod(float a, float b) {
    if (a < 0.0) {
        return b - mod(abs(a), b);
    }
    return mod(a, b);
}

float udBox(vec3 p, vec3 c, vec3 b) {
    return length(max(abs(p - c) - b, 0.0));
}

vec2 scene(vec3 position) {
    // Rotate cube around the y-axis based on time
    float angle = u_time;
    mat2 rot = mat2(cos(angle), -sin(angle),
                    sin(angle),  cos(angle));

    // Apply rotation to position
    vec3 p = position;
    p.xz = rot * p.xz;

    // Single cube centered at origin, half-size 0.5
    float distance = udBox(p, vec3(0.0), vec3(0.25));
    float materialID = 1.0;
    return vec2(distance, materialID);
}

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

void main(void) {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 direction = normalize(vec3(uv, 2.5));
    vec3 camera_origin = vec3(0.0, 0.0, -2.5);

    vec2 result = raymarch(camera_origin, direction);

    vec3 materialColor = vec3(0.0);
    if (result.y == 1.0) {
        vec3 hitPos = camera_origin + direction * result.x;
        vec3 normal = calcNormal(hitPos);

        // Compute edge factor
        float edgeFactor = length(dFdx(normal)) + length(dFdy(normal));

        // Faces as white, edges as black
        // Increase the multiplier if you need sharper edges
        materialColor = mix(vec3(1.0), vec3(0.0), smoothstep(0.1, 0.4, edgeFactor));
    }

    gl_FragColor = vec4(materialColor, 1.0);
}
