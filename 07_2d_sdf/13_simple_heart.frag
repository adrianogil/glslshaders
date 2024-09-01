// Based on https://andrewhungblog.wordpress.com/2018/07/28/shader-art-tutorial-hexagonal-grids/
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float sdfHeart(vec2 uv, float size, vec2 offset, float cornerLevel) {
    float x = uv.x - offset.x;
    float y = uv.y - offset.y;
    float x2 = x * x;
    float y2 = y * y;
    float y3 = y2 * y;
    float group = x2 + y2 - size;

    return group * group * group - cornerLevel * x2 * y3;
}

vec3 getBackgroundColor(vec2 uv) {
    uv += 0.5; // remap uv from <-0.5,0.5> to <0,1>
    vec3 gradientStartColor = vec3(1., 0., 1.);
    vec3 gradientEndColor = vec3(0., 1., 1.);
    return mix(gradientStartColor, gradientEndColor, uv.y); // gradient goes from bottom to top
}

vec3 drawScene(vec2 uv) {
    vec3 backgroundColor = getBackgroundColor(uv);
    vec3 col = backgroundColor;

    float border = 0.03;
    vec3 borderColor = vec3(0.0);

    float heartSize = 0.08;
    float heart = sdfHeart(uv, heartSize, vec2(0.0, 0.0), 2.4);
    float heart2 = sdfHeart(uv, heartSize + border, vec2(0.0, 0.0), 2.4);

    vec3 heartColor = vec3(1, 0, 0);

    col = mix(borderColor, col, step(0.0, heart2));
    col = mix(heartColor, col, step(0.0, heart));

    return col;
}

void main(void)
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.y = uv.y * 2.0 - 1.0; // [-1, 1] range for y
    uv.x = uv.x * 2.0 - 1.0; // [-1, 1] range for x

    float scale = 1.0;
    // Adjust for screen aspect ratio
    uv.x *= scale * u_resolution.x / u_resolution.y;

    vec3 col = drawScene(uv);

    gl_FragColor = vec4(col, 1.0);
}