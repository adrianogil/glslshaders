#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform sampler2D u_texture;

#define PI 3.1415

mat4 rotationX( in float angle ) {
    return mat4(    1.0,        0,          0,          0,
                    0,  cos(angle), -sin(angle),        0,
                    0,  sin(angle),  cos(angle),        0,
                    0,          0,            0,        1);
}

mat4 rotationY( in float angle ) {
    return mat4(    cos(angle),     0,      sin(angle), 0,
                            0,      1.0,             0, 0,
                    -sin(angle),    0,      cos(angle), 0,
                            0,      0,              0,  1);
}

mat4 rotationZ( in float angle ) {
    return mat4(    cos(angle),     -sin(angle),    0,  0,
                    sin(angle),     cos(angle),     0,  0,
                            0,              0,      1,  0,
                            0,              0,      0,  1);
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    vec3 camera_center = vec3(0.0, 0.0, 0.0);

    float viewport_width = 0.2;
    float viewport_height = 0.2;
    float viewport_distance = 0.2;

    vec2 viewport_size = vec2(viewport_width, viewport_height);

    vec3 viewport_center = vec3(0.5 * viewport_size, viewport_distance);
    vec3 viewport_point = viewport_center + vec3((st - 0.5) * viewport_size, 0);

    vec3 view_direction = normalize(viewport_point - camera_center);

    vec2 pos = u_mouse/u_resolution.xy - 0.5;
    pos.x *= -1.0;
    pos.y *= -1.0;
    view_direction = (vec4(view_direction, 1.0) * rotationY(2.0 * PI * pos.x)  * rotationX(2.0 * PI * pos.y)).xyz;

    vec2 longlat = vec2(atan(view_direction.x, view_direction.z) + PI, acos(-view_direction.y));
    vec2 uv = longlat / vec2(2.0 * PI, PI);
    uv.x = 1.0 - uv.x;

    vec3 rgb = texture2D(u_texture, uv).rgb;
    gl_FragColor = vec4(rgb, 1.0);
}
