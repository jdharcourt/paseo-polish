import { asciiGlyphs } from "./ascii-grid";
import type { AsciiWake } from "./ascii-wake";

type Resource = object;
type GL = Record<"VERTEX_SHADER" | "FRAGMENT_SHADER" | "COMPILE_STATUS" | "LINK_STATUS" | "ARRAY_BUFFER" | "STATIC_DRAW" | "FLOAT" | "TEXTURE_2D" | "TEXTURE0" | "TEXTURE1" | "TEXTURE2" | "TEXTURE_MIN_FILTER" | "TEXTURE_MAG_FILTER" | "TEXTURE_WRAP_S" | "TEXTURE_WRAP_T" | "LINEAR" | "CLAMP_TO_EDGE" | "LUMINANCE" | "UNSIGNED_BYTE" | "RGBA" | "TRIANGLES", number> & {
  createShader(kind: number): Resource | null;
  shaderSource(shader: Resource, source: string): void;
  compileShader(shader: Resource): void;
  getShaderParameter(shader: Resource, parameter: number): boolean;
  deleteShader(shader: Resource): void;
  createProgram(): Resource | null;
  attachShader(program: Resource, shader: Resource): void;
  linkProgram(program: Resource): void;
  getProgramParameter(program: Resource, parameter: number): boolean;
  deleteProgram(program: Resource): void;
  useProgram(program: Resource): void;
  createBuffer(): Resource | null;
  bindBuffer(kind: number, buffer: Resource | null): void;
  bufferData(kind: number, data: Float32Array, usage: number): void;
  deleteBuffer(buffer: Resource | null): void;
  getAttribLocation(program: Resource, name: string): number;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(index: number, size: number, kind: number, normalized: boolean, stride: number, offset: number): void;
  createTexture(): Resource | null;
  bindTexture(kind: number, texture: Resource | null): void;
  activeTexture(unit: number): void;
  texParameteri(kind: number, parameter: number, value: number): void;
  texImage2D(...args: (number | Uint8Array | AtlasCanvas)[]): void;
  deleteTexture(texture: Resource | null): void;
  getUniformLocation(program: Resource, name: string): Resource | null;
  uniform1i(location: Resource | null, value: number): void;
  uniform1f(location: Resource | null, value: number): void;
  uniform3f(location: Resource | null, x: number, y: number, z: number): void;
  uniform2f(location: Resource | null, x: number, y: number): void;
  viewport(x: number, y: number, width: number, height: number): void;
  drawArrays(mode: number, first: number, count: number): void;
  isContextLost(): boolean;
};
type AtlasCanvas = { width: number; height: number; getContext(kind: "2d"): { font: string; fillStyle: string; textBaseline: string; clearRect(x: number, y: number, width: number, height: number): void; fillText(text: string, x: number, y: number): void } | null };
export type GpuCanvas = {
  width: number;
  height: number;
  getContext(kind: "webgl", options: { alpha: boolean; antialias: boolean; preserveDrawingBuffer: boolean }): GL | null;
};
declare const document: { createElement(tag: "canvas"): AtlasCanvas };

const fragment = `
precision highp float;
uniform sampler2D uPhoto;
uniform sampler2D uAtlas;
uniform sampler2D uWake;
uniform vec3 uColor;
uniform vec2 uSize;
uniform vec2 uCell;
uniform vec2 uCenter;
uniform float uRatio;
uniform float uFit;
uniform float uPosition;
uniform float uTime;
uniform float uGlyphs;
uniform int uScene;
float photo(vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uPhoto, uv).r;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 pixel = vec2(gl_FragCoord.x / uRatio, uSize.y - gl_FragCoord.y / uRatio);
  vec2 center = (floor(pixel / uCell) + 0.5) * uCell;
  vec2 extent = vec2(768.0,432.0) * uFit;
  vec2 offset = vec2((uSize.x - extent.x) * 0.5, (uSize.y - extent.y) * uPosition);
  vec3 wake = texture2D(uWake,center / uSize).rgb;
  vec2 displacement = (wake.xy * 255.0 - 128.0) * 0.5;
  vec2 uv = (center - displacement - offset) / extent;
  float depth = photo(uv);
  if (uScene == 0) {
    uv += vec2(sin(uTime * 0.018) * 0.015, (cos(uTime * 0.013) - 1.0) * 0.007);
  } else if (uScene == 2) {
    vec2 p = (uv - uCenter) * vec2(1.7777778,1.0);
    float radius = length(p);
    float angle = -uTime * 0.035 * (0.18 / (0.18 + radius)) * smoothstep(0.035,0.16,radius) * (1.0-smoothstep(0.8,1.25,radius));
    p = mat2(cos(angle),-sin(angle),sin(angle),cos(angle)) * p;
    uv = p / vec2(1.7777778,1.0) + uCenter;
  } else if (uScene == 3) {
    float gas = smoothstep(0.025,0.35,depth) * (1.0-smoothstep(0.75,0.96,depth));
    uv += vec2(sin(uv.y * 7.0 + uTime * 0.065) - sin(uv.y * 7.0), cos(uv.x * 6.0 + uTime * 0.048) - cos(uv.x * 6.0)) * gas * vec2(0.008,0.006);
  }
  float light = photo(uv);
  if (uScene == 1) {
    vec2 p = (uv - vec2(0.5,0.52)) * vec2(1.7777778,1.0);
    float radius = length(vec2(p.x,p.y / 0.36));
    float ring = smoothstep(0.18,0.28,radius) * (1.0-smoothstep(0.8,1.1,radius));
    float phase = atan(p.y / 0.36,p.x) * 92.0 + radius * 430.0;
    float motion = sin(phase - uTime * 1.2 / pow(max(0.2,radius),1.5)) - sin(phase);
    light *= 1.0 + ring * motion * 0.045;
  }
  if (uScene == 2 || uScene == 3) {
    float variableStar = step(0.94,hash(floor(uv * vec2(768.0,432.0)))) * smoothstep(0.55,0.95,light);
    light *= 1.0 + variableStar * (sin(uTime * 0.65 + uv.x * 170.0) - sin(uv.x * 170.0)) * 0.035;
  }
  float edge = abs(light-photo(uv-vec2(1.0/768.0,0.0))) + abs(light-photo(uv-vec2(0.0,1.0/432.0)));
  float signal = pow(clamp((light-0.02)*1.35+edge*0.25,0.0,1.0),0.8);
  signal *= 1.0 - wake.z * 0.85;
  float glyph = floor(signal * (uGlyphs-1.0)+0.5);
  vec2 local = fract(pixel/uCell);
  float ink = texture2D(uAtlas,vec2((glyph+local.x)/uGlyphs,local.y)).a;
  float tone = (75.0+signal*170.0)/255.0;
  gl_FragColor = vec4(mix(vec3(8.0/255.0),tone * uColor,ink),1.0);
}`;

