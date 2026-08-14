#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define MAX_STEPS 156
#define MAX_DISTANCE 40.0
#define SURFACE_DISTANCE 0.0015

const float MAT_GROUND = 1.0;
const float MAT_PINK = 2.0;
const float MAT_WHITE = 3.0;
const float MAT_DARK = 4.0;
const float MAT_DOME = 5.0;
const float MAT_ROOF = 6.0;
const float MAT_STONE = 7.0;

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdBox2(vec2 p, vec2 b) {
    vec2 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float sdCylinder(vec3 p, float radius, float halfHeight) {
    vec2 q = abs(vec2(length(p.xz), p.y)) - vec2(radius, halfHeight);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

float sdEllipsoid(vec3 p, vec3 radius) {
    float k0 = length(p / radius);
    float k1 = length(p / (radius * radius));
    return k0 * (k0 - 1.0) / k1;
}

float sdArchPanel(vec3 p, float width, float springY, float bottomY, float depth) {
    float vertical = sdBox2(p.xy - vec2(0.0, 0.5 * (springY + bottomY)),
                           vec2(width, 0.5 * (springY - bottomY)));
    float roundTop = length(p.xy - vec2(0.0, springY)) - width;
    float shape = min(vertical, roundTop);
    vec2 extrusion = vec2(shape, abs(p.z) - depth);
    return min(max(extrusion.x, extrusion.y), 0.0) + length(max(extrusion, 0.0));
}

vec2 unite(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
}

vec2 object(float distance, float material) {
    return vec2(distance, material);
}

vec2 addBox(vec2 scene, vec3 p, vec3 center, vec3 halfSize, float material) {
    return unite(scene, object(sdBox(p - center, halfSize), material));
}

vec2 addColumn(vec2 scene, vec3 p, vec3 center, float height) {
    vec3 q = p - center;
    scene = unite(scene, object(sdCylinder(q, 0.075, height * 0.5), MAT_WHITE));
    scene = addBox(scene, p, center - vec3(0.0, height * 0.5, 0.0), vec3(0.115, 0.055, 0.115), MAT_WHITE);
    scene = addBox(scene, p, center + vec3(0.0, height * 0.5, 0.0), vec3(0.125, 0.065, 0.125), MAT_WHITE);
    return scene;
}

vec2 scene(vec3 p) {
    vec2 result = object(p.y + 1.05, MAT_GROUND);

    // Long opera-house body and its projecting central portico.
    result = addBox(result, p, vec3(-0.45, 0.08, 0.10), vec3(2.55, 1.13, 0.72), MAT_PINK);
    result = addBox(result, p, vec3(0.78, 0.14, -0.72), vec3(1.16, 1.17, 0.34), MAT_PINK);
    result = addBox(result, p, vec3(-0.55, 1.28, 0.18), vec3(2.48, 0.09, 0.69), MAT_WHITE);
    result = addBox(result, p, vec3(-0.55, 0.48, -0.64), vec3(2.52, 0.045, 0.035), MAT_WHITE);
    result = addBox(result, p, vec3(-0.55, -0.35, -0.64), vec3(2.52, 0.045, 0.035), MAT_WHITE);
    result = addBox(result, p, vec3(-0.55, -0.92, -0.67), vec3(2.62, 0.10, 0.08), MAT_STONE);

    // Red tile roof and the famous ceramic dome on its drum.
    result = addBox(result, p, vec3(-0.62, 1.43, 0.19), vec3(1.72, 0.12, 0.63), MAT_ROOF);
    result = unite(result, object(sdCylinder(p - vec3(-0.66, 1.61, 0.20), 0.75, 0.22), MAT_DARK));
    vec3 domeP = p - vec3(-0.66, 1.79, 0.20);
    float dome = max(sdEllipsoid(domeP, vec3(0.82, 0.66, 0.72)), -domeP.y);
    result = unite(result, object(dome, MAT_DOME));
    result = unite(result, object(sdCylinder(p - vec3(-0.66, 2.48, 0.20), 0.075, 0.18), MAT_WHITE));
    result = unite(result, object(sdEllipsoid(p - vec3(-0.66, 2.68, 0.20), vec3(0.10, 0.14, 0.10)), MAT_DOME));

    // The semicircular pediment, cornices, and recessed sculptural tympanum.
    vec3 pedimentP = p - vec3(0.78, 1.35, -1.055);
    float pediment = max(sdEllipsoid(pedimentP, vec3(1.12, 0.66, 0.10)), -pedimentP.y);
    result = unite(result, object(pediment, MAT_WHITE));
    vec3 insetP = p - vec3(0.78, 1.38, -1.16);
    float inset = max(sdEllipsoid(insetP, vec3(0.91, 0.47, 0.025)), -insetP.y);
    result = unite(result, object(inset, MAT_PINK));
    result = addBox(result, p, vec3(0.78, 1.32, -1.10), vec3(1.25, 0.10, 0.13), MAT_WHITE);
    result = addBox(result, p, vec3(0.78, 0.43, -1.11), vec3(1.28, 0.10, 0.10), MAT_WHITE);

    // Two-storey Corinthian-inspired colonnade.
    for (int i = 0; i < 6; ++i) {
        float x = -0.08 + float(i) * 0.345;
        result = addColumn(result, p, vec3(x, 0.88, -1.23), 0.72);
        result = addColumn(result, p, vec3(x, -0.06, -1.23), 0.72);
    }

    // Ground-floor arcade. Dark shapes sit behind white arch mouldings.
    for (int i = 0; i < 5; ++i) {
        float x = 0.08 + float(i) * 0.35;
        vec3 archP = p - vec3(x, 0.0, -1.075);
        result = unite(result, object(sdArchPanel(archP, 0.13, -0.42, -0.94, 0.035), MAT_DARK));
        vec3 outerP = p - vec3(x, 0.0, -1.125);
        float outer = sdArchPanel(outerP, 0.175, -0.39, -0.98, 0.018);
        float inner = sdArchPanel(outerP, 0.125, -0.42, -1.01, 0.035);
        result = unite(result, object(max(outer, -inner), MAT_WHITE));
    }

    // Repeated tall windows and pilasters along the long façade.
    for (int i = 0; i < 12; ++i) {
        float x = -2.82 + float(i) * 0.39;
        vec3 upperWindow = p - vec3(x, 0.0, -0.635);
        vec3 lowerWindow = p - vec3(x, 0.0, -0.655);
        result = unite(result, object(sdArchPanel(upperWindow, 0.095, 0.90, 0.56, 0.025), MAT_DARK));
        result = unite(result, object(sdArchPanel(lowerWindow, 0.095, 0.07, -0.28, 0.025), MAT_DARK));
        result = addBox(result, p, vec3(x - 0.17, 0.44, -0.69), vec3(0.025, 0.78, 0.035), MAT_WHITE);
    }

    // Balcony rails and rows of small balusters make the silhouette readable.
    result = addBox(result, p, vec3(0.78, 0.40, -1.38), vec3(1.28, 0.035, 0.035), MAT_WHITE);
    result = addBox(result, p, vec3(0.78, 0.61, -1.38), vec3(1.28, 0.035, 0.035), MAT_WHITE);
    for (int i = 0; i < 17; ++i) {
        float x = -0.42 + float(i) * 0.15;
        result = addBox(result, p, vec3(x, 0.50, -1.38), vec3(0.018, 0.10, 0.025), MAT_WHITE);
    }

    // Broad entrance stair and foreground retaining wall.
    for (int i = 0; i < 5; ++i) {
        float step = float(i);
        result = addBox(result, p, vec3(0.82, -0.99 + step * 0.035, -1.42 - step * 0.15),
                        vec3(1.34, 0.035, 0.31 + step * 0.15), MAT_STONE);
    }
    result = addBox(result, p, vec3(-1.65, -0.78, -1.58), vec3(1.45, 0.10, 0.07), MAT_PINK);
    result = addBox(result, p, vec3(-1.65, -0.66, -1.58), vec3(1.50, 0.035, 0.06), MAT_WHITE);
    for (int i = 0; i < 12; ++i) {
        float x = -3.00 + float(i) * 0.25;
        result = addBox(result, p, vec3(x, -0.71, -1.59), vec3(0.025, 0.10, 0.045), MAT_WHITE);
    }

    return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
    float travelled = 0.0;
    float material = 0.0;
    for (int i = 0; i < MAX_STEPS; ++i) {
        vec2 samplePoint = scene(origin + direction * travelled);
        if (samplePoint.x < SURFACE_DISTANCE) {
            material = samplePoint.y;
            break;
        }
        travelled += samplePoint.x * 0.78;
        if (travelled > MAX_DISTANCE) break;
    }
    return vec2(travelled, material);
}

vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(0.0015, -0.0015);
    return normalize(
        e.xyy * scene(p + e.xyy).x +
        e.yyx * scene(p + e.yyx).x +
        e.yxy * scene(p + e.yxy).x +
        e.xxx * scene(p + e.xxx).x
    );
}

float softShadow(vec3 origin, vec3 direction) {
    float shade = 1.0;
    float t = 0.03;
    for (int i = 0; i < 32; ++i) {
        float h = scene(origin + direction * t).x;
        shade = min(shade, 14.0 * h / t);
        t += clamp(h, 0.025, 0.32);
        if (h < 0.001 || t > 12.0) break;
    }
    return clamp(shade, 0.16, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
    float occlusion = 0.0;
    float weight = 1.0;
    for (int i = 1; i <= 5; ++i) {
        float distance = 0.045 * float(i);
        occlusion += (distance - scene(p + n * distance).x) * weight;
        weight *= 0.65;
    }
    return clamp(1.0 - occlusion * 2.2, 0.25, 1.0);
}

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 materialColor(float material, vec3 p) {
    if (material < 1.5) {
        float paving = step(0.92, fract(p.x * 1.7)) * 0.035 + step(0.94, fract(p.z * 2.2)) * 0.03;
        return vec3(0.47, 0.49, 0.48) - paving;
    }
    if (material < 2.5) return vec3(0.73, 0.24, 0.25) + 0.025 * sin(p.y * 18.0);
    if (material < 3.5) return vec3(0.90, 0.86, 0.78);
    if (material < 4.5) return vec3(0.035, 0.055, 0.065);
    if (material < 5.5) {
        vec3 q = p - vec3(-0.66, 1.79, 0.20);
        float angle = atan(q.z, q.x);
        float longitude = abs(fract(angle * 1.273 + 0.5) - 0.5);
        float band = smoothstep(0.16, 0.10, abs(q.y - 0.13));
        float diamonds = step(0.34, abs(fract(angle * 1.91 + q.y * 3.4) - 0.5));
        vec3 gold = vec3(0.92, 0.62, 0.08) + 0.08 * sin(angle * 16.0);
        vec3 green = vec3(0.03, 0.34, 0.22);
        vec3 blue = vec3(0.04, 0.20, 0.48);
        float ribs = smoothstep(0.47, 0.43, longitude) * 0.18;
        return mix(gold, mix(green, blue, diamonds), max(band, ribs));
    }
    if (material < 6.5) return vec3(0.31, 0.075, 0.045);
    return vec3(0.58, 0.54, 0.48);
}

mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

void main(void) {
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;
    float mouseOrbit = (u_mouse.x / max(u_resolution.x, 1.0) - 0.5) * 0.34;
    float orbit = 0.43 + mouseOrbit + sin(u_time * 0.10) * 0.025;
    vec3 cameraOrigin = vec3(0.0, 0.48, -7.35);
    cameraOrigin.xz = rotate(orbit) * cameraOrigin.xz;
    vec3 target = vec3(-0.35, 0.45, -0.15);
    vec3 forward = normalize(target - cameraOrigin);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 direction = normalize(forward * 1.72 + right * uv.x + up * uv.y);

    vec2 hit = raymarch(cameraOrigin, direction);
    float horizon = clamp(direction.y * 1.15 + 0.45, 0.0, 1.0);
    vec3 sky = mix(vec3(0.36, 0.63, 0.82), vec3(0.045, 0.18, 0.49), horizon);
    vec2 cloudUv = uv * vec2(1.15, 1.0) + vec2(u_time * 0.008, 0.0);
    float cloudNoise = noise(cloudUv * 1.6) * 0.58 + noise(cloudUv * 3.1 + 4.7) * 0.28
                     + noise(cloudUv * 6.2 + 9.1) * 0.14;
    float clouds = smoothstep(0.58, 0.73, cloudNoise);
    sky = mix(sky, vec3(0.92, 0.94, 0.92), clouds * smoothstep(-0.16, 0.25, direction.y));
    vec3 color = sky;

    if (hit.y > 0.0 && hit.x < MAX_DISTANCE) {
        vec3 position = cameraOrigin + direction * hit.x;
        vec3 normal = calcNormal(position);
        vec3 lightDirection = normalize(vec3(-0.65, 0.85, -0.55));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float shadow = softShadow(position + normal * 0.012, lightDirection);
        float ao = ambientOcclusion(position, normal);
        float warmBounce = 0.10 * max(-normal.y, 0.0);
        color = materialColor(hit.y, position) * (0.24 * ao + 0.88 * diffuse * shadow + warmBounce);
        float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 4.0);
        color += vec3(0.18, 0.24, 0.28) * rim * 0.18;
        color = mix(color, sky, 1.0 - exp(-0.0018 * hit.x * hit.x));
    }

    color *= 1.0 - 0.12 * dot(uv * 0.55, uv * 0.55);
    color = pow(max(color, 0.0), vec3(0.4545));
    gl_FragColor = vec4(color, 1.0);
}
