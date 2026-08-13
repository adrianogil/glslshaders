#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform sampler2D u_texture;

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    // The weight vector for luminance in sRGB is
    const vec3 W = vec3( 0.2125, 0.7154, 0.0721 );

    vec3 rgb = texture2D(u_texture, st).rgb;

    float luminance = dot(rgb, W);

    gl_FragColor = vec4(luminance, luminance, luminance, 1.0);
}
