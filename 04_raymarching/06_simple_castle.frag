#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define MAX_STEPS 112
#define MAX_DISTANCE 32.0
#define SURFACE_DISTANCE 0.002

const float MATERIAL_GROUND = 1.0;
const float MATERIAL_STONE = 2.0;
const float MATERIAL_WOOD = 3.0;
const float MATERIAL_WINDOW = 4.0;

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float radius, float halfHeight) {
    vec2 q = abs(vec2(length(p.xz), p.y)) - vec2(radius, halfHeight);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

vec2 unionScene(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
}

vec2 addBox(vec2 scene, vec3 p, vec3 center, vec3 halfSize, float material) {
    return unionScene(scene, vec2(sdBox(p - center, halfSize), material));
}

vec2 addTower(vec2 scene, vec3 p, vec3 center) {
    scene = unionScene(scene, vec2(sdCylinder(p - center, 0.38, 1.25), MATERIAL_STONE));

    // Eight simple blocks make the tower's crown read as crenellations.
    for (int i = 0; i < 8; ++i) {
        float angle = 6.2831853 * float(i) / 8.0;
        vec3 blockCenter = center + vec3(cos(angle) * 0.31, 1.34, sin(angle) * 0.31);
        scene = addBox(scene, p, blockCenter, vec3(0.14, 0.15, 0.14), MATERIAL_STONE);
    }

    return scene;
}

// Material IDs: ground = 1, stone = 2, wood = 3, window = 4.
vec2 scene(vec3 p) {
    vec2 result = vec2(p.y + 1.0, MATERIAL_GROUND);

    // Central keep and four round towers.
    result = addBox(result, p, vec3(0.0, -0.05, 0.0), vec3(1.18, 0.95, 0.58), MATERIAL_STONE);
    result = addTower(result, p, vec3(-1.12, 0.25, -0.45));
    result = addTower(result, p, vec3( 1.12, 0.25, -0.45));
    result = addTower(result, p, vec3(-1.12, 0.25,  0.45));
    result = addTower(result, p, vec3( 1.12, 0.25,  0.45));

    // Crenellations along the front and back walls of the keep.
    for (int i = 0; i < 6; ++i) {
        float x = -0.92 + float(i) * 0.37;
        result = addBox(result, p, vec3(x, 1.05, -0.48), vec3(0.13, 0.16, 0.14), MATERIAL_STONE);
        result = addBox(result, p, vec3(x, 1.05,  0.48), vec3(0.13, 0.16, 0.14), MATERIAL_STONE);
    }

    // A raised gate, plus dark slit windows applied as thin facade details.
    result = addBox(result, p, vec3(0.0, -0.53, -0.61), vec3(0.28, 0.40, 0.035), MATERIAL_WOOD);
    result = addBox(result, p, vec3(-0.52, 0.12, -0.61), vec3(0.10, 0.18, 0.035), MATERIAL_WINDOW);
    result = addBox(result, p, vec3( 0.52, 0.12, -0.61), vec3(0.10, 0.18, 0.035), MATERIAL_WINDOW);
    result = addBox(result, p, vec3(-1.12, 0.45, -0.83), vec3(0.08, 0.20, 0.035), MATERIAL_WINDOW);
    result = addBox(result, p, vec3( 1.12, 0.45, -0.83), vec3(0.08, 0.20, 0.035), MATERIAL_WINDOW);

    return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
    float distanceTravelled = 0.0;

    for (int i = 0; i < MAX_STEPS; ++i) {
        vec2 sample = scene(origin + direction * distanceTravelled);
        if (sample.x < SURFACE_DISTANCE) {
            return vec2(distanceTravelled, sample.y);
        }

        distanceTravelled += sample.x;
        if (distanceTravelled > MAX_DISTANCE) {
            break;
        }
    }

    return vec2(MAX_DISTANCE, 0.0);
}

vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(0.001, -0.001);
    return normalize(
        e.xyy * scene(p + e.xyy).x +
        e.yyx * scene(p + e.yyx).x +
        e.yxy * scene(p + e.yxy).x +
        e.xxx * scene(p + e.xxx).x
    );
}

float softShadow(vec3 origin, vec3 direction) {
    float shade = 1.0;
    float distanceTravelled = 0.04;

    for (int i = 0; i < 28; ++i) {
        float h = scene(origin + direction * distanceTravelled).x;
        if (h < SURFACE_DISTANCE) {
            return 0.12;
        }
        shade = min(shade, 12.0 * h / distanceTravelled);
        distanceTravelled += clamp(h, 0.04, 0.35);
        if (distanceTravelled > 10.0) {
            break;
        }
    }

    return clamp(shade, 0.12, 1.0);
}

vec3 materialColor(float material, vec3 p) {
    if (material == MATERIAL_GROUND) {
        float grass = 0.08 * sin(p.x * 3.0) * sin(p.z * 3.0);
        return vec3(0.18, 0.28, 0.12) + grass;
    }
    if (material == MATERIAL_WOOD) {
        float grain = 0.08 * sin(p.y * 36.0);
        return vec3(0.25, 0.11, 0.045) + grain;
    }
    if (material == MATERIAL_WINDOW) {
        return vec3(0.035, 0.045, 0.07);
    }

    float stoneVariation = 0.08 * sin(p.x * 7.0) * sin(p.y * 9.0) * sin(p.z * 5.0);
    return vec3(0.38, 0.40, 0.42) + stoneVariation;
}

mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

void main(void) {
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;

    // Gently orbit the keep; moving the mouse horizontally can inspect the sides.
    float orbit = u_time * 0.02 + (u_mouse.x / max(u_resolution.x, 1.0) - 0.5) * 1.1;
    vec3 cameraOrigin = vec3(0.0, 0.35, -5.3);
    cameraOrigin.xz = rotate(orbit) * cameraOrigin.xz;
    vec3 target = vec3(0.0, 0.05, 0.0);
    vec3 forward = normalize(target - cameraOrigin);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 direction = normalize(forward * 1.8 + right * uv.x + up * uv.y);

    vec2 hit = raymarch(cameraOrigin, direction);
    vec3 sky = mix(vec3(0.10, 0.16, 0.27), vec3(0.50, 0.67, 0.78), clamp(direction.y * 0.75 + 0.45, 0.0, 1.0));
    vec3 color = sky;

    if (hit.y > 0.0) {
        vec3 position = cameraOrigin + direction * hit.x;
        vec3 normal = calcNormal(position);
        vec3 lightDirection = normalize(vec3(-0.7, 0.9, -0.5));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float shadow = softShadow(position + normal * 0.01, lightDirection);
        float ambient = 0.18 + 0.12 * max(normal.y, 0.0);
        float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0) * 0.14;

        color = materialColor(hit.y, position) * (ambient + diffuse * shadow * 0.75) + rim;
        color = mix(color, sky, 1.0 - exp(-0.008 * hit.x * hit.x));
    }

    color = pow(color, vec3(0.4545));
    gl_FragColor = vec4(color, 1.0);
}
