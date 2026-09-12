// Minimal WebGL 2 host for the exact two Shadertoy mainImage programs.
export const fragmentHeader = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
out vec4 outputColor;
`;
export const fragmentFooter = '\nvoid main(){mainImage(outputColor,gl_FragCoord.xy);}\n';
const vertexSource = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}`;

export function createEyeRenderer(canvas, imageSource, materialSource) {
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false});
  if (!gl) throw new Error('This preview requires WebGL 2.');
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('Floating-point render targets are required for the neural material and control feedback.');
  }
  gl.disable(gl.DITHER);
  const resources = [];
  function shader(type, source) {
    const object = gl.createShader(type);
    gl.shaderSource(object, source); gl.compileShader(object);
    if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(object); gl.deleteShader(object);
      throw new Error(message);
    }
    return object;
  }
  function program(source) {
    const object = gl.createProgram(), vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentHeader + source + fragmentFooter);
    gl.attachShader(object, vertex); gl.attachShader(object, fragment); gl.linkProgram(object);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(object, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(object));
    resources.push(object);
    const uniforms = Object.fromEntries(['iResolution', 'iTime', 'iFrame', 'iMouse', 'iChannel0']
      .map(name => [name, gl.getUniformLocation(object, name)]));
    return {object, uniforms};
  }
  const material = program(materialSource), image = program(imageSource);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  let width = 0, height = 0, frame = 0, buffers = [], front = 0, output;
  let lastTime = 0, lastMouse = [0, 0, 0, 0];
  function target() {
    const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete floating-point framebuffer.');
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return {texture, framebuffer};
  }
  function discardTargets() {
    for (const item of [...buffers, output].filter(Boolean)) {
      gl.deleteTexture(item.texture); gl.deleteFramebuffer(item.framebuffer);
    }
    buffers = []; output = undefined;
  }
  function resize(w, h) {
    w = Math.max(16, Math.floor(w)); h = Math.max(16, Math.floor(h));
    if (w === width && h === height) return false;
    discardTargets(); width = w; height = h;
    canvas.width = w; canvas.height = h;
    buffers = [target(), target()]; front = 0; frame = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }
  function pass(program, texture, framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.viewport(0, 0, width, height);
    gl.useProgram(program.object); gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    const u = program.uniforms;
    gl.uniform1i(u.iChannel0, 0); gl.uniform3f(u.iResolution, width, height, 1);
    gl.uniform1f(u.iTime, lastTime); gl.uniform1i(u.iFrame, frame);
    gl.uniform4fv(u.iMouse, lastMouse); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function draw(time = 0, mouse = [0, 0, 0, 0]) {
    lastTime = time; lastMouse = mouse;
    const back = 1 - front;
    // Never sample a texture attached to the current output framebuffer.
    pass(material, buffers[front].texture, buffers[back].framebuffer); front = back;
    pass(image, buffers[front].texture, null); frame++;
  }
  function pixels() {
    if (!output) output = target();
    pass(image, buffers[front].texture, output.framebuffer);
    const result = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, result);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return result;
  }
  function controls() {
    const result = new Float32Array(8);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffers[front].framebuffer);
    gl.readPixels(0, 0, 2, 1, gl.RGBA, gl.FLOAT, result);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); return Array.from(result);
  }
  function pigment() {
    const w = Math.min(width, 512), h = Math.min(height - 1, 256);
    const result = new Float32Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffers[front].framebuffer);
    gl.readPixels(0, 1, w, h, gl.RGBA, gl.FLOAT, result);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); return result;
  }
  return {gl, resize, draw, pixels, controls, pigment,
    reset() { frame = 0; },
    dispose() { discardTargets(); resources.forEach(p => gl.deleteProgram(p)); gl.deleteVertexArray(vao); },
  };
}

