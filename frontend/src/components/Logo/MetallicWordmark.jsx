import { useEffect, useRef } from 'react'
import svgSrc from '../../assets/nombresvg.svg?url'

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FS = `
precision mediump float;
uniform sampler2D uMask;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec4 mask = texture2D(uMask, vUv);
  if (mask.a < 0.05) discard;

  float t = uTime * 0.55;
  float n = noise(vUv * 3.0 + vec2(t, -t * 0.4)) * 0.6
          + noise(vUv * 7.0 + vec2(-t * 0.8, t * 0.5)) * 0.4;

  vec3 dark  = vec3(0.50, 0.53, 0.57);
  vec3 mid   = vec3(0.80, 0.83, 0.88);
  vec3 light = vec3(0.95, 0.96, 0.97);
  vec3 col   = mix(dark, mix(mid, light, n), smoothstep(0.2, 0.8, n));

  // Banda especular que recorre el lettering: blanco mezclado con el verde de marca
  float spec = pow(max(0.0, sin(vUv.x * 3.5 + uTime * 1.2 - vUv.y * 1.5)), 10.0);
  vec3 neon  = vec3(0.043, 0.702, 0.161);          // --neon #0bb329
  col += spec * mix(neon, vec3(1.0), 0.55) * 0.55;  // 45% verde + 55% blanco

  gl_FragColor = vec4(col, mask.a);
}
`

function compileShader(gl, type, src) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export default function MetallicWordmark({ isVisible, onFallback, className }) {
  const canvasRef    = useRef(null)
  const isVisibleRef = useRef(isVisible)
  const syncRef      = useRef(null)

  // Keep isVisibleRef current; call syncRaf whenever the prop changes
  useEffect(() => {
    isVisibleRef.current = isVisible
    syncRef.current?.()
  }, [isVisible])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl) { onFallback?.(); return }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS)
    if (!vs || !fs) { onFallback?.(); return }

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    // Shaders are compiled into the program; free them immediately
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { onFallback?.(); return }
    gl.useProgram(prog)

    // Fullscreen quad (TRIANGLE_STRIP, 4 vertices: BL, BR, TL, TR)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aPosLoc  = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPosLoc)
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0)

    const uMaskLoc = gl.getUniformLocation(prog, 'uMask')
    const uTimeLoc = gl.getUniformLocation(prog, 'uTime')
    gl.uniform1i(uMaskLoc, 0)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    // SVG mask texture
    const tex = gl.createTexture()
    let texReady = false
    const startMs = performance.now()

    const img = new Image()
    img.onload = () => {
      // Use natural dimensions if available; SVGs without explicit w/h may report 0
      const W = img.naturalWidth  > 0 ? img.naturalWidth  : 512
      const H = img.naturalHeight > 0 ? img.naturalHeight : 256
      const off = document.createElement('canvas')
      off.width  = W
      off.height = H
      off.getContext('2d').drawImage(img, 0, 0, W, H)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      texReady = true
      syncRaf()
    }
    img.onerror = () => onFallback?.()
    img.src = svgSrc

    // ResizeObserver: update canvas dimensions only when size changes by ≥1px
    let prevW = 0, prevH = 0
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = Math.round(rect.width  * dpr)
      const h = Math.round(rect.height * dpr)
      if (Math.abs(w - prevW) < 1 && Math.abs(h - prevH) < 1) return
      prevW = w; prevH = h
      canvas.width  = w || 1
      canvas.height = h || 1
      gl.viewport(0, 0, canvas.width, canvas.height)
    })
    ro.observe(canvas)

    // rAF state
    let rafId = null
    let windowFocused = document.hasFocus()

    function render() {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(uTimeLoc, (performance.now() - startMs) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(render)
    }

    // Triple condition: viewport + tab visible + window focused + texture loaded
    function syncRaf() {
      const active = isVisibleRef.current
                  && document.visibilityState === 'visible'
                  && windowFocused
                  && texReady
      if (active) {
        if (!rafId) rafId = requestAnimationFrame(render)
      } else {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
    syncRef.current = syncRaf

    const onVis   = () => syncRaf()
    const onFocus = () => { windowFocused = true;  syncRaf() }
    const onBlur  = () => { windowFocused = false; syncRaf() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur',  onBlur)

    return () => {
      syncRef.current = null
      cancelAnimationFrame(rafId)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur',  onBlur)
      gl.deleteProgram(prog)
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
    }
  }, []) // mount only — isVisible changes handled via syncRef

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
