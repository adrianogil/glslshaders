// Procedural Planet.
// Optimized rotating continents, clouds, atmosphere, rings, and stars.
#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

float hash21(vec2 value) {
    vec3 value3 = fract(vec3(value.xyx) * 0.1031);
    value3 += dot(value3, value3.yzx + 33.33);
    return fract((value3.x + value3.y) * value3.z);
}

float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);

    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 position = uv * 2.0 - 1.0;
    position.x *= u_resolution.x / max(u_resolution.y, 1.0);

    vec3 ocean = vec3(0.018, 0.16, 0.28);
    vec3 land = vec3(0.92, 0.40, 0.15);
    vec3 glow = vec3(0.20, 0.84, 1.0);
    float seed = 17.0;

    vec3 color = mix(
        vec3(0.002, 0.004, 0.018),
        vec3(0.018, 0.006, 0.035),
        uv.y
    );

    vec2 starGrid = uv * vec2(128.0, 72.0);
    vec2 starCell = floor(starGrid);
    float starRandom = hash21(starCell + vec2(seed));
    vec2 starLocal = fract(starGrid) - 0.5;
    float star = step(0.985, starRandom) * (1.0 - smoothstep(
        0.0004,
        0.026,
        dot(starLocal, starLocal)
    ));
    color += mix(glow, vec3(1.0), starRandom) * star;

    vec2 planetCenter = vec2(0.0, 0.03);
    vec2 planetDelta = position - planetCenter;
    float planetRadius = 0.60;
    float planetDistance = length(planetDelta);
    float planetDisc = 1.0 - smoothstep(
        planetRadius - 0.004,
        planetRadius + 0.004,
        planetDistance
    );
    float atmosphere = 1.0 - smoothstep(
        planetRadius,
        planetRadius + 0.10,
        planetDistance
    );
    atmosphere *= smoothstep(
        planetRadius - 0.12,
        planetRadius + 0.02,
        planetDistance
    );

    // Keep all terrain and cloud noise inside the planet's screen area.
    if (planetDistance < planetRadius + 0.006) {
        vec2 normalXY = planetDelta / planetRadius;
        float normalZ = sqrt(max(0.0, 1.0 - dot(normalXY, normalXY)));
        vec3 normal = vec3(normalXY, normalZ);

        vec2 surface = vec2(
            normalXY.x * 2.35 + normalZ * 0.75 + u_time * 0.030,
            normalXY.y * 2.65
        );
        float continent = valueNoise(surface * 2.0 + vec2(seed, 0.0));
        continent += valueNoise(surface * 4.2 + vec2(7.0, seed)) * 0.45;
        float landMask = smoothstep(0.69, 0.92, continent);
        vec3 surfaceColor = mix(ocean, land, landMask);

        float clouds = valueNoise(
            surface * vec2(3.0, 5.5) + vec2(u_time * 0.045, 31.0)
        );
        clouds = smoothstep(0.67, 0.82, clouds) * 0.48;
        surfaceColor = mix(surfaceColor, vec3(0.85, 0.95, 1.0), clouds);

        vec3 lightDirection = vec3(-0.62, 0.36, 0.69);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float rim = 1.0 - normalZ;
        rim *= rim;
        surfaceColor *= 0.10 + 0.90 * diffuse;
        surfaceColor += glow * rim * 0.45;
        color = mix(color, surfaceColor, planetDisc);
    }

    color += glow * atmosphere * 0.75;

    float ringLine = abs(planetDelta.y + planetDelta.x * 0.18);
    float ring = 1.0 - smoothstep(0.018, 0.035, ringLine);
    ring *= smoothstep(0.64, 0.78, abs(planetDelta.x));
    ring *= 1.0 - smoothstep(0.78, 1.05, abs(planetDelta.x));
    color += glow * ring * 0.45;

    vec2 vignettePosition = position * vec2(0.72, 1.0);
    float vignette = 1.0 - smoothstep(
        0.42,
        2.10,
        dot(vignettePosition, vignettePosition)
    );
    color *= 0.60 + 0.40 * vignette;

    gl_FragColor = vec4(color, 1.0);
}
