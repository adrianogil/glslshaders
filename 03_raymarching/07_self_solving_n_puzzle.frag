#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define MAX_STEPS 96
#define MAX_DISTANCE 28.0
#define SURFACE_DISTANCE 0.0015
#define PUZZLE_MOVES 12

const float MATERIAL_FLOOR = 1.0;
const float MATERIAL_BOARD = 2.0;
const float MATERIAL_FRAME = 3.0;
const float MATERIAL_TILE_BASE = 10.0;

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float radius) {
    vec3 q = abs(p) - b + radius;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - radius;
}

vec2 unite(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
}

mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

// Starting from the solved board, these legal blank moves create the puzzle.
// Playing them backwards is therefore a guaranteed solution.
int moveCell(int step) {
    if (step == 0) return 14;
    if (step == 1) return 10;
    if (step == 2) return 9;
    if (step == 3) return 8;
    if (step == 4) return 12;
    if (step == 5) return 13;
    if (step == 6) return 14;
    if (step == 7) return 10;
    if (step == 8) return 11;
    if (step == 9) return 7;
    if (step == 10) return 6;
    return 5;
}

int blankAfter(int moveCount) {
    int blank = 15;
    for (int step = 0; step < PUZZLE_MOVES; ++step) {
        if (step < moveCount) {
            blank = moveCell(step);
        }
    }
    return blank;
}

int tileCellAfter(int tileIndex, int moveCount) {
    int cell = tileIndex;
    int blank = 15;

    for (int step = 0; step < PUZZLE_MOVES; ++step) {
        if (step < moveCount) {
            int target = moveCell(step);
            if (cell == target) {
                cell = blank;
            }
            blank = target;
        }
    }

    return cell;
}

vec3 cellCenter(int cell) {
    float column = mod(float(cell), 4.0);
    float row = floor(float(cell) / 4.0);
    return vec3((column - 1.5) * 0.86, 0.22, (row - 1.5) * 0.86);
}

float solverStep() {
    // Pause on the scrambled and solved states so both remain readable.
    float cycle = mod(u_time, 16.0);
    return clamp((cycle - 1.5) / 0.72, 0.0, float(PUZZLE_MOVES));
}

vec3 tileCenter(int tileIndex) {
    float progress = solverStep();
    int remainingMoves = PUZZLE_MOVES - int(floor(progress));
    int cell = tileCellAfter(tileIndex, remainingMoves);
    vec3 center = cellCenter(cell);

    if (remainingMoves > 0 && progress < float(PUZZLE_MOVES)) {
        int oldBlank = blankAfter(remainingMoves - 1);
        if (cell == oldBlank) {
            int destination = moveCell(remainingMoves - 1);
            float phase = fract(progress);
            float eased = phase * phase * (3.0 - 2.0 * phase);
            center = mix(cellCenter(oldBlank), cellCenter(destination), eased);
            center.y += sin(phase * 3.14159265) * 0.18;
        }
    }

    return center;
}

