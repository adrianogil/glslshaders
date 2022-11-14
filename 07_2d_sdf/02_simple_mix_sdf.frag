// Based on
// https://inspirnathan.com/posts/49-shadertoy-tutorial-part-3/
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

vec2 rotate(vec2 uv, float angle) {
    return mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * uv;
}

vec3 sdfSquare(vec2 uv, float size, vec2 center, float angle) {

    float x = uv.x - center.x;
    float y = uv.y - center.y;
    vec2 rotated = rotate(vec2(x, y), angle);
    float d = max(abs(rotated.x), abs(rotated.y)) - size;

    return d > 0. ? vec3(1.) : vec3(1., 0., 0.);
}

float sdfCircle(vec2 uv, float r, vec2 center) {
    float x = uv.x - center.x;
    float y  = uv.y -  center.y;

    return length(vec2(x,y)) - r;
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
  
  float circle = sdfCircle(uv, 0.1, vec2(0, 0));
  float circleBorder = 0.01;
  vec3 circleColor = circle > - circleBorder? vec3(0, 0, 0) : vec3(0, 0, 1);
  
  col = mix(circleColor, col, step(0., circle));
  
  return col;
}

void main(void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy; // <0, 1>
    uv -= 0.5; // <-0.5,0.5>
    float scale = 1.0;
    // Adjust for screen aspect ratio
    uv.x *= scale * u_resolution.x / u_resolution.y;
    
    // vec2 square_pos = vec2(0.1, 0.0);
    // vec3 col = sdfSquare(uv, 0.2, square_pos, u_time);
    // 

    vec3 col = drawScene(uv);

    gl_FragColor = vec4(col ,1.0);
}
