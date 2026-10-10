import React, { useEffect, useRef, useState } from 'react'
import { getInitialYaw, getSunDirection } from './solar.js'

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat3 uRotation;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 rotated = uRotation * aPosition;
    vUv = aUv;
    vSurfaceNormal = aPosition;
    vViewNormal = rotated;
    gl_Position = vec4(rotated.xy * 0.86, -rotated.z * 0.5, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform sampler2D uBorders;
  uniform vec3 uSunDirection;
  uniform vec3 uSunViewDirection;
  uniform float uCloudOffset;
  uniform float uMapStyle;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 surfaceNormal = normalize(vSurfaceNormal);
    vec3 viewNormal = normalize(vViewNormal);
    float sunlight = dot(surfaceNormal, normalize(uSunDirection));
    float daylight = smoothstep(-0.09, 0.14, sunlight);
    float sunStrength = max(sunlight, 0.0);

    vec3 surface = texture2D(uDay, vUv).rgb;
    vec3 nightMap = texture2D(uNight, vUv).rgb;
    vec2 borders = texture2D(uBorders, vUv).rg;
    float cloudMap = texture2D(uClouds, vec2(fract(vUv.x + uCloudOffset), vUv.y)).r;
    float clouds = smoothstep(0.20, 0.82, cloudMap);
    float ocean = smoothstep(0.035, 0.105, surface.b - max(surface.r, surface.g));

    vec3 day = surface * (0.54 + 0.52 * sunStrength);
    day *= 1.0 - clouds * 0.12;
    vec3 cloudColor = vec3(0.77, 0.85, 0.92) * (0.60 + 0.42 * sunStrength);
    day = mix(day, cloudColor, clouds * 0.72);

    vec3 reflectedSun = reflect(-normalize(uSunViewDirection), viewNormal);
    float glint = pow(max(dot(reflectedSun, vec3(0.0, 0.0, 1.0)), 0.0), 62.0);
    day += vec3(0.33, 0.55, 0.82) * glint * ocean * (1.0 - clouds * 0.75) * 0.62;

    vec3 night = nightMap * 1.22 + vec3(0.001, 0.003, 0.008);
    night += clouds * vec3(0.013, 0.025, 0.043);

    if (uMapStyle > 1.5) {
      float longitude = min(fract(vUv.x * 12.0), 1.0 - fract(vUv.x * 12.0)) / 12.0;
      float latitude = min(fract(vUv.y * 12.0), 1.0 - fract(vUv.y * 12.0)) / 12.0;
      float meridian = 1.0 - smoothstep(0.0008, 0.0022, longitude);
      float parallel = 1.0 - smoothstep(0.0008, 0.0022, latitude);
      float grid = max(meridian, parallel);
      float majorLongitude = min(fract(vUv.x * 4.0), 1.0 - fract(vUv.x * 4.0)) / 4.0;
      float majorLatitude = min(fract(vUv.y * 4.0), 1.0 - fract(vUv.y * 4.0)) / 4.0;
      float majorGrid = 1.0 - smoothstep(0.0012, 0.0030, min(majorLongitude, majorLatitude));
      float nodes = 1.0 - smoothstep(0.002, 0.007, length(vec2(longitude, latitude)));
      float coast = 1.0 - smoothstep(0.08, 0.30, abs(ocean - 0.5));
      float terrain = dot(surface, vec3(0.30, 0.59, 0.11));
      float contours = (1.0 - ocean) * (1.0 - smoothstep(0.0, 0.17, abs(sin(terrain * 38.0))));
      vec3 hologram = mix(vec3(0.012, 0.055, 0.085), vec3(0.035, 0.16, 0.18), 1.0 - ocean);
      hologram += vec3(0.02, 0.14, 0.16) * (1.0 - ocean) * terrain;
      hologram += vec3(0.08, 0.54, 0.59) * grid * 0.55;
      hologram += vec3(0.13, 0.72, 0.76) * majorGrid * 0.55;
      hologram += vec3(0.32, 0.88, 0.83) * nodes * 0.70;
      hologram += vec3(0.20, 0.84, 0.83) * coast * 0.65;
      hologram += vec3(0.07, 0.28, 0.25) * contours;
      hologram *= 0.76 + 0.24 * daylight;
      hologram += vec3(0.22, 0.67, 0.59) * borders.r * 0.62;
      hologram += vec3(0.85, 0.50, 0.27) * borders.g * 0.70;
      float hologramRim = pow(1.0 - max(viewNormal.z, 0.0), 4.0);
      hologram += vec3(0.08, 0.75, 0.82) * hologramRim;
      gl_FragColor = vec4(hologram, 0.94);
      return;
    }

    if (uMapStyle > 0.5) {
      float terrain = dot(surface, vec3(0.30, 0.59, 0.11));
      vec3 land = mix(vec3(0.24, 0.38, 0.30), vec3(0.86, 0.79, 0.60), smoothstep(0.12, 0.65, terrain));
      vec3 sea = mix(vec3(0.05, 0.16, 0.24), vec3(0.19, 0.42, 0.50), smoothstep(0.08, 0.24, surface.b));
      vec3 atlas = mix(land, sea, ocean);
      day = atlas * (0.60 + 0.48 * sunStrength);
      day = mix(day, vec3(0.88, 0.91, 0.84), clouds * 0.24);
      night = atlas * 0.24 + nightMap * 0.35;
    }

    vec3 color = mix(night, day, daylight);
    float colorBrightness = dot(color, vec3(0.30, 0.59, 0.11));
    vec3 borderColor = mix(vec3(0.68, 0.80, 0.64), vec3(0.10, 0.20, 0.17), smoothstep(0.38, 0.58, colorBrightness));
    float borderOpacity = uMapStyle > 0.5 ? 0.70 : 0.52;
    color = mix(color, borderColor, borders.r * borderOpacity);
    color = mix(color, vec3(0.91, 0.58, 0.31), borders.g * borderOpacity);

    float limb = pow(1.0 - max(viewNormal.z, 0.0), 3.3);
    float thinRim = pow(1.0 - max(viewNormal.z, 0.0), 9.0);
    color += vec3(0.035, 0.14, 0.30) * limb;
    color += vec3(0.13, 0.38, 0.66) * thinRim * (0.38 + 0.62 * daylight);

    float twilight = 1.0 - smoothstep(0.0, 0.14, abs(sunlight));
    color += vec3(0.12, 0.045, 0.012) * twilight * (0.35 + 0.65 * limb);
    gl_FragColor = vec4(color, 1.0);
  }