export function createAsciiGpu(canvas: GpuCanvas) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return;
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const pixel = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !pixel || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (pixel) gl.deleteShader(pixel);
    if (program) gl.deleteProgram(program);
    return;
  }
  gl.shaderSource(vertex, "attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.0,1.0);}");
  gl.shaderSource(pixel, fragment);
  gl.compileShader(vertex);
  gl.compileShader(pixel);
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  const compiled = gl.getShaderParameter(vertex, gl.COMPILE_STATUS) && gl.getShaderParameter(pixel, gl.COMPILE_STATUS) && gl.getProgramParameter(program, gl.LINK_STATUS);
  gl.deleteShader(vertex);
  gl.deleteShader(pixel);
  if (!compiled) { gl.deleteProgram(program); return; }
  const buffer = gl.createBuffer();
  const photo = gl.createTexture();
  const atlas = gl.createTexture();
  const wake = gl.createTexture();
  if (!buffer || !photo || !atlas || !wake) {
    gl.deleteBuffer(buffer); gl.deleteTexture(photo); gl.deleteTexture(atlas); gl.deleteTexture(wake); gl.deleteProgram(program);
    return;
  }
  const locations = Object.fromEntries(["uColor","uPhoto","uAtlas","uWake","uSize","uCell","uCenter","uRatio","uFit","uPosition","uTime","uGlyphs","uScene"].map((name) => [name, gl.getUniformLocation(program, name)]));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  for (const texture of [photo, atlas, wake]) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  let centerX = .5;
  let centerY = .5;
  const glyphAtlas = document.createElement("canvas");
  glyphAtlas.width = asciiGlyphs.length * 32;
  glyphAtlas.height = 48;
  const ink = glyphAtlas.getContext("2d");
  if (!ink) { gl.deleteBuffer(buffer); gl.deleteTexture(photo); gl.deleteTexture(atlas); gl.deleteTexture(wake); gl.deleteProgram(program); return; }
  return {
    setField(field: Uint8Array) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, photo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 768, 432, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, field);
      let weight = 0, x = 0, y = 0;
      for (let i = 0; i < field.length; i++) {
        const w = (field[i] / 255) ** 6;
        weight += w; x += (i % 768) * w; y += Math.floor(i / 768) * w;
      }
      centerX = weight ? x / weight / 768 : .5;
      centerY = weight ? y / weight / 432 : .5;
    },
    refreshAtlas() {
      ink.clearRect(0,0,glyphAtlas.width,glyphAtlas.height);
      ink.font = '40px "Paseo Geist Mono",Menlo,monospace';
      ink.textBaseline = "top";
      ink.fillStyle = "#fff";
      for (let i = 0; i < asciiGlyphs.length; i++) ink.fillText(asciiGlyphs[i], i * 32 + 3, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphAtlas);
    },
    draw(width: number, height: number, ratio: number, cellWidth: number, cellHeight: number, scale: number, position: number, time: number, scene: number, field: AsciiWake, color: number[]) {
      if (gl.isContextLost()) return false;
      gl.useProgram(program);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D,wake);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.columns,field.rows,0,gl.RGBA,gl.UNSIGNED_BYTE,field.pixels);
      gl.uniform3f(locations.uColor,color[0],color[1],color[2]);
      gl.uniform1i(locations.uPhoto,0); gl.uniform1i(locations.uAtlas,1); gl.uniform1i(locations.uWake,2);
      gl.uniform2f(locations.uSize,width,height); gl.uniform2f(locations.uCell,cellWidth,cellHeight);
      gl.uniform2f(locations.uCenter,centerX,centerY);
      gl.uniform1f(locations.uRatio,ratio); gl.uniform1f(locations.uFit,Math.max(width/768,height/432)*scale/100*1.08);
      gl.uniform1f(locations.uPosition,position); gl.uniform1f(locations.uTime,time);
      gl.uniform1f(locations.uGlyphs,asciiGlyphs.length); gl.uniform1i(locations.uScene,scene);
      gl.drawArrays(gl.TRIANGLES,0,6);
      return true;
    },
    dispose() {
      gl.deleteBuffer(buffer); gl.deleteTexture(photo); gl.deleteTexture(atlas); gl.deleteTexture(wake); gl.deleteProgram(program);
    },
  };
}