vec2 scene(vec3 p) {
    vec2 result = vec2(p.y + 0.28, MATERIAL_FLOOR);

    // Recessed tray, then four rails around its edge.
    result = unite(result, vec2(sdRoundBox(p - vec3(0.0, -0.10, 0.0), vec3(1.88, 0.14, 1.88), 0.10), MATERIAL_BOARD));
    result = unite(result, vec2(sdRoundBox(p - vec3(0.0, 0.13, -1.82), vec3(2.03, 0.24, 0.15), 0.08), MATERIAL_FRAME));
    result = unite(result, vec2(sdRoundBox(p - vec3(0.0, 0.13,  1.82), vec3(2.03, 0.24, 0.15), 0.08), MATERIAL_FRAME));
    result = unite(result, vec2(sdRoundBox(p - vec3(-1.82, 0.13, 0.0), vec3(0.15, 0.24, 1.72), 0.08), MATERIAL_FRAME));
    result = unite(result, vec2(sdRoundBox(p - vec3( 1.82, 0.13, 0.0), vec3(0.15, 0.24, 1.72), 0.08), MATERIAL_FRAME));

    for (int tile = 0; tile < 15; ++tile) {
        vec3 local = p - tileCenter(tile);
        float distanceToTile = sdRoundBox(local, vec3(0.38, 0.14, 0.38), 0.065);
        result = unite(result, vec2(distanceToTile, MATERIAL_TILE_BASE + float(tile)));
    }

    return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
    float travelled = 0.0;

    for (int step = 0; step < MAX_STEPS; ++step) {
        vec2 sample = scene(origin + direction * travelled);
        if (sample.x < SURFACE_DISTANCE) {
            return vec2(travelled, sample.y);
        }
        travelled += sample.x * 0.82;
        if (travelled > MAX_DISTANCE) break;
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
    float travelled = 0.03;

    for (int step = 0; step < 18; ++step) {
        float distanceToScene = scene(origin + direction * travelled).x;
        shade = min(shade, 14.0 * distanceToScene / travelled);
        travelled += clamp(distanceToScene, 0.025, 0.28);
        if (distanceToScene < SURFACE_DISTANCE || travelled > 8.0) break;
    }

    return clamp(shade, 0.16, 1.0);
}

vec3 tilePalette(int tileIndex) {
    float hue = float(tileIndex) / 15.0;
    return 0.54 + 0.22 * cos(6.2831853 * (hue + vec3(0.02, 0.68, 0.42)));
}

float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

float sdTorus(vec3 p, vec2 radii) {
    vec2 q = vec2(length(p.xz) - radii.x, p.y);
    return length(q) - radii.y;
}

float sdOctahedron(vec3 p, float size) {
    p = abs(p);
    return (p.x + p.y + p.z - size) * 0.57735027;
}

vec2 miniUnite(vec2 a, float distanceToShape, float material) {
    return distanceToShape < a.x ? vec2(distanceToShape, material) : a;
}

// One miniature SDF world is shared by every tile. Each tile samples a fixed
// sixteenth of its view, so solving the puzzle reconstructs a single portal.
vec2 portalScene(vec3 p) {
    vec2 result = vec2(p.y + 0.72, 0.0);

    // A ringed world anchors the continuous image across the central tiles.
    vec3 planet = p - vec3(0.0, 0.02, 0.22);
    result = miniUnite(result, sdSphere(planet, 0.58), 1.0);
    vec3 ring = planet;
    ring.yz = rotate(-0.48) * ring.yz;
    result = miniUnite(result, sdTorus(ring, vec2(0.82, 0.055)), 2.0);

    // Distant monuments and crystals make the outer fragments recognizable.
    vec3 leftTower = p - vec3(-1.02, -0.24, 0.36);
    leftTower.xz = rotate(0.16) * leftTower.xz;
    result = miniUnite(result, sdRoundBox(leftTower, vec3(0.18, 0.49, 0.18), 0.035), 3.0);
    result = miniUnite(result, sdOctahedron(p - vec3(-1.02, 0.42, 0.36), 0.25), 2.0);

    vec3 rightTower = p - vec3(1.02, -0.32, 0.42);
    rightTower.xz = rotate(-0.14) * rightTower.xz;
    result = miniUnite(result, sdRoundBox(rightTower, vec3(0.21, 0.40, 0.21), 0.035), 3.0);
    result = miniUnite(result, sdOctahedron(p - vec3(1.02, 0.22, 0.42), 0.28), 2.0);

    // Satellites move through multiple fragments without changing the mapping.
    float orbit = u_time * 0.55;
    vec3 satelliteA = vec3(cos(orbit) * 1.12, 0.45 + sin(orbit * 0.7) * 0.18, 0.18 + sin(orbit) * 0.36);
    vec3 satelliteB = vec3(cos(orbit + 3.1) * 1.35, -0.02, 0.45 + sin(orbit + 3.1) * 0.25);
    result = miniUnite(result, sdSphere(p - satelliteA, 0.13), 2.0);
    result = miniUnite(result, sdSphere(p - satelliteB, 0.09), 2.0);

    return result;
}

vec3 portalNormal(vec3 p) {
    const vec2 e = vec2(0.004, -0.004);
    return normalize(
        e.xyy * portalScene(p + e.xyy).x +
        e.yyx * portalScene(p + e.yyx).x +
        e.yxy * portalScene(p + e.yxy).x +
        e.xxx * portalScene(p + e.xxx).x
    );
}

vec3 portalSceneColor(vec2 uv) {
    vec3 origin = vec3(0.0, 0.30, -3.0);
    vec3 direction = normalize(vec3(uv.x * 0.86, uv.y * 0.78 - 0.13, 1.75));
    float travelled = 0.0;
    vec2 sample = vec2(0.0);

    for (int step = 0; step < 40; ++step) {
        sample = portalScene(origin + direction * travelled);
        if (sample.x < 0.005 || travelled > 6.0) break;
        travelled += sample.x * 0.82;
    }

    vec3 palette = vec3(0.30, 0.72, 0.94);
    vec3 color = mix(vec3(0.012, 0.018, 0.055), vec3(0.18, 0.08, 0.30), uv.y * 0.5 + 0.5);

    if (travelled <= 6.0) {
        vec3 position = origin + direction * travelled;
        vec3 normal = portalNormal(position);
        vec3 lightDirection = normalize(vec3(-0.65, 0.85, -0.55));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 2.5);
        vec3 objectColor = palette;

        if (sample.y < 0.5) {
            float grid = 0.5 + 0.5 * sin(position.x * 8.0) * sin(position.z * 8.0);
            objectColor = mix(vec3(0.025, 0.04, 0.07), palette * 0.26, grid * 0.35);
        } else if (sample.y > 2.5) {
            objectColor = vec3(0.006, 0.008, 0.018);
        } else if (sample.y > 1.5) {
            objectColor = vec3(1.0, 0.34, 0.62);
        }

        color = objectColor * (0.20 + diffuse * 0.90) + rim * palette * 0.42;
    }

    return color;
}

