#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main(){
    vec2 uv = gl_FragCoord.xy/u_resolution.xy;
    
    float scale = 1.2;

    vec2 scaled_uv = vec2(scale * uv.x * uv.y, scale * uv.y * uv.y);

    float d=length(uv-vec2(0.5));
    gl_FragColor=vec4(
        uv * (1.0 - sin(d*10.-u_time)*0.5+0.5), 
        0.6 * sin(d*10.-u_time)*0.5+0.5 * sin(d*10.-u_time)*0.5+0.5, 1.
        );
}