// Based on https://andrewhungblog.wordpress.com/2018/07/28/shader-art-tutorial-hexagonal-grids/
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

float sdfHexagon(in vec2 p, in vec2 c, in float size){
    p  -= c;
    float hexSize = 0.15 * size;
    const vec2 s = vec2(1, 1.7320508);
    
    p = abs(p);
    return max(dot(p, s*.5), p.x) - hexSize;
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

    float hexagon_value = sdfHexagon(uv, vec2(0.0, 0.0), 0.8);

    float res;
    res = hexagon_value;
    
    res = smoothstep(0., 0.02, res); // antialias entire result

    col = mix(vec3(1,0,0), col, res);
  
    return col;
}

void main(void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy; // <0, 1>
    uv -= 0.5; // <-0.5,0.5>
    float scale = 1.0;
    // Adjust for screen aspect ratio
    uv.x *= scale * u_resolution.x / u_resolution.y;

    vec3 col = drawScene(uv);

    gl_FragColor = vec4(col, 1.0);
}
