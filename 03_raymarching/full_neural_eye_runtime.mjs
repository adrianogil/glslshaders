// Single-pass full-image inference host. No teacher/material shaders are loaded.
export const header=`#version 300 es
#define FULL_EYE_LOCAL
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform vec4 uControls;
uniform int uProbeMode;
uniform vec2 uProbePosition;
uniform vec3 uProbeControls;
out vec4 outputColor;
`;
export const footer='\nvoid main(){mainImage(outputColor,gl_FragCoord.xy);}\n';
const vertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;

export async function createRenderer(canvas,source) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl) throw Error('WebGL 2 is required.');
  function compile(type,text) {
    const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);
    return shader;
  }
  const parallel=gl.getExtension('KHR_parallel_shader_compile');
  const program=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,header+source+footer);
  gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
  if(parallel){const start=performance.now();while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){
    if(gl.isContextLost()||performance.now()-start>60000)throw Error('GPU network compilation failed or timed out.');
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }}
  for(const shader of [v,f])if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'GPU shader compilation failed.');
  gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||
    (gl.isContextLost()?'GPU context was lost while compiling the network. Reload to retry.':'Network program failed to link.'));
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.useProgram(program);gl.disable(gl.DITHER);
  const uniforms=Object.fromEntries(['iResolution','iTime','iMouse','uControls','uProbeMode','uProbePosition','uProbeControls']
    .map(key=>[key,gl.getUniformLocation(program,key)]));
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  function draw(time=0,controls=[.365,.35,.56,0],mouse=[0,0,0,0]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform3f(uniforms.iResolution,canvas.width,canvas.height,1);gl.uniform1f(uniforms.iTime,time);
    gl.uniform4fv(uniforms.uControls,controls);gl.uniform4fv(uniforms.iMouse,mouse);
    gl.uniform1i(uniforms.uProbeMode,0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function pixels(){const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
  function probes(fixture) {
    if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float readback is required for parity validation only.');
    const texture=gl.createTexture(),fbo=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete parity framebuffer.');
    gl.viewport(0,0,1,1);gl.uniform1i(uniforms.uProbeMode,1);gl.uniform3f(uniforms.iResolution,1,1,1);
    const result=[];
    for(let i=0;i<fixture.xy.length;i++){
      gl.uniform2fv(uniforms.uProbePosition,fixture.xy[i]);gl.uniform3fv(uniforms.uProbeControls,fixture.controls[i]);
      gl.drawArrays(gl.TRIANGLES,0,3);const pixel=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,pixel);
      result.push(Array.from(pixel.slice(0,3)));
    }
    gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.uniform1i(uniforms.uProbeMode,0);
    return result;
  }
  return {gl,draw,pixels,probes,renderer:gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
    dispose(){gl.deleteProgram(program);gl.deleteVertexArray(vao);}};
}

export async function validate(renderer,canvas,fixture,source) {
  const original=[canvas.width,canvas.height];canvas.width=160;canvas.height=120;
  const checks={},measurements={};
  const diff=(a,b)=>a.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-b[i])),0)/(a.length*.75*255);
  const parity=renderer.probes(fixture);
  const errors=parity.flatMap((rgb,i)=>rgb.map((v,j)=>Math.abs(v-fixture.rgb[i][j])));
  measurements.parity_max=Math.max(...errors);measurements.parity_mae=errors.reduce((s,v)=>s+v,0)/errors.length;
  checks.pytorch_glsl_parity=errors.every(Number.isFinite)&&measurements.parity_max<.0005;
  renderer.draw(0,[.365,.35,.56,1]);const base=renderer.pixels();
  checks.visible_image=base.some((v,i)=>i%4!==3&&v>190);
  for(const [key,c] of Object.entries({view:[.94,.35,.56,1],pupil:[.365,.94,.56,1],hue:[.365,.35,.04,1]})) {
    renderer.draw(0,c);measurements[key+'_mae']=diff(base,renderer.pixels());checks[key+'_response']=measurements[key+'_mae']>.0005;
  }
  renderer.draw(0);const start=renderer.pixels();renderer.draw(10);measurements.loop_mae=diff(start,renderer.pixels());
  checks.loop_closed=measurements.loop_mae<.00001;
  renderer.draw(2.5);measurements.animation_mae=diff(start,renderer.pixels());checks.animation_response=measurements.animation_mae>.005;
  renderer.draw(0,[.365,.35,.56,0],[155,100,80,60]);measurements.mouse_mae=diff(start,renderer.pixels());
  checks.shadertoy_mouse_response=measurements.mouse_mae>.005;
  renderer.draw(0);checks.mouse_release_resumes_orbit=diff(start,renderer.pixels())===0;
  // An actual GPU ablation: removing neural RGB must remove the WHOLE image,
  // including the backdrop. This derived shader is used only by this test.
  const blankCanvas=document.createElement('canvas');blankCanvas.width=32;blankCanvas.height=32;
  const ablated=source.replace(/\/\/ BEGIN TRAINED FULL-IMAGE NETWORK[\s\S]*?\/\/ END TRAINED FULL-IMAGE NETWORK/,
    'vec3 neuralFullEye(vec2 p,vec3 controls){return vec3(0.); }');
  if(ablated===source)throw Error('Could not isolate the neural function for the ablation.');
  const blank=await createRenderer(blankCanvas,ablated);blank.draw(2.5);
  checks.zero_network_removes_whole_image=blank.pixels().every((v,i)=>i%4===3?v===255:v===0);blank.dispose();
  const glErrors=[];for(let i=0;i<16;i++){const e=renderer.gl.getError();if(!e)break;glErrors.push(e);}
  checks.no_gl_errors=glErrors.length===0;
  [canvas.width,canvas.height]=original;
  return {passed:Object.values(checks).every(Boolean),checks,measurements,probes:parity.length,
    renderer:renderer.renderer,gl_errors:glErrors,captured_at:new Date().toISOString(),
    scope:'Local WebGL 2 execution of the exact Shadertoy network; not a shadertoy.com execution claim.'};
}
