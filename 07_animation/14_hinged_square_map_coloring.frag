// Animated hinged-square map colouring.
//
// Four squares share each hinge. Neighbouring 2x2 modules turn in opposite
// directions, and every square is transformed about its selected corner.
// The five-colour rule is c(i,j,k) = (i + 2j + k) mod 5. One unfolding
// advances k, so geometry and colour return together after five unfoldings
// (30 seconds in the preview).
#ifdef GL_ES
#extension GL_OES_standard_derivatives : enable
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform float u_debug;

const float PI = 3.141592653589793;
const float SQRT2 = 1.4142135623730951;
const float UNFOLD_SECONDS = 6.0;

vec2 rotate2d(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c) * p;
}

float positiveMod(float value, float modulus) {
    return mod(mod(value, modulus) + modulus, modulus);
}

float parity(vec2 value) {
    return positiveMod(value.x + value.y, 2.0);
}

float boxSdf(vec2 p, vec2 halfSize) {
    vec2 q = abs(p) - halfSize;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// A quintic easing has zero velocity and acceleration at both holds.
float smootherStep(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Allocate 14% of each half-cycle to a readable endpoint hold.
float heldEase(float t) {
    return smootherStep(smoothstep(0.14, 0.86, t));
}

vec3 mapPalette(float index) {
    if (index < 0.5) return vec3(0.92, 0.39, 0.32);
    if (index < 1.5) return vec3(0.98, 0.70, 0.25);
    if (index < 2.5) return vec3(0.24, 0.72, 0.61);
    if (index < 3.5) return vec3(0.29, 0.55, 0.88);
    return vec3(0.67, 0.43, 0.82);
}

float colorIndex(vec2 tileId, float unfolding) {
    return positiveMod(tileId.x + 2.0 * tileId.y + unfolding, 5.0);
}

vec3 parityDebug(vec2 tileId) {
    vec2 blockId = floor(tileId * 0.5);
    float tileParity = parity(tileId);
    float blockParity = parity(blockId);
    return vec3(0.15 + 0.65 * tileParity, 0.22 + 0.55 * blockParity, 0.34);
}

void main(void) {
    vec2 screen = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;

    float unfoldClock = positiveMod(u_time, UNFOLD_SECONDS * 5.0) / UNFOLD_SECONDS;
    float unfolding = floor(unfoldClock);
    float cycle = fract(unfoldClock);
    float opening = cycle < 0.5
        ? heldEase(cycle * 2.0)
        : heldEase((1.0 - cycle) * 2.0);
    float angle = opening * 0.5 * PI;

    // A diagonal is sqrt(2) times a side: rotating the camera by 45 degrees
    // while dividing its scale by sqrt(2) aligns the open lattice spacing.
    float cameraAngle = opening * 0.25 * PI;
    float cameraScale = mix(1.0, 1.0 / SQRT2, opening);
    vec2 world = rotate2d(screen, -cameraAngle) / cameraScale * 3.35;

    vec2 baseId = floor(world + 0.5);
    float bestDistance = 1e4;
    float secondDistance = 1e4;
    vec2 bestId = vec2(0.0);
    vec2 bestHinge = vec2(0.0);

    // Camera contraction and hinged motion keep the owning tile within this
    // fixed neighbourhood. Choosing by minimum SDF preserves tile identity.
    for (int y = -2; y <= 2; ++y) {
        for (int x = -2; x <= 2; ++x) {
            vec2 tileId = baseId + vec2(float(x), float(y));
            vec2 blockId = floor(tileId * 0.5);
            vec2 hinge = blockId * 2.0 + vec2(0.5);
            float turnSign = parity(blockId) < 0.5 ? 1.0 : -1.0;
            vec2 local = rotate2d(world - hinge, -turnSign * angle)
                - (tileId - hinge);
            float distanceToTile = boxSdf(local, vec2(0.47));

            if (distanceToTile < bestDistance) {
                secondDistance = bestDistance;
                bestDistance = distanceToTile;
                bestId = tileId;
                bestHinge = hinge;
            } else if (distanceToTile < secondDistance) {
                secondDistance = distanceToTile;
            }
        }
    }

    float aa = max(fwidth(bestDistance), 0.0015);
    float fill = 1.0 - smoothstep(-aa, aa, bestDistance);
    float outline = 1.0 - smoothstep(0.018 - aa, 0.018 + aa, abs(bestDistance));
    float seam = 1.0 - smoothstep(0.0, 0.035, abs(secondDistance - bestDistance));

    float nextUnfolding = positiveMod(unfolding + 1.0, 5.0);
    float colorBlend = smootherStep(smoothstep(0.62, 0.94, cycle));
    vec3 tileColor = mix(
        mapPalette(colorIndex(bestId, unfolding)),
        mapPalette(colorIndex(bestId, nextUnfolding)),
        colorBlend
    );

    vec3 background = mix(
        vec3(0.025, 0.032, 0.050),
        vec3(0.055, 0.071, 0.096),
        clamp(screen.y * 0.25 + 0.5, 0.0, 1.0)
    );
    vec3 color = mix(background, tileColor, fill);
    color = mix(color, vec3(0.055, 0.067, 0.086), outline * fill * 0.78);

    float hingeDistance = length(world - bestHinge);
    float hingeAa = max(fwidth(hingeDistance), 0.0015);
    float hinge = 1.0 - smoothstep(0.055 - hingeAa, 0.055 + hingeAa, hingeDistance);
    color = mix(color, vec3(0.94, 0.91, 0.82), hinge * 0.72);

    // Debug modes: 1 hinges, 2 parity, 3 colour indices, 4 seam ownership.
    if (u_debug > 0.5 && u_debug < 1.5) {
        color = mix(vec3(0.035), vec3(0.97, 0.34, 0.23), hinge);
        color += vec3(0.2) * outline;
    } else if (u_debug > 1.5 && u_debug < 2.5) {
        color = mix(background, parityDebug(bestId), fill);
        color = mix(color, vec3(0.03), outline * fill);
    } else if (u_debug > 2.5 && u_debug < 3.5) {
        color = mix(background, mapPalette(colorIndex(bestId, unfolding)), fill);
    } else if (u_debug > 3.5) {
        color = mix(vec3(0.025, 0.04, 0.055), vec3(1.0, 0.1, 0.04), seam);
        color += vec3(0.35) * outline;
    }

    // Subtle vignette keeps the infinite field legible without hiding edges.
    color *= 1.0 - 0.12 * smoothstep(0.55, 1.55, length(screen));
    gl_FragColor = vec4(pow(color, vec3(0.96)), 1.0);
}