const mae = (a, b, offset = 0) => {
  let sum = 0;
  for (let i = offset; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / (a.length - offset);
};

// Uses the same shaders, mouse protocol, and ping-pong buffers as the preview.
// Synchronous by design: pause the animation while running this small GPU check.
export function validateEye(renderer) {
  const {gl} = renderer, checks = {}, measurements = {};
  const width = 256, height = 192, sceneOffset = Math.ceil(height * .22) * width * 4;
  const click = (x, y, time = 0) => renderer.draw(time, [x * width, y * height, x * width, y * height]);
  renderer.resize(width, height); renderer.reset(); renderer.draw(0);
  const initial = renderer.pixels(), originalPigment = renderer.pigment();
  checks.finite_default = initial.every(Number.isFinite);
  checks.visible_geometry = initial.reduce((maximum, value, i) => i % 4 === 3 ? maximum : Math.max(maximum, value), 0) > .6;
  click(.82, .61); renderer.draw(0);
  const turned = renderer.pixels(), held = renderer.controls();
  measurements.view_mae = mae(initial, turned, sceneOffset);
  checks.oblique_mouse_view = held[0] > .81 && held[4] === 1 && measurements.view_mae > .005;
  renderer.draw(0);
  checks.pose_persists_after_release = mae(held, renderer.controls()) < 1e-7;
  click(.15 + .70 * .95, .07); renderer.draw(0);
  measurements.pupil_mae = mae(turned, renderer.pixels(), sceneOffset);
  checks.pupil_control = measurements.pupil_mae > .0001 && renderer.controls()[1] > .94;
  checks.pose_and_pupil_reuse_pigment = mae(originalPigment, renderer.pigment()) === 0;
  click(.15 + .70 * .01, .15); renderer.draw(0);
  const amber = renderer.pigment();
  measurements.hue_pigment_mae = mae(originalPigment, amber);
  checks.hue_rebakes_neural_pigment = measurements.hue_pigment_mae > .01;
  renderer.draw(2);
  checks.cached_pigment_persists = mae(amber, renderer.pigment()) === 0;
  renderer.reset(); click(.15 + .70 * .01, .15); renderer.draw(0);
  checks.cached_matches_fresh_decode = mae(amber, renderer.pigment()) < 1e-7;
  renderer.reset(); renderer.draw(0); const start = renderer.pixels();
  renderer.draw(10); measurements.loop_mae = mae(start, renderer.pixels(), sceneOffset);
  checks.ten_second_loop = measurements.loop_mae < 1e-5;
  click(.82, .61); click(.94, .11);
  checks.resume_orbit_button = renderer.controls()[4] === 0;
  let nonfinite = 0;
  for (const x of [.001, .4, .8, .999]) for (const time of [0, 2.5, 5, 7.5]) {
    click(x, .65, time);
    for (const value of renderer.pixels()) if (!Number.isFinite(value)) nonfinite++;
  }
  checks.sixteen_oblique_states_finite = nonfinite === 0;
  const sizes = [[64, 64], [390, 520], [640, 360]];
  checks.resize_reinitializes_material = true;
  for (const [w, h] of sizes) {
    renderer.resize(w, h); renderer.draw(0);
    const c = renderer.controls(), p = renderer.pixels();
    checks.resize_reinitializes_material &&= c[6] === w && c[7] === h && p.every(Number.isFinite) && renderer.pigment().some(v => v > .2);
  }
  const errors = [];
  for (let i = 0; i < 16; i++) { const error = gl.getError(); if (error === gl.NO_ERROR) break; errors.push(error); }
  checks.no_gl_errors = errors.length === 0;
  renderer.reset(); renderer.draw(0);
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return {passed: Object.values(checks).every(Boolean), checks, measurements,
    states_checked: 16, resolutions_checked: [[width, height], ...sizes], gl_errors: errors,
    readback: 'RGBA32F', renderer: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
    captured_at: new Date().toISOString(),
    scope: 'Local WebGL 2 Shadertoy-compatible host; not a published or hosted Shadertoy test. No FPS or photorealism claim.'};
}
