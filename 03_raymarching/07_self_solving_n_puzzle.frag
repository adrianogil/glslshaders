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

float sdRoundBox2D(vec2 p, vec2 b, float radius) {
    vec2 q = abs(p) - b + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec2 unite(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
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

bool segmentEnabled(int digit, int segment) {
    if (segment == 0) return digit != 1 && digit != 4;
    if (segment == 1) return digit != 5 && digit != 6;
    if (segment == 2) return digit != 2;
    if (segment == 3) return digit != 1 && digit != 4 && digit != 7;
    if (segment == 4) return digit == 0 || digit == 2 || digit == 6 || digit == 8;
    if (segment == 5) return digit != 1 && digit != 2 && digit != 3 && digit != 7;
    return digit != 0 && digit != 1 && digit != 7;
}

float digitDistance(vec2 p, int digit) {
    float distanceToDigit = 10.0;

    for (int segment = 0; segment < 7; ++segment) {
        if (segmentEnabled(digit, segment)) {
            vec2 center = vec2(0.0);
            vec2 halfSize = vec2(0.105, 0.025);
            if (segment == 0) center.y = 0.27;
            if (segment == 3) center.y = -0.27;
            if (segment == 6) center.y = 0.0;
            if (segment == 1 || segment == 2 || segment == 4 || segment == 5) {
                center.x = (segment == 1 || segment == 2) ? 0.13 : -0.13;
                center.y = (segment == 1 || segment == 5) ? 0.135 : -0.135;
                halfSize = vec2(0.025, 0.105);
            }
            distanceToDigit = min(distanceToDigit, sdRoundBox2D(p - center, halfSize, 0.018));
        }
    }

    return distanceToDigit;
}

float numberMask(vec2 p, int number) {
    float distanceToNumber;
    if (number < 10) {
        distanceToNumber = digitDistance(p, number);
    } else {
        vec2 left = (p - vec2(-0.17, 0.0)) / vec2(0.78, 1.0);
        vec2 right = (p - vec2(0.17, 0.0)) / vec2(0.78, 1.0);
        distanceToNumber = min(digitDistance(left, 1), digitDistance(right, number - 10));
    }
    return 1.0 - smoothstep(0.018, 0.045, distanceToNumber);
}

vec3 tilePalette(int tileIndex) {
    float hue = float(tileIndex) / 15.0;
    return 0.54 + 0.22 * cos(6.2831853 * (hue + vec3(0.02, 0.68, 0.42)));
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
    vec3 color = tilePalette(tileIndex);
    vec3 local = position - tileCenter(tileIndex);
    if (normal.y > 0.72) {
        float numeral = numberMask(vec2(local.x, -local.z), tileIndex + 1);
        color = mix(color, vec3(0.025, 0.035, 0.055), numeral * 0.92);
    }
    return color;
}

mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
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
