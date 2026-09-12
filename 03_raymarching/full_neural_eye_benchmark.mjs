// Same-context, warmed, interleaved A/B benchmark. Not part of the image path.
import {header,footer} from './full_neural_eye_runtime.mjs';
const vertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const median=values=>{const a=[...values].sort((a,b)=>a-b);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
export const graphSignature=source=>source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')
  .replace(/(?<![\w])[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/g,'#').replace(/\s+/g,'');

export async function benchmark(before,after,progress=()=>{}) {
  if(graphSignature(before)!==graphSignature(after))throw Error('The candidate changes the execution graph, not just weight literals.');
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL 2 unavailable.');
  const parallel=gl.getExtension('KHR_parallel_shader_compile');
  let timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let timingNote=timer?'Native elapsed-time queries.':'GPU timer extension unavailable; measuring completion-synchronized wall time.';
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
  const programs=[];const shaders=[];
  function compile(type,text){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);return shader;}
  const vs=compile(gl.VERTEX_SHADER,vertex);
  for(const [name,source] of [['before',before],['after',after]]){
    const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,compile(gl.FRAGMENT_SHADER,header+source+footer));gl.linkProgram(program);
    programs.push({name,program});
  }
  const started=performance.now();progress('Compiling both models in one GPU context…');
  for(const p of programs){
    if(parallel)while(!gl.getProgramParameter(p.program,parallel.COMPLETION_STATUS_KHR)){
      if(gl.isContextLost()||performance.now()-started>60000)throw Error('A/B compilation failed or timed out.');await nextFrame();
    }
    if(!gl.getProgramParameter(p.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p.program)||'A/B program link failed.');
    p.uniforms=Object.fromEntries(['iResolution','iTime','iMouse','uControls','uProbeMode']
      .map(key=>[key,gl.getUniformLocation(p.program,key)]));
  }
  shaders.forEach(s=>gl.deleteShader(s));const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.disable(gl.DITHER);
  const texture=gl.createTexture(),fbo=gl.createFramebuffer();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  const states=[[.365,.35,.56,1],[.9,.35,.56,1],[.365,.05,.56,1],[.365,.95,.56,1],[.365,.35,.04,1],[.08,.35,.31,1]];
  let width,height;
  function draw(p,state){gl.useProgram(p.program);const u=p.uniforms;
    gl.uniform3f(u.iResolution,width,height,1);gl.uniform1f(u.iTime,0);gl.uniform4f(u.iMouse,0,0,0,0);
    gl.uniform4fv(u.uControls,state);gl.uniform1i(u.uProbeMode,0);gl.drawArrays(gl.TRIANGLES,0,3);}
  async function measure(p,state){
    const repeats=8;
    if(timer){
      const query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
      for(let n=0;n<repeats;n++)draw(p,state);gl.endQuery(timer.TIME_ELAPSED_EXT);gl.flush();
      const begin=performance.now();
      while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
        if(gl.isContextLost()||performance.now()-begin>5000)throw Error('GPU timer timed out.');await nextFrame();
      }
      if(gl.getParameter(timer.GPU_DISJOINT_EXT))throw Error('Disjoint GPU timer result; rerun after the GPU settles.');
      const ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6/repeats;gl.deleteQuery(query);return ms;
    }
    gl.finish();const begin=performance.now();for(let n=0;n<repeats;n++)draw(p,state);gl.finish();
    return (performance.now()-begin)/repeats;
  }
  const results=[];
  try{
    for(const size of [[384,288],[512,384]]){
      [width,height]=size;canvas.width=width;canvas.height=height;
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,width,height);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete A/B framebuffer.');
      progress(`Warming both models at ${width}×${height}…`);
      for(let n=0;n<24;n++)for(const p of programs)draw(p,states[n%6]);gl.finish();await nextFrame();
      for(const p of programs){
        draw(p,states[0]);const pixel=new Uint8Array(4);gl.readPixels(Math.floor(width/2),Math.floor(height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        if(Math.max(...pixel.slice(0,3))<128||pixel[3]!==255)throw Error('A/B target failed its visible-eye readback check.');
      }
      // Some Metal backends advertise timer queries but never return them.
      // Probe BEFORE collecting samples so a result never mixes timing methods.
      if(timer&&results.length===0){
        const q=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,q);draw(programs[0],states[0]);gl.endQuery(timer.TIME_ELAPSED_EXT);gl.finish();
        const start=performance.now();
        while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&performance.now()-start<1200)await nextFrame();
        if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)||gl.getParameter(timer.GPU_DISJOINT_EXT)){
          timer=null;timingNote='Timer extension advertised but its probe did not complete reliably; using GPU-completion-synchronized wall time for ALL samples.';
        }
        gl.deleteQuery(q);
      }
      const samples={before:[],after:[]},ratios=[];
      for(let round=0;round<24;round++){
        const times=[[],[]];const order=round%2?[1,0,0,1]:[0,1,1,0];
        for(const index of order){const value=await measure(programs[index],states[round%6]);times[index].push(value);samples[programs[index].name].push(value);}
        ratios.push(median(times[1])/median(times[0]));
        progress(`${width}×${height}: paired round ${round+1}/24`);await nextFrame();
      }
      const beforeMs=median(samples.before),afterMs=median(samples.after);
      results.push({resolution:size,before_median_ms:beforeMs,after_median_ms:afterMs,after_before_ratio:afterMs/beforeMs,
        paired_ratio_median:median(ratios),paired_ratio_p10:percentile(ratios,.1),paired_ratio_p90:percentile(ratios,.9),
        before_p95_ms:percentile(samples.before,.95),after_p95_ms:percentile(samples.after,.95),samples_ms:samples,paired_ratios:ratios});
    }
    const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('A/B GL error: '+error);
    return {passed:results.every(r=>r.after_before_ratio<=1.05&&r.paired_ratio_median<=1.05),
      identical_execution_graph:true,renderer,method:timer?'EXT_disjoint_timer_query_webgl2':'gl.finish-completed wall time (GPU + submission)',timing_note:timingNote,
      samples_per_model_per_resolution:48,draws_per_sample:8,order:'Alternating ABBA / BAAB, six fixed control states, same context and RGBA8 target',
      regression_tolerance:.05,results,captured_at:new Date().toISOString(),
      scope:'Paired local measurement, not universal hardware performance. No pixel-count or network-size reduction.'};
  }finally{programs.forEach(p=>gl.deleteProgram(p.program));gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.deleteVertexArray(vao);}
}
