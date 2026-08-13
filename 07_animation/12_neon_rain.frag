// Neon Rain.
// Layered procedural rain for a dark, chromatic background.
#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

float hash21(vec2 value) {
    value = fract(value * vec2(123.34, 456.21));
    value += dot(value, value + 45.32);
    return fract(value.x * value.y);
}

float rainLayer(
    vec2 uv,
    float columns,
    float speed,
    float slant,
    float thickness,
    float seed
) {
    vec2 grid = uv * vec2(columns, columns * 0.52);
    grid.y += u_time * speed;

    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float random = hash21(cell + seed);

    local.x += (random - 0.5) * 0.72;
    local.x += local.y * slant;

    float dropLength = mix(0.16, 0.48, hash21(cell + seed + 17.0));
    float verticalMask = 1.0 - smoothstep(dropLength - 0.08, dropLength, abs(local.y));
    float streak = 1.0 - smoothstep(thickness, thickness * 2.5, abs(local.x));
    float population = step(0.28, random);

    return streak * verticalMask * population * mix(0.35, 1.0, random);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 position = uv * 2.0 - 1.0;
    position.x *= u_resolution.x / max(u_resolution.y, 1.0);

    vec3 nightTop = vec3(0.008, 0.015, 0.045);
    vec3 nightBottom = vec3(0.035, 0.008, 0.055);
    vec3 color = mix(nightBottom, nightTop, smoothstep(0.0, 1.0, uv.y));

    float horizon = exp(-abs(position.y + 0.28) * 4.5);
    float cloudA = sin(position.x * 1.7 + u_time * 0.11);
    float cloudB = sin(position.x * 3.1 - position.y * 2.4 - u_time * 0.17);
    float clouds = smoothstep(0.35, 1.35, cloudA + cloudB);
    color += vec3(0.12, 0.015, 0.13) * horizon;
    color += vec3(0.025, 0.035, 0.075) * clouds * (0.3 + 0.7 * uv.y);

    float distantRain = rainLayer(uv, 19.0, 2.7, 0.24, 0.022, 3.0);
    float middleRain = rainLayer(uv, 29.0, 4.6, 0.32, 0.018, 11.0);
    float nearRain = rainLayer(uv, 42.0, 7.2, 0.42, 0.014, 29.0);

    vec3 magenta = vec3(0.95, 0.14, 0.72);
    vec3 cyan = vec3(0.18, 0.82, 1.0);
    color += magenta * distantRain * 0.30;
    color += mix(magenta, cyan, uv.x) * middleRain * 0.62;
    color += cyan * nearRain * 0.92;

    float stormWave = max(sin(u_time * 0.41) * sin(u_time * 1.73), 0.0);
    float lightning = pow(stormWave, 18.0);
    color += vec3(0.28, 0.34, 0.55) * lightning * (0.25 + 0.75 * uv.y);

    float wetReflection = pow(1.0 - uv.y, 5.0);
    float reflectionBands = 0.5 + 0.5 * sin(position.x * 18.0 + u_time * 0.7);
    color += mix(magenta, cyan, uv.x) * wetReflection * reflectionBands * 0.16;

    float vignette = 1.0 - smoothstep(0.65, 1.65, length(position * vec2(0.72, 1.0)));
    color *= 0.62 + 0.38 * vignette;

    gl_FragColor = vec4(color, 1.0);
}
