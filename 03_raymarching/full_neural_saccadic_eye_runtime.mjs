// Host for the seven-input whole-image network; no procedural eye renderer.
export const header=`#version 300 es
#define FULL_GAZE_LOCAL
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform vec4 uControls;
uniform int uManual;
uniform int uProbeMode;
uniform vec2 uProbePosition;
uniform vec4 uProbeControls;
out vec4 outputColor;
`;
export const footer='\nvoid main(){mainImage(outputColor,gl_FragCoord.xy);}\n';
const vertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;

export async function createRenderer(canvas,source) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL 2 is required.');
  const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);return s;};
  const program=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,header+source+footer);
  gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
  const parallel=gl.getExtension('KHR_parallel_shader_compile'),start=performance.now();
  if(parallel)while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){
    if(gl.isContextLost()||performance.now()-start>60000)throw Error('GPU compilation failed or timed out.');
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  for(const s of [v,f])if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader compilation failed.');
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Program failed to link.');
  gl.deleteShader(v);gl.deleteShader(f);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.useProgram(program);gl.disable(gl.DITHER);
  const uniforms=Object.fromEntries(['iResolution','iTime','iMouse','uControls','uManual','uProbeMode','uProbePosition','uProbeControls'].map(k=>[k,gl.getUniformLocation(program,k)]));
  function draw(time=0,controls=[.5,.4,.56,.46],manual=false,mouse=[0,0,0,0]){
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    gl.useProgram(program);gl.bindVertexArray(vao);
    gl.uniform3f(uniforms.iResolution,canvas.width,canvas.height,1);gl.uniform1f(uniforms.iTime,time);
    gl.uniform4fv(uniforms.uControls,controls);gl.uniform4fv(uniforms.iMouse,mouse);gl.uniform1i(uniforms.uManual,manual?1:0);
    gl.uniform1i(uniforms.uProbeMode,0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function pixels(){const result=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,result);return result;}
  function probes(fixture){
    if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float targets are required for parity checks.');
    const tex=gl.createTexture(),fbo=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Parity framebuffer incomplete.');
    gl.viewport(0,0,1,1);gl.uniform1i(uniforms.uProbeMode,1);gl.uniform3f(uniforms.iResolution,1,1,1);
    const result=[];
    for(let i=0;i<fixture.xy.length;i++){
      gl.uniform2fv(uniforms.uProbePosition,fixture.xy[i]);gl.uniform4fv(uniforms.uProbeControls,fixture.controls[i]);
      gl.drawArrays(gl.TRIANGLES,0,3);const rgba=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,rgba);result.push(Array.from(rgba.slice(0,3)));
    }
    gl.deleteFramebuffer(fbo);gl.deleteTexture(tex);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.uniform1i(uniforms.uProbeMode,0);
    return result;
  }
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {gl,draw,pixels,probes,renderer:gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
    dispose(){gl.deleteProgram(program);gl.deleteVertexArray(vao);}};
}

export async function validate(renderer,canvas,fixture,source){
  const saved=[canvas.width,canvas.height];canvas.width=160;canvas.height=120;
  const checks={},measurements={};
  const diff=(a,b)=>a.reduce((s,v,i)=>s+(i%4===3?0:Math.abs(v-b[i])),0)/(a.length*.75*255);
  const parity=renderer.probes(fixture),errors=parity.flatMap((rgb,i)=>rgb.map((v,j)=>Math.abs(v-fixture.rgb[i][j])));
  measurements.parity_max=Math.max(...errors);measurements.parity_mae=errors.reduce((s,v)=>s+v,0)/errors.length;
  checks.pytorch_glsl_parity=errors.every(Number.isFinite)&&measurements.parity_max<.0005;
  const center=[.5,.35,.56,.46];renderer.draw(0,center,true);const base=renderer.pixels();
  checks.visible_image=base.some((v,i)=>i%4!==3&&v>190);
  for(const [key,c] of Object.entries({yaw:[.92,.35,.56,.46],pitch:[.5,.35,.56,.95],pupil:[.5,.90,.56,.46],hue:[.5,.35,.04,.46]})){
    renderer.draw(0,c,true);measurements[key+'_mae']=diff(base,renderer.pixels());checks[key+'_response']=measurements[key+'_mae']>.001;
  }
  renderer.draw(0);const loop=renderer.pixels();renderer.draw(10);measurements.loop_mae=diff(loop,renderer.pixels());checks.loop_closed=measurements.loop_mae===0;
  renderer.draw(2);measurements.animation_mae=diff(loop,renderer.pixels());checks.animation_response=measurements.animation_mae>.01;
  renderer.draw(0,center,false,[80,10,80,10]);const low=renderer.pixels();
  renderer.draw(0,center,false,[80,110,80,10]);measurements.vertical_mouse_mae=diff(low,renderer.pixels());checks.vertical_mouse_gaze=measurements.vertical_mouse_mae>.01;
  renderer.draw(0,center,false,[10,60,10,60]);const left=renderer.pixels();
  renderer.draw(0,center,false,[150,60,10,60]);measurements.horizontal_mouse_mae=diff(left,renderer.pixels());checks.horizontal_mouse_gaze=measurements.horizontal_mouse_mae>.01;
  renderer.draw(0);checks.mouse_release_resumes_animation=diff(loop,renderer.pixels())===0;
  const blankCanvas=document.createElement('canvas');blankCanvas.width=32;blankCanvas.height=32;
  const ablated=source.replace(/\/\/ BEGIN TRAINED FULL-IMAGE NETWORK[\s\S]*?\/\/ END TRAINED FULL-IMAGE NETWORK/,'vec3 neuralFullEye(vec2 p,vec4 controls){return vec3(0.); }');
  if(ablated===source)throw Error('Missing neural function boundary.');
  const blank=await createRenderer(blankCanvas,ablated);blank.draw(2);checks.zero_network_removes_whole_image=blank.pixels().every((v,i)=>i%4===3?v===255:v===0);blank.dispose();
  const glErrors=[];for(let i=0;i<16;i++){const e=renderer.gl.getError();if(!e)break;glErrors.push(e);}checks.no_gl_errors=glErrors.length===0;
  [canvas.width,canvas.height]=saved;
  return {passed:Object.values(checks).every(Boolean),checks,measurements,probes:parity.length,renderer:renderer.renderer,
    gl_errors:glErrors,captured_at:new Date().toISOString(),scope:'Local WebGL validation of 7-input full-image neural shader; independent of previous fixed-pitch evidence.'};
}