vec3 materialColor(float material, vec3 position, vec3 normal) {
    if (material < 1.5) {
        float grain = sin(position.x * 3.2 + sin(position.z * 1.7)) * 0.035;
        return vec3(0.075, 0.055, 0.065) + grain;
    }
    if (material < 2.5) {
        return vec3(0.025, 0.038, 0.055);
    }
    if (material < MATERIAL_TILE_BASE) {
        float grain = sin(position.x * 11.0 + position.z * 4.0) * 0.035;
        return vec3(0.19, 0.095, 0.055) + grain;
    }

    int tileIndex = int(floor(material - MATERIAL_TILE_BASE + 0.5));
    vec3 palette = tilePalette(tileIndex);
    vec3 color = palette * 0.16 + vec3(0.025, 0.035, 0.055);
    vec3 local = position - tileCenter(tileIndex);
    if (normal.y > 0.72) {
        float column = mod(float(tileIndex), 4.0);
        float row = floor(float(tileIndex) / 4.0);
        vec2 fragmentUv = vec2(local.x, local.z) / 0.30;
        vec2 portalUv = (vec2(column, row) + fragmentUv * 0.5 + 0.5) / 4.0;
        portalUv = portalUv * 2.0 - 1.0;
        float edge = max(abs(local.x), abs(local.z));
        float portalMask = 1.0 - smoothstep(0.292, 0.315, edge);
        vec3 portalColor = portalSceneColor(portalUv);
        color = mix(color, portalColor, portalMask);
    }
    return color;
}

void main(void) {
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;
    vec2 mouse = u_mouse / max(u_resolution, vec2(1.0)) - 0.5;

    float orbit = 0.68 + mouse.x * 0.8 + sin(u_time * 0.10) * 0.08;
    vec3 cameraOrigin = vec3(0.0, 4.7 - mouse.y * 1.0, -5.5);
    cameraOrigin.xz = rotate(orbit) * cameraOrigin.xz;
    vec3 target = vec3(0.0, 0.05, 0.0);
    vec3 forward = normalize(target - cameraOrigin);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 direction = normalize(forward * 1.85 + right * uv.x + up * uv.y);

    vec2 hit = raymarch(cameraOrigin, direction);
    float skyBlend = clamp(direction.y * 0.55 + 0.55, 0.0, 1.0);
    vec3 sky = mix(vec3(0.035, 0.025, 0.065), vec3(0.13, 0.18, 0.28), skyBlend);
    vec3 color = sky;

    if (hit.y > 0.0) {
        vec3 position = cameraOrigin + direction * hit.x;
        vec3 normal = calcNormal(position);
        vec3 lightDirection = normalize(vec3(-0.55, 0.95, -0.35));
        vec3 halfVector = normalize(lightDirection - direction);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float shadow = softShadow(position + normal * 0.008, lightDirection);
        float ambient = 0.22 + 0.12 * max(normal.y, 0.0);
        float specular = pow(max(dot(normal, halfVector), 0.0), 42.0) * 0.34;
        float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0) * 0.12;

        color = materialColor(hit.y, position, normal) * (ambient + diffuse * shadow * 0.82);
        color += specular * shadow + rim * vec3(0.25, 0.38, 0.60);
        color = mix(color, sky, 1.0 - exp(-0.012 * hit.x * hit.x));
    }

    // A subtle vignette keeps attention on the solving board.
    color *= 1.0 - 0.18 * dot(uv * 0.42, uv * 0.42);
    color = pow(max(color, 0.0), vec3(0.4545));
    gl_FragColor = vec4(color, 1.0);
}
