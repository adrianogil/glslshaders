// Controllable neural 3D eye — Shadertoy Image pass.
// iChannel0: Buffer A (10_neural_iris_material.frag).
// No external images, includes, JavaScript controls, or model downloads.
// Drag the upper scene to pose; upper bar = iris hue, lower bar = pupil.
// Click the small button at the bottom right to resume the oblique orbit.
// Based on neural-shaders-pocs commit d2872f5; geometry/optics are analytic,
// while the unchanged 2,659-parameter SIREN supplies cached iris pigment.
precision highp float;
vec2 u_resolution,u_pose;
float u_pupil,u_time;
int u_view,u_refraction;

const float PI = 3.14159265359;
const float CORNEA_RADIUS = 0.62;
const vec3 CORNEA_CENTER = vec3(0.0, 0.0, 0.58);
// Exact intersection circle of the unit sclera and offset corneal sphere.
const float LIMBUS_Z = (1.0 + 0.58 * 0.58 - 0.62 * 0.62) / (2.0 * 0.58);
const float IRIS_Z = 0.745;
const float IRIS_CURVATURE = 0.25;
const float IRIS_RADIUS = 0.552;

mat3 rotateX(float a) {
  float c=cos(a),s=sin(a);
  return mat3(1,0,0, 0,c,s, 0,-s,c);
}
mat3 rotateY(float a) {
  float c=cos(a),s=sin(a);
  return mat3(c,0,-s, 0,1,0, s,0,c);
}
float hash(float x) { return fract(sin(x*127.1)*43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise3(vec3 p) {
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { return .57*noise3(p)+.28*noise3(p*2.03)+.15*noise3(p*4.09); }

vec2 sphereRoots(vec3 ro,vec3 rd,vec3 center,float radius) {
  vec3 o=ro-center;float b=dot(o,rd),c=dot(o,o)-radius*radius,h=b*b-c;
  if(h<0.0)return vec2(-1.0);
  return -b+vec2(-1.0,1.0)*sqrt(h);
}
float positiveRoot(vec2 roots) {
  return roots.x>0.0001?roots.x:(roots.y>0.0001?roots.y:1e5);
}
// Concave iris, recessed behind the transparent cap, with a real pupil opening.
float irisIntersection(vec3 ro,vec3 rd) {
  float a=IRIS_CURVATURE*dot(rd.xy,rd.xy);
  float b=2.0*IRIS_CURVATURE*dot(ro.xy,rd.xy)-rd.z;
  float c=IRIS_Z+IRIS_CURVATURE*dot(ro.xy,ro.xy)-ro.z;
  if(abs(a)<1e-6)return abs(b)>1e-6?max(-c/b,0.0):1e5;
  float d=b*b-4.0*a*c;
  if(d<0.0)return 1e5;
  return positiveRoot(vec2((-b-sqrt(d))/(2.0*a),(-b+sqrt(d))/(2.0*a)));
}

float softbox(vec3 d,vec3 center,vec2 extent,float softness) {
  center=normalize(center);
  vec3 right=normalize(cross(vec3(0,1,0),center)),up=cross(center,right);
  float facing=dot(d,center);
  vec2 q=vec2(dot(d,right),dot(d,up))/max(facing,0.001);
  vec2 mask=1.0-smoothstep(extent,extent+softness,abs(q));
  return mask.x*mask.y*step(0.0,facing);
}
vec3 environment(vec3 d,float roughness) {
  vec3 light=mix(vec3(.035,.050,.065),vec3(.17,.22,.27),smoothstep(-.25,.85,d.y));
  light+=vec3(13.0,12.2,10.8)*softbox(d,vec3(-.65,.95,1.3),vec2(.22,.36),.018+roughness);
  light+=vec3(3.0,5.0,6.0)*softbox(d,vec3(1.0,.35,.35),vec2(.035,.55),.01+roughness);
  light+=vec3(2.1,2.3,2.4)*softbox(d,vec3(-.15,1.0,-.65),vec2(.35,.28),.04+roughness);
  return light;
}
vec3 diffuseLight(vec3 n) {
  vec3 key=normalize(vec3(-.65,.95,1.3)),rim=normalize(vec3(1.0,.35,-.45));
  float wrap=pow(max((dot(n,key)+.20)/1.20,0.0),1.4);
  return vec3(.10,.135,.17)+vec3(1.10,1.01,.88)*wrap+vec3(.10,.17,.20)*max(dot(n,rim),0.0);
}
float fresnel(float cosine,float f0) { return f0+(1.0-f0)*pow(1.0-clamp(cosine,0.0,1.0),5.0); }

vec3 scleraPigment(vec3 n) {
  float azimuth=atan(n.y,n.x),polar=acos(clamp(n.z,-1.0,1.0));
  float sector=(azimuth+PI)/(2.0*PI)*23.0,id=floor(sector),x=fract(sector)-.5;
  float seed=hash(id+4.0);
  float bend=.10*sin(polar*13.0+seed*20.0)+.045*sin(polar*29.0+seed*7.0);
  float width=.007+.004*seed;
  float trunk=exp(-pow((x-bend)/width,2.0));
  float branch=exp(-pow((x-bend-(polar-1.3)*(.18+.2*seed))/(width*.6),2.0));
  branch*=smoothstep(1.2,1.5,polar)*step(.45,seed);
  float vessel=(trunk+.55*branch)*smoothstep(.65+.45*seed,1.15+.3*seed,polar);
  float mottling=fbm(n*16.0);
  vec3 ivory=mix(vec3(.66,.58,.48),vec3(.87,.84,.73),.50+.45*mottling);
  ivory=mix(ivory,vec3(.35,.068,.047),.28*clamp(vessel,0.0,1.0));
  float limbalWarmth=exp(-pow((polar-.64)/.17,2.0));
  return ivory*mix(vec3(1),vec3(.95,.89,.86),limbalWarmth);
}

// Manual bilinear sampling wraps the iris angle without blending metadata or
// unused buffer pixels. Independent of the host's texture filter/wrap setting.
vec3 decodedIris(float angle,float radial) {
  ivec2 size=min(textureSize(iChannel0,0)-ivec2(0,1),ivec2(512,256));
  vec2 p=vec2(fract(angle/(2.0*PI)+.5),clamp(radial,0.0,1.0))*vec2(size)-.5;
  ivec2 b=ivec2(floor(p)); vec2 f=fract(p);
  int x0=(b.x+size.x)%size.x,x1=(b.x+1+size.x)%size.x;
  int y0=clamp(b.y,0,size.y-1)+1,y1=clamp(b.y+1,0,size.y-1)+1;
  return mix(mix(texelFetch(iChannel0,ivec2(x0,y0),0).rgb,texelFetch(iChannel0,ivec2(x1,y0),0).rgb,f.x),
             mix(texelFetch(iChannel0,ivec2(x0,y1),0).rgb,texelFetch(iChannel0,ivec2(x1,y1),0).rgb,f.x),f.y);
}
vec3 irisPigment(vec2 p,float pupilRadius,out float relief) {
  float r=length(p),angle=atan(p.y,p.x);
  float radial=clamp((r-pupilRadius)/(IRIS_RADIUS-pupilRadius),0.0,1.0);
  vec3 pigment=decodedIris(angle,radial);
  vec3 polar=vec3(cos(angle)*7.0,sin(angle)*7.0,radial*3.5);
  float branching=fbm(polar*3.0);
  float fibers=sin(93.0*angle+11.0*radial+6.0*branching);
  fibers*=sin(41.0*angle-8.0*radial+3.0*branching);
  float fine=sin(181.0*angle+24.0*radial+5.0*branching);
  float aa=1.0-smoothstep(.6,2.6,fwidth(angle*93.0));
  float fineAA=1.0-smoothstep(.6,2.6,fwidth(angle*181.0));
  float structure=.73+.28*branching+.22*fibers*aa+.045*fine*fineAA;
  float crypts=pow(smoothstep(.38,.72,fbm(polar*5.0)),3.0)*exp(-pow((radial-.30)/.20,2.0));
  float collarette=exp(-pow((radial-(.22+.045*sin(17.0*angle)))/.07,2.0));
  pigment*=structure*(1.0-.58*crypts);
  pigment=mix(pigment,pigment*vec3(1.28,1.04,.63),.48*collarette);
  pigment*=.66+.25*sin(PI*radial);
  pigment*=1.0-.77*smoothstep(.88,1.0,radial);
  pigment*=.40+.60*smoothstep(0.0,.10,radial);
  relief=fibers*aa*.008+branching*.010;
  return pigment;
}

vec3 interior(vec3 ro,vec3 rd,float pupilRadius,mat3 toWorld,out vec3 localNormal) {
  float t=irisIntersection(ro,rd);
  vec3 p=ro+rd*t;float r=length(p.xy);
  localNormal=normalize(vec3(-2.0*IRIS_CURVATURE*p.xy,1.0));
  if(t>10.0||r>IRIS_RADIUS)return vec3(.018,.022,.018);
  float aa=max(fwidth(r),.001);
  float opening=smoothstep(pupilRadius-aa,pupilRadius+aa,r);
  if(r<pupilRadius-aa)return vec3(.0007,.0011,.0015);
  float relief;
  vec3 pigment=irisPigment(p.xy,pupilRadius,relief);
  vec3 tangent=normalize(vec3(-p.y,p.x,0.0)+vec3(1e-5));
  localNormal=normalize(localNormal+tangent*relief);
  vec3 n=toWorld*localNormal;
  vec3 diffuse=pigment*diffuseLight(n);
  // The limbus occludes light reaching the recessed outer iris.
  diffuse*=.73+.27*smoothstep(0.0,.14,IRIS_RADIUS-r);
  return mix(vec3(.0007,.0011,.0015),diffuse,opening);
}

vec3 scene(vec3 ro,vec3 rd) {
  mat3 toWorld=rotateY(u_pose.x)*rotateX(u_pose.y),toLocal=transpose(toWorld);
  vec3 o=toLocal*ro,d=toLocal*rd;
  vec2 sphere=sphereRoots(o,d,vec3(0),1.0);
  vec2 cornea=sphereRoots(o,d,CORNEA_CENTER,CORNEA_RADIUS);
  float tEye=1e5,tCornea=1e5;
  // Root clipping creates an actual bulging silhouette, not a normal-map trick.
  for(int i=0;i<2;i++) {
    if(sphere[i]>.001&&(o+d*sphere[i]).z<=LIMBUS_Z)tEye=min(tEye,sphere[i]);
    if(cornea[i]>.001&&(o+d*cornea[i]).z>=LIMBUS_Z)tCornea=min(tCornea,cornea[i]);
  }
  float t=min(tEye,tCornea);
  float floorT=(-1.10-ro.y)/rd.y;
  vec3 backdrop=vec3(.017,.026,.032);
  vec3 color=backdrop;
  if(floorT>0.0) {
    vec3 floorPoint=ro+floorT*rd;
    float shadow=exp(-dot(floorPoint.xz-vec2(.18,-.03),floorPoint.xz-vec2(.18,-.03))/1.13);
    float contact=exp(-dot(floorPoint.xz,floorPoint.xz)/.23);
    float glow=exp(-dot(floorPoint.xz,floorPoint.xz)/9.0);
    color=vec3(.030,.044,.051)*(1.0+.65*glow)*(1.0-.65*shadow)*(1.0-.35*contact);
    color=mix(color,backdrop,1.0-exp(-.09*floorT));
  }
  if(t>100.0||floorT>0.0&&floorT<t)return color;
  vec3 background=color;
  vec3 p=o+d*t;
  bool isCornea=tCornea<tEye;
  if(isCornea) {
    vec3 n=normalize(p-CORNEA_CENTER),worldNormal=toWorld*n;
    float f=fresnel(dot(-d,n),.0255);
    vec3 transmitted=u_refraction==1?refract(d,n,1.0/1.376):d;
    vec3 irisNormal;
    float pupilRadius=.135+.145*u_pupil+.008*sin(2.0*PI*u_time);
    vec3 through=interior(p+transmitted*.0005,transmitted,pupilRadius,toWorld,irisNormal);
    vec3 reflected=environment(reflect(rd,worldNormal),.006);
    color=through*(1.0-f)*vec3(.98,.99,1.0)+reflected*f;
    if(u_view==1)color=(worldNormal*.5+.5)*.75;
  }else{
    vec3 n=normalize(p),worldNormal=toWorld*n;
    vec3 pigment=scleraPigment(n);
    float f=fresnel(dot(-rd,worldNormal),.028);
    color=pigment*diffuseLight(worldNormal);
    color+=environment(reflect(rd,worldNormal),.12)*f*.55;
    if(u_view==1)color=(worldNormal*.5+.5)*.75;
  }
  // Filter the two true silhouettes in screen space. This softens only the
  // subpixel boundary; surface detail is not blurred by a whole-image filter.
  float hSclera=1.0-(dot(o,o)-pow(dot(o,d),2.0));
  vec3 co=o-CORNEA_CENTER;
  float hCornea=CORNEA_RADIUS*CORNEA_RADIUS-(dot(co,co)-pow(dot(co,d),2.0));
  vec3 closestCap=o-d*dot(co,d);
  float globeCoverage=smoothstep(0.0,max(fwidth(hSclera),1e-5),hSclera);
  float capCoverage=smoothstep(0.0,max(fwidth(hCornea),1e-5),hCornea)*step(LIMBUS_Z,closestCap.z);
  return mix(background,color,max(globeCoverage,capCoverage));
}
vec3 displayColor(vec3 linear) {
  vec3 x=max(linear*1.15,0.0);
  x=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);
  return mix(x*12.92,1.055*pow(x,vec3(1.0/2.4))-.055,step(vec3(.0031308),x));
}

vec3 controlOverlay(vec3 color,vec2 p,vec4 controls,float manual) {
  float aspect=iResolution.x/iResolution.y;
  float pixel=1.0/iResolution.y;
  for(int row=0;row<2;row++) {
    float y=row==0?.15:.07,value=row==0?controls.z:controls.y;
    vec2 bar=vec2(max(abs(p.x-.5)-.35,0.0)*aspect,p.y-y);
    float track=1.0-smoothstep(.009,.009+pixel,length(bar));
    float t=clamp((p.x-.15)/.70,0.0,1.0);
    vec3 tint=row==0?(.5+.3*cos(6.2831853*(t+vec3(.04,-.30,-.58)))):mix(vec3(.2),vec3(.75),t);
    color=mix(color,tint,track*.85);
    float knob=length((p-vec2(.15+.70*value,y))*vec2(aspect,1));
    color=mix(color,vec3(.95,.96,.9),1.0-smoothstep(.014,.014+pixel,knob));
    color=mix(color,row==0?vec3(.12,.45,.48):vec3(.03),1.0-smoothstep(.009,.009+pixel,knob));
    float icon=length((p-vec2(.095,y))*vec2(aspect,1));
    color=mix(color,vec3(.7),1.0-smoothstep(.014,.014+pixel,icon));
    color=mix(color,row==0?vec3(.12,.55,.58):vec3(.02),1.0-smoothstep(.009,.009+pixel,icon));
  }
  vec2 button=(p-vec2(.94,.11))*vec2(aspect,1);
  float ring=1.0-smoothstep(.002,.002+pixel,abs(length(button)-.014));
  return mix(color,manual>.5?vec3(.30,.38,.40):vec3(.32,.8,.7),ring);
}
void mainImage(out vec4 fragColor,in vec2 fragCoord) {
  vec4 controls=texelFetch(iChannel0,ivec2(0,0),0);
  float manual=texelFetch(iChannel0,ivec2(1,0),0).x;
  float phase=6.28318530718*iTime/10.0;
  float yaw=25.0+57.0*controls.x,pitch=-22.0+44.0*controls.w;
  if(manual<.5){yaw+=12.0*sin(phase)+3.0*sin(2.0*phase);pitch+=5.0*sin(phase+.6);}
  u_pose=radians(vec2(clamp(yaw,25.0,82.0),clamp(pitch,-22.0,22.0)));
  u_pupil=controls.y;u_time=fract(iTime/10.0);u_view=0;u_refraction=1;
  u_resolution=vec2(iResolution.x,iResolution.y*.78);
  vec2 sceneCoord=fragCoord-vec2(0,iResolution.y*.22);
  vec2 uv=(sceneCoord-.5*u_resolution)/u_resolution.y;
  vec3 camera=vec3(0,.48,4.6),target=vec3(0,-.04,0);
  vec3 forward=normalize(target-camera),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
  float focal=1.75*min(1.0,u_resolution.x/u_resolution.y/1.05);
  vec3 ray=normalize(forward*focal+right*uv.x+up*uv.y);
  vec3 color=displayColor(scene(camera,ray));
  color+=(hash3(vec3(fragCoord,0))-.5)/255.0;
  if(fragCoord.y<iResolution.y*.22)color=controlOverlay(vec3(.035,.055,.066),fragCoord/iResolution.xy,controls,manual);
  fragColor=vec4(clamp(color,0.0,1.0),1);
}
