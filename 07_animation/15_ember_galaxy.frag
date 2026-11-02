// Ember Galaxy — inspired by Kurt Moerman (@KurtMoerman4), screenshot dated
// 2026-11-01 supplied by the user. An original inverse-field approximation,
// not a pixel-exact port of the 10,000-point p5 sketch.
// ShaderToy: paste this entire source into Image. No channels or buffers.
// Drag to alter inclination and rotation. The local host also exposes controls.
#ifdef EMBER_HOST
uniform float uSpeed, uTwist, uTilt, uYaw, uGlow, uPalette;
#else
const float uSpeed = 1.0;
const float uTwist = 3.0;
const float uTilt = 0.48;
const float uYaw = -0.35;
const float uGlow = 1.0;
const float uPalette = 0.0;
#endif
vec3 emberHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    q += dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yzz) * q.zyx);
}
mat2 emberRotation(float a) { float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
// Bounded 3x3 neighborhood: every star has support < 0.5 cell. No star-count loop.
float emberStars(vec2 p, float density, float footprint, float layer) {
    vec2 cell=floor(p), local=fract(p);
    float sum=0.0;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
        vec2 offset=vec2(float(x),float(y));
        vec3 h=emberHash(cell+offset+layer*51.7);
        vec2 delta=local-offset-(.15+.7*h.xy);
        float radius=mix(.035,.11,h.z);
        float aa=min(.22,max(.012,footprint));
        float star=1.0-smoothstep(radius, radius+aa,length(delta));
        sum+=star * step(h.z, density) * mix(.35,1.1,h.y);
    }
    return sum;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv=(fragCoord-.5*iResolution.xy)/iResolution.y;
    float tilt=uTilt, yaw=uYaw;
    if(iMouse.z>0.0) { tilt=mix(.14,1.,clamp(iMouse.y/iResolution.y,0.,1.)); yaw=(iMouse.x/iResolution.x-.5)*6.283185; }
    vec2 screen=emberRotation(yaw)*uv;
    vec2 plane=vec2(screen.x,screen.y/max(.12,tilt))*3.8;
    float r=length(plane);
    float time=iTime*uSpeed*.16;
    vec2 field=emberRotation(-uTwist*r-time/(1.+r*.22))*plane;
    field.y/= .78;
    float density=clamp(exp(-r*.84)*.82,0.,.96);
    float footprint=3.8/iResolution.y/max(.12,tilt);
    float stars=0.;
    for(int layer=0;layer<3;layer++) {
        float scale=24.+float(layer)*13.;
        // Conservative analytic footprint including radial twist (no derivatives).
        float aa=footprint*scale*(1.+abs(uTwist)*r)*.4;
        stars+=emberStars(field*scale+float(layer)*17.31,density,aa,float(layer))*(.56-float(layer)*.12);
    }
    vec3 inner=vec3(1.,.72,.20), outer=vec3(.85,.035,.006);
    if(uPalette>.5) {inner=vec3(.55,.94,1.);outer=vec3(.23,.035,.85);}
    if(uPalette>1.5) {inner=vec3(1.,.84,.64);outer=vec3(.8,.025,.19);}
    vec3 spectrum=mix(inner,outer,smoothstep(.1,2.5,r));
    float arms=.5+.5*cos(atan(plane.y,plane.x)*2.+uTwist*r*2.+time*2.);
    float haze=exp(-r*2.7)*(.07+.05*arms);
    float core=exp(-dot(plane,plane)*19.)*.9+exp(-r*5.)*.22;
    vec3 color=vec3(.0025,.0028,.0045)+uGlow*(spectrum*(stars+haze)+inner*core);
    // Sparse, stationary background stars; the galaxy remains the focal point.
    vec2 bg=uv*360.;vec3 h=emberHash(floor(bg)+71.);
    float pin=(1.-smoothstep(.025,.16,length(fract(bg)-h.xy)))*step(.997,h.z);
    color+=vec3(.12,.14,.18)*pin;
    color=1.-exp(-color*1.7);
    color*=1.-.28*smoothstep(.25,1.,length(uv));
    fragColor=vec4(pow(max(color,0.),vec3(.85)),1.);
}
