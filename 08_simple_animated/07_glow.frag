// https://inspirnathan.com/posts/65-glow-shader-in-shadertoy/

#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main(void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy; // <0, 1>
    uv -= 0.5; // <-0.5,0.5>
    float scaleCorrection = 1.0;
    // Adjust for screen aspect ratio
    uv.x *= scaleCorrection * u_resolution.x / u_resolution.y;

    float scale = 3.0;
    uv = scale * uv;

    float d = length(uv) - 0.2; // signed distance value

    vec3 col = vec3(step(0., -d)); // create white circle with black background

    float glowLevel = 2.0 * (1.0 + sin(10.0*u_time));
    float glow = 0.01/d;
    glow = clamp(glow, 0., 1.);
    col += glowLevel * glow;

    gl_FragColor = vec4(col, 1.0); // output color
}


