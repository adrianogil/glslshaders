// Oscillating Point Ribbons — fragment-only adaptation of @yuruyurau.
// Source: https://x.com/yuruyurau/status/2108944867930132499
// Based on the transcription in the local ResearchNotes note (not a fetched tweet).
// Shadertoy: paste into Image; leave all channels empty. No buffers/textures.
// The host supplies iResolution and iTime. All 10,000 original samples remain.

const float PI = 3.141592653589793;
const float POINT_RADIUS = 0.5;       // In the original 400x400 coordinate system.
const float POINT_ALPHA = 166.0 / 255.0;
const float SPEED = 1.0;              // 1 matches the original at 60 FPS.
const int POINT_COUNT = 10000;
const int BLOCK_SIZE = 100;

// Set to 0 to compare against the expensive all-points reference renderer.
#ifndef RIBBON_CULLING
#define RIBBON_CULLING 1
#endif

// Radial lines repeat after PI radians, or 4*PI in d because c=d/4+offset.
// Using lines (rather than rays) also handles negative q conservatively.
float wrappedDistance(float a, float b) {
    return abs(mod(a - b + 2.0 * PI, 4.0 * PI) - 2.0 * PI);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float pixelSize = 400.0 / min(iResolution.x, iResolution.y);
    vec2 p = (fragCoord - 0.5 * iResolution.xy) * pixelSize;
    p.y = -p.y;                       // Restore p5.js's downward screen Y.
    float t = iTime * PI * SPEED + PI / 60.0;

    // Analytic soft discs approximate p5.js's antialiasing. Support includes
    // the entire transition, so culling cannot cut off the soft edges.
    float aa = 0.5 * pixelSize;
    float support = POINT_RADIUS + aa;
    float innerRadius = max(0.0, POINT_RADIUS - aa);
    float radius = length(p);
    float angle = radius > 0.00001 ? atan(p.x, p.y) : 0.0;
    float tolerance = 4.0 * asin(min(1.0, support / max(radius, 0.00001))) + 0.0002;
    vec2 targetD = 4.0 * (vec2(angle + t * 0.25) - vec2(0.0, 9.0));
    float transmission = 1.0;

    for (int block = 0; block < POINT_COUNT / BLOCK_SIZE; ++block) {
        int first = block * BLOCK_SIZE;
        // Over this index interval e<0 and increases monotonically.
        // |e| <= length(k,e), |k| <= 5 provide conservative d bounds.
        float eNear = 11.0 - float(first + BLOCK_SIZE - 1) / 1495.0;
        float eFar = 11.0 - float(first) / 1495.0;
        float dMin = eNear - 6.0;
        float dMax = sqrt(eFar * eFar + 25.0) - 6.0;
        float middle = 0.5 * (dMin + dMax);
        float halfWidth = 0.5 * (dMax - dMin);

#if RIBBON_CULLING
        if (wrappedDistance(targetD.x, middle) > halfWidth + tolerance &&
            wrappedDistance(targetD.y, middle) > halfWidth + tolerance) continue;
#endif

        for (int sampleIndex = 0; sampleIndex < BLOCK_SIZE; ++sampleIndex) {
            float i = float(first + sampleIndex);
            float y = i / 299.0;
            float k = (4.0 + cos(y)) * cos(i / 7.0);
            float e = y / 5.0 - 11.0;
            float d = length(vec2(k, e)) - 6.0;
            float parity = mod(i, 2.0);

#if RIBBON_CULLING
            // Only nearby radial lines need the costly radial deformation.
            if (wrappedDistance(mix(targetD.x, targetD.y, parity), d) > tolerance) continue;
#endif

            float q = 99.0 + sin(t * 2.0 + e) * 9.0
                + 3.0 * sin(k * 2.0) + d * d * sin(t * 2.0 - d)
                + y / 23.0 * k * (e + sin(-d * 4.0));
            float c = d / 4.0 - t / 4.0 + parity * 9.0;
            vec2 pointPosition = q * vec2(sin(c), cos(c));
            float coverage = 1.0 - smoothstep(innerRadius, support, length(p - pointPosition));
            // White source-over blending is order independent. Product of
            // transparencies reproduces overlap without additive blowout.
            transmission *= 1.0 - POINT_ALPHA * coverage;
        }
    }

    vec3 color = mix(vec3(9.0 / 255.0), vec3(1.0), 1.0 - transmission);
    fragColor = vec4(color, 1.0);
}