`

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(error || 'Falha ao compilar o shader do globo')
  }
  return shader
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(error || 'Falha ao criar o programa do globo')
  }
  return program
}

function createSphere(latitudeSegments = 72, longitudeSegments = 144) {
  const vertices = []
  const indices = []

  for (let latIndex = 0; latIndex <= latitudeSegments; latIndex += 1) {
    const latitude = -Math.PI / 2 + latIndex / latitudeSegments * Math.PI
    for (let lonIndex = 0; lonIndex <= longitudeSegments; lonIndex += 1) {
      const longitude = -Math.PI + lonIndex / longitudeSegments * Math.PI * 2
      vertices.push(
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude),
        lonIndex / longitudeSegments,
        latIndex / latitudeSegments,
      )
    }
  }

  for (let latIndex = 0; latIndex < latitudeSegments; latIndex += 1) {
    for (let lonIndex = 0; lonIndex < longitudeSegments; lonIndex += 1) {
      const first = latIndex * (longitudeSegments + 1) + lonIndex
      const next = first + longitudeSegments + 1
      indices.push(first, first + 1, next, first + 1, next + 1, next)
    }
  }

  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

function createBordersCanvas(data) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (const [category, color, width, dash] of [
    ['regular', '#f00', 1.5, []],
    ['disputed', '#0f0', 1.5, [5, 4]],
  ]) {
    context.strokeStyle = color
    context.lineWidth = width
    context.setLineDash(dash)
    for (const line of data[category]) {
      context.beginPath()
      let previousLongitude = null
      for (const [longitude, latitude] of line) {
        const x = (longitude + 180) / 360 * canvas.width
        const y = (90 - latitude) / 180 * canvas.height
        if (previousLongitude === null || Math.abs(longitude - previousLongitude) > 180) context.moveTo(x, y)
        else context.lineTo(x, y)
        previousLongitude = longitude
      }
      context.stroke()
    }
  }

  return canvas
}

function rotationMatrix(yaw, pitch) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cx = Math.cos(pitch)
  const sx = Math.sin(pitch)

  // Column-major Rx * Ry for WebGL.
  return new Float32Array([
    cy, sx * sy, -cx * sy,
    0, cx, sx,
    sy, -sx * cy, cx * cy,
  ])
}

function formatUtc(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}

export default function EarthGlobe() {
  const canvasRef = useRef(null)
  const resetRef = useRef(() => {})
  const setMapStyleRef = useRef(() => {})
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mapStyle, setMapStyle] = useState('satellite')
  const [utcTime, setUtcTime] = useState(() => formatUtc(new Date()))

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false })
    if (!gl) {
      setFailed(true)
      return undefined
    }

    let disposed = false
    let program
    let vertexBuffer
    let indexBuffer
    let dayTexture
    let nightTexture
    let cloudTexture
    let borderTexture
    let borderController
    let resizeObserver
    let clockInterval
    let loadedTextures = 0
    let yaw = getInitialYaw()
    let pitch = 0.13
    let activeMapStyle = 'satellite'
    let pointer = null

    try {
      program = createProgram(gl)
      const sphere = createSphere()
      vertexBuffer = gl.createBuffer()
      indexBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, sphere.vertices, gl.STATIC_DRAW)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW)
      gl.useProgram(program)

      const positionLocation = gl.getAttribLocation(program, 'aPosition')
      const uvLocation = gl.getAttribLocation(program, 'aUv')
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 20, 0)
      gl.enableVertexAttribArray(uvLocation)
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 20, 12)
      gl.uniform1i(gl.getUniformLocation(program, 'uDay'), 0)
      gl.uniform1i(gl.getUniformLocation(program, 'uNight'), 1)
      gl.uniform1i(gl.getUniformLocation(program, 'uClouds'), 2)
      gl.uniform1i(gl.getUniformLocation(program, 'uBorders'), 3)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)

      const rotationLocation = gl.getUniformLocation(program, 'uRotation')
      const sunLocation = gl.getUniformLocation(program, 'uSunDirection')
      const sunViewLocation = gl.getUniformLocation(program, 'uSunViewDirection')
      const cloudOffsetLocation = gl.getUniformLocation(program, 'uCloudOffset')
      const mapStyleLocation = gl.getUniformLocation(program, 'uMapStyle')

      function draw() {
        if (disposed || loadedTextures !== 3 || canvas.width === 0 || canvas.height === 0) return
        const sun = getSunDirection(new Date())
        const rotation = rotationMatrix(yaw, pitch)
        const sunView = [
          rotation[0] * sun[0] + rotation[3] * sun[1] + rotation[6] * sun[2],
          rotation[1] * sun[0] + rotation[4] * sun[1] + rotation[7] * sun[2],
          rotation[2] * sun[0] + rotation[5] * sun[1] + rotation[8] * sun[2],
        ]
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.uniformMatrix3fv(rotationLocation, false, rotation)
        gl.uniform3f(sunLocation, sun[0], sun[1], sun[2])
        gl.uniform3f(sunViewLocation, sunView[0], sunView[1], sunView[2])
        gl.uniform1f(cloudOffsetLocation, ((Date.now() / 1000) % 43200) / 43200)
        gl.uniform1f(mapStyleLocation, activeMapStyle === 'hologram' ? 2 : activeMapStyle === 'atlas' ? 1 : 0)
        gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0)
      }

      function resize() {
        const bounds = canvas.getBoundingClientRect()
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const width = Math.min(Math.round(bounds.width * pixelRatio), 1600)
        const height = Math.min(Math.round(bounds.height * pixelRatio), 1600)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        draw()
      }

      function createTexture(url, unit) {
        const texture = gl.createTexture()
        const image = new Image()
        image.onload = () => {
          if (disposed) return
          gl.activeTexture(gl.TEXTURE0 + unit)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.generateMipmap(gl.TEXTURE_2D)
          loadedTextures += 1
          if (loadedTextures === 3) {
            setReady(true)
            resize()
          }
        }
        image.onerror = () => {
          if (disposed) return
          console.error(`Não foi possível carregar a textura ${url}`)
          setFailed(true)
        }
        image.src = url
        return texture
      }

      dayTexture = createTexture('/earth-day.webp', 0)
      nightTexture = createTexture('/earth-night.webp', 1)
      cloudTexture = createTexture('/earth-clouds.webp', 2)
      borderTexture = gl.createTexture()
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, borderTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      borderController = new AbortController()
      fetch('/country-borders.json', { signal: borderController.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .then((data) => {
          if (disposed) return
          const borderCanvas = createBordersCanvas(data)
          gl.activeTexture(gl.TEXTURE3)
          gl.bindTexture(gl.TEXTURE_2D, borderTexture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, borderCanvas)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          draw()
        })
        .catch((error) => {
          if (error.name !== 'AbortError') console.error('Não foi possível carregar as fronteiras:', error)
        })
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(canvas)
      resize()

      function onPointerDown(event) {
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
        canvas.setPointerCapture(event.pointerId)
        canvas.focus()
      }

      function onPointerMove(event) {
        if (!pointer || pointer.id !== event.pointerId) return
        yaw += (event.clientX - pointer.x) * 0.006
        pitch = Math.max(-1.2, Math.min(1.2, pitch + (event.clientY - pointer.y) * 0.006))
        pointer = { ...pointer, x: event.clientX, y: event.clientY }
        draw()
      }

      function onPointerUp(event) {
        if (pointer?.id === event.pointerId) pointer = null
      }

      function onKeyDown(event) {
        const step = Math.PI / 15
        if (event.key === 'ArrowLeft') yaw -= step
        else if (event.key === 'ArrowRight') yaw += step
        else if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - step)
        else if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + step)
        else if (event.key === 'Home') {
          yaw = getInitialYaw()
          pitch = 0.13
        } else return
        event.preventDefault()
        draw()
      }

      resetRef.current = () => {
        yaw = getInitialYaw()
        pitch = 0.13
        draw()
      }
      setMapStyleRef.current = (style) => {
        activeMapStyle = style
        draw()
      }
      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
      canvas.addEventListener('keydown', onKeyDown)
      clockInterval = window.setInterval(() => {
        setUtcTime(formatUtc(new Date()))
        draw()
      }, 15000)

      return () => {
        disposed = true
        resetRef.current = () => {}
        setMapStyleRef.current = () => {}
        window.clearInterval(clockInterval)
        borderController.abort()
        resizeObserver.disconnect()
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('keydown', onKeyDown)
        gl.deleteTexture(dayTexture)
        gl.deleteTexture(nightTexture)
        gl.deleteTexture(cloudTexture)
        gl.deleteTexture(borderTexture)
        gl.deleteBuffer(vertexBuffer)
        gl.deleteBuffer(indexBuffer)
        gl.deleteProgram(program)
      }
    } catch (error) {
      console.error('Não foi possível iniciar o globo 3D:', error)
      setFailed(true)
      return undefined
    }
  }, [])

  return (
    <>
      <span className="planet-scene__glow" aria-hidden="true" />
      <img className={`planet-scene__fallback ${ready ? 'planet-scene__fallback--hidden' : ''}`} src="/planet.webp" alt="" />
      <canvas
        className="planet-scene__canvas"
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Globo 3D da Terra. Arraste para girar ou use as setas do teclado. O lado iluminado acompanha a posição real do Sol."
      />
      {mapStyle === 'hologram' && !failed && <span className="planet-scene__holo-scan" aria-hidden="true" />}
      {!failed && <span className="planet-scene__hint mono">ARRASTE PARA GIRAR</span>}
      {!failed && (
        <div className="planet-scene__map-switch" role="group" aria-label="Tipo de mapa">
          {[
            { id: 'satellite', label: 'SATÉLITE' },
            { id: 'atlas', label: 'ATLAS' },
            { id: 'hologram', label: 'HOLOGRAMA' },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`planet-scene__map-option mono ${mapStyle === id ? 'planet-scene__map-option--active' : ''}`}
              type="button"
              aria-pressed={mapStyle === id}
              onClick={() => {
                setMapStyle(id)
                setMapStyleRef.current(id)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!failed && (
        <button className="planet-scene__reset mono" type="button" onClick={() => resetRef.current()}>
          ↺ REORIENTAR
        </button>
      )}
      <span className="planet-scene__label mono">{failed ? 'VISUALIZAÇÃO ESTÁTICA' : `DIA / NOITE · ${utcTime}`}</span>
    </>
  )
}
