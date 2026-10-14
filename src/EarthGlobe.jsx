import React, { useEffect, useRef, useState } from 'react'
import { getInitialYaw, getSunDirection } from './solar.js'
import { sightings } from './sightings.js'

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat3 uRotation;
  uniform float uZoom;
  uniform vec2 uViewportScale;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 rotated = uRotation * aPosition;
    vUv = aUv;
    vSurfaceNormal = aPosition;
    vViewNormal = rotated;
    gl_Position = vec4(rotated.xy * 0.86 * uZoom * uViewportScale, -rotated.z * 0.5, 1.0);
  }
`

const FRAGMENT_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform sampler2D uBorders;
  uniform vec3 uSunDirection;
  uniform vec3 uSunViewDirection;
  uniform float uCloudOffset;
  uniform float uMapStyle;
  uniform float uZoom;
  uniform vec2 uDayTexel;
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
    float cloudOpacity = mix(1.0, 0.28, smoothstep(1.5, 4.0, uZoom));
    float ocean = smoothstep(0.035, 0.105, surface.b - max(surface.r, surface.g));

    vec3 day = surface * (0.54 + 0.52 * sunStrength);
    day *= 1.0 - clouds * 0.12 * cloudOpacity;
    vec3 cloudColor = vec3(0.77, 0.85, 0.92) * (0.60 + 0.42 * sunStrength);
    day = mix(day, cloudColor, clouds * 0.72 * cloudOpacity);

    vec3 reflectedSun = reflect(-normalize(uSunViewDirection), viewNormal);
    float glint = pow(max(dot(reflectedSun, vec3(0.0, 0.0, 1.0)), 0.0), 62.0);
    day += vec3(0.33, 0.55, 0.82) * glint * ocean * (1.0 - clouds * 0.75) * 0.62;

    vec3 night = nightMap * 1.22 + vec3(0.001, 0.003, 0.008);
    night += clouds * vec3(0.013, 0.025, 0.043) * cloudOpacity;

    if (uMapStyle > 1.5) {
      float longitude = min(fract(vUv.x * 12.0), 1.0 - fract(vUv.x * 12.0)) / 12.0;
      float latitude = min(fract(vUv.y * 12.0), 1.0 - fract(vUv.y * 12.0)) / 12.0;
      float meridian = 1.0 - smoothstep(0.00015, 0.00085, longitude);
      float parallel = 1.0 - smoothstep(0.00015, 0.00085, latitude);
      float grid = max(meridian, parallel);
      float majorLongitude = min(fract(vUv.x * 4.0), 1.0 - fract(vUv.x * 4.0)) / 4.0;
      float majorLatitude = min(fract(vUv.y * 4.0), 1.0 - fract(vUv.y * 4.0)) / 4.0;
      float majorGrid = 1.0 - smoothstep(0.0002, 0.0013, min(majorLongitude, majorLatitude));
      float nodes = 1.0 - smoothstep(0.0005, 0.0027, length(vec2(longitude, latitude)));
      vec2 coastStep = uDayTexel * mix(1.0, 2.5, smoothstep(1.0, 5.0, uZoom));
      vec3 smoothSurface = (
        surface * 4.0 +
        texture2D(uDay, vUv + vec2(-coastStep.x, 0.0)).rgb +
        texture2D(uDay, vUv + vec2( coastStep.x, 0.0)).rgb +
        texture2D(uDay, vUv + vec2(0.0, -coastStep.y)).rgb +
        texture2D(uDay, vUv + vec2(0.0,  coastStep.y)).rgb
      ) * 0.125;
      float smoothOcean = smoothstep(0.035, 0.105, smoothSurface.b - max(smoothSurface.r, smoothSurface.g));
      float coast = 1.0 - smoothstep(0.08, 0.30, abs(smoothOcean - 0.5));
      float terrain = dot(smoothSurface, vec3(0.30, 0.59, 0.11));
      vec3 hologram = mix(vec3(0.008, 0.035, 0.105), vec3(0.025, 0.105, 0.23), 1.0 - smoothOcean);
      hologram += vec3(0.02, 0.10, 0.25) * (1.0 - smoothOcean) * terrain;
      hologram += vec3(0.05, 0.31, 0.72) * grid * 0.42;
      hologram += vec3(0.10, 0.57, 0.96) * majorGrid * 0.48;
      hologram += vec3(0.42, 0.88, 1.0) * nodes * 0.48;
      hologram += vec3(0.14, 0.66, 0.98) * coast * 0.65;
      hologram *= 0.76 + 0.24 * daylight;
      hologram += vec3(0.62, 0.94, 1.0) * borders.r * mix(0.68, 0.95, smoothstep(1.0, 3.0, uZoom));
      hologram += vec3(0.78, 0.90, 0.61) * borders.g * 0.70;
      float hologramRim = pow(1.0 - max(viewNormal.z, 0.0), 4.0);
      hologram += vec3(0.10, 0.52, 1.0) * hologramRim;
      gl_FragColor = vec4(hologram, mix(0.94, 1.0, smoothstep(1.0, 1.5, uZoom)));
      return;
    }

    if (uMapStyle > 0.5) {
      float terrain = dot(surface, vec3(0.30, 0.59, 0.11));
      vec3 land = mix(vec3(0.24, 0.38, 0.30), vec3(0.86, 0.79, 0.60), smoothstep(0.12, 0.65, terrain));
      vec3 sea = mix(vec3(0.05, 0.16, 0.24), vec3(0.19, 0.42, 0.50), smoothstep(0.08, 0.24, surface.b));
      vec3 atlas = mix(land, sea, ocean);
      day = atlas * (0.60 + 0.48 * sunStrength);
      day = mix(day, vec3(0.88, 0.91, 0.84), clouds * 0.24 * cloudOpacity);
      night = atlas * 0.24 + nightMap * 0.35;
    }

    vec3 color = mix(night, day, daylight);
    float colorBrightness = dot(color, vec3(0.30, 0.59, 0.11));
    vec3 borderColor = mix(vec3(0.68, 0.80, 0.64), vec3(0.10, 0.20, 0.17), smoothstep(0.38, 0.58, colorBrightness));
    float borderOpacity = mix(uMapStyle > 0.5 ? 0.70 : 0.52, 0.95, smoothstep(1.0, 3.0, uZoom));
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

function createSphere(latitudeSegments = 180, longitudeSegments = 360) {
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
  canvas.width = 4096
  canvas.height = 2048
  const context = canvas.getContext('2d')
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'butt'
  context.lineJoin = 'round'

  for (const [category, color, width, dash] of [
    ['regular', '#f00', 2.5, []],
    ['disputed', '#0f0', 2.5, [20, 16]],
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

function projectPoint({ latitude, longitude }, rotation, zoom, viewportScale) {
  const lat = latitude * Math.PI / 180
  const lon = longitude * Math.PI / 180
  const position = [
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  ]
  const rotated = [
    rotation[0] * position[0] + rotation[3] * position[1] + rotation[6] * position[2],
    rotation[1] * position[0] + rotation[4] * position[1] + rotation[7] * position[2],
    rotation[2] * position[0] + rotation[5] * position[1] + rotation[8] * position[2],
  ]
  if (rotated[2] <= 0.12) return null
  const left = 50 + rotated[0] * 43 * zoom * viewportScale[0]
  const top = 50 - rotated[1] * 43 * zoom * viewportScale[1]
  if (left < 0 || left > 100 || top < 0 || top > 100) return null
  return { left, top }
}

function projectSightings(rotation, zoom, viewportScale) {
  return sightings.flatMap((sighting) => {
    const point = projectPoint(sighting, rotation, zoom, viewportScale)
    return point ? [{ id: sighting.id, ...point }] : []
  })
}

function formatUtc(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}

export default function EarthGlobe({ selectedSightingId, visibleSightings, onSelectSighting }) {
  const canvasRef = useRef(null)
  const resetRef = useRef(() => {})
  const setMapStyleRef = useRef(() => {})
  const focusSightingRef = useRef(() => {})
  const setLocationRef = useRef(() => {})
  const adjustZoomRef = useRef(() => {})
  const canFocusLocationRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mapStyle, setMapStyle] = useState('hologram')
  const [markers, setMarkers] = useState([])
  const [location, setLocation] = useState(null)
  const [locationMarker, setLocationMarker] = useState(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [utcTime, setUtcTime] = useState(() => formatUtc(new Date()))

  useEffect(() => {
    if (selectedSightingId) canFocusLocationRef.current = false
    const sighting = sightings.find(({ id }) => id === selectedSightingId)
    if (sighting && ready) focusSightingRef.current(sighting)
  }, [selectedSightingId, ready])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    fetch('https://ipwho.is/', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)
          || Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180) {
          throw new Error('Coordenadas por IP indisponíveis')
        }
        if (active) setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          city: typeof data.city === 'string' ? data.city : '',
          country: typeof data.country === 'string' ? data.country : '',
        })
      })
      .catch((error) => {
        if (!active) return
        if (!controller.signal.aborted) console.warn('Não foi possível obter a localização por IP:', error)
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (location) setLocationRef.current(location)
  }, [location])

  useEffect(() => {
    const canvas = canvasRef.current
    const scene = canvas.parentElement
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
    let detailedDayTexture
    let detailedNightTexture
    let cloudTexture
    let borderTexture
    let borderController
    let resizeObserver
    let clockInterval
    let loadedTextures = 0
    let yaw = getInitialYaw()
    let pitch = 0.13
    let zoom = 1
    let activeMapStyle = 'hologram'
    const pointers = new Map()
    let pinchDistance = null
    let currentLocation = null
    let detailRequested = false
    let drawFrame = null

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
      const zoomLocation = gl.getUniformLocation(program, 'uZoom')
      const viewportScaleLocation = gl.getUniformLocation(program, 'uViewportScale')
      const dayTexelLocation = gl.getUniformLocation(program, 'uDayTexel')
      const sunLocation = gl.getUniformLocation(program, 'uSunDirection')
      const sunViewLocation = gl.getUniformLocation(program, 'uSunViewDirection')
      const cloudOffsetLocation = gl.getUniformLocation(program, 'uCloudOffset')
      const mapStyleLocation = gl.getUniformLocation(program, 'uMapStyle')
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      const preferCompactTextures = window.innerWidth <= 760 || (navigator.deviceMemory && navigator.deviceMemory <= 4)
      const detailSize = maxTextureSize >= 8192 && !preferCompactTextures ? 8192 : maxTextureSize >= 4096 ? 4096 : 0

      function draw() {
        if (disposed || loadedTextures !== 3 || canvas.width === 0 || canvas.height === 0) return
        const sun = getSunDirection(new Date())
        const rotation = rotationMatrix(yaw, pitch)
        const viewportScale = [
          Math.min(1, canvas.clientHeight / canvas.clientWidth),
          Math.min(1, canvas.clientWidth / canvas.clientHeight),
        ]
        const sunView = [
          rotation[0] * sun[0] + rotation[3] * sun[1] + rotation[6] * sun[2],
          rotation[1] * sun[0] + rotation[4] * sun[1] + rotation[7] * sun[2],
          rotation[2] * sun[0] + rotation[5] * sun[1] + rotation[8] * sun[2],
        ]
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        const useDetailedDay = zoom >= 1.5 && detailedDayTexture
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, useDetailedDay || dayTexture)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, zoom >= 1.5 && detailedNightTexture ? detailedNightTexture : nightTexture)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, cloudTexture)
        gl.uniformMatrix3fv(rotationLocation, false, rotation)
        gl.uniform1f(zoomLocation, zoom)
        gl.uniform2f(viewportScaleLocation, viewportScale[0], viewportScale[1])
        gl.uniform2f(dayTexelLocation, 1 / (useDetailedDay ? detailSize : 2048), 1 / (useDetailedDay ? detailSize / 2 : 1024))
        gl.uniform3f(sunLocation, sun[0], sun[1], sun[2])
        gl.uniform3f(sunViewLocation, sunView[0], sunView[1], sunView[2])
        gl.uniform1f(cloudOffsetLocation, ((Date.now() / 1000) % 43200) / 43200)
        gl.uniform1f(mapStyleLocation, activeMapStyle === 'hologram' ? 2 : activeMapStyle === 'atlas' ? 1 : 0)
        gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0)
        setMarkers(projectSightings(rotation, zoom, viewportScale))
        setLocationMarker(currentLocation ? projectPoint(currentLocation, rotation, zoom, viewportScale) : null)
      }

      function scheduleDraw() {
        if (drawFrame !== null) return
        drawFrame = window.requestAnimationFrame(() => {
          drawFrame = null
          draw()
        })
      }

      function updateZoom(nextZoom) {
        const clamped = Math.max(1, Math.min(5, nextZoom))
        if (Math.abs(clamped - zoom) < 0.001) return
        zoom = clamped
        setZoomPercent(Math.round(zoom * 100))
        if (zoom >= 1.5) requestDetailedTextures()
        scheduleDraw()
      }

      function resize() {
        const bounds = scene.getBoundingClientRect()
        const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2)
        const scale = Math.min(pixelRatio, 1600 / Math.max(bounds.width, bounds.height, 1))
        const width = Math.round(bounds.width * scale)
        const height = Math.round(bounds.height * scale)
        scene.style.setProperty('--scene-size', `${Math.min(bounds.width, bounds.height)}px`)
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
            if (zoom >= 1.5) requestDetailedTextures()
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

      function requestDetailedTextures() {
        if (detailRequested || !detailSize || loadedTextures !== 3) return
        detailRequested = true
        const suffix = detailSize === 8192 ? 'hi' : 'mid'
        for (const [name, unit] of [['day', 0], ['night', 1]]) {
          const image = new Image()
          image.onload = () => {
            if (disposed) return
            const texture = gl.createTexture()
            gl.activeTexture(gl.TEXTURE0 + unit)
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.generateMipmap(gl.TEXTURE_2D)
            if (gl.getError() !== gl.NO_ERROR) {
              gl.deleteTexture(texture)
              console.warn(`Não foi possível usar a textura ${name} de alta resolução`)
            } else if (unit === 0) {
              detailedDayTexture = texture
            } else {
              detailedNightTexture = texture
            }
            draw()
          }
          image.onerror = () => {
            if (!disposed) console.warn(`Não foi possível carregar a textura ${name} de alta resolução`)
          }
          image.src = `/earth-${name}-${suffix}.webp`
        }
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
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.generateMipmap(gl.TEXTURE_2D)
          draw()
        })
        .catch((error) => {
          if (error.name !== 'AbortError') console.error('Não foi possível carregar as fronteiras:', error)
        })
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(scene)
      resize()

      function onPointerDown(event) {
        canFocusLocationRef.current = false
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        pinchDistance = getPinchDistance()
        canvas.setPointerCapture(event.pointerId)
      }

      function getPinchDistance() {
        if (pointers.size !== 2) return null
        const [first, second] = [...pointers.values()]
        return Math.hypot(first.x - second.x, first.y - second.y)
      }

      function onPointerMove(event) {
        const previous = pointers.get(event.pointerId)
        if (!previous) return
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.size === 2) {
          const distance = getPinchDistance()
          if (pinchDistance && distance) updateZoom(zoom * distance / pinchDistance)
          pinchDistance = distance
        } else if (pointers.size === 1) {
          const screenRadius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.43 * zoom
          const radiansPerPixel = 1 / Math.max(screenRadius, 1)
          yaw += (event.clientX - previous.x) * radiansPerPixel
          pitch = Math.max(-1.2, Math.min(1.2, pitch + (event.clientY - previous.y) * radiansPerPixel))
          scheduleDraw()
        }
      }

      function onPointerUp(event) {
        pointers.delete(event.pointerId)
        pinchDistance = getPinchDistance()
      }

      function onWheel(event) {
        event.preventDefault()
        canFocusLocationRef.current = false
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1)
        updateZoom(zoom * Math.exp(-delta * 0.0015))
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
        canFocusLocationRef.current = false
        event.preventDefault()
        draw()
      }

      resetRef.current = () => {
        if (currentLocation) {
          yaw = -currentLocation.longitude * Math.PI / 180
          pitch = Math.max(-1.2, Math.min(1.2, currentLocation.latitude * Math.PI / 180))
        } else {
          yaw = getInitialYaw()
          pitch = 0.13
        }
        draw()
      }
      setMapStyleRef.current = (style) => {
        activeMapStyle = style
        draw()
      }
      focusSightingRef.current = (sighting) => {
        canFocusLocationRef.current = false
        yaw = -sighting.longitude * Math.PI / 180
        pitch = Math.max(-1.2, Math.min(1.2, sighting.latitude * Math.PI / 180))
        draw()
      }
      setLocationRef.current = (nextLocation) => {
        currentLocation = nextLocation
        if (canFocusLocationRef.current) {
          yaw = -nextLocation.longitude * Math.PI / 180
          pitch = Math.max(-1.2, Math.min(1.2, nextLocation.latitude * Math.PI / 180))
        }
        draw()
      }
      adjustZoomRef.current = (factor) => {
        canFocusLocationRef.current = false
        updateZoom(zoom * factor)
      }
      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
      scene.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('keydown', onKeyDown)
      clockInterval = window.setInterval(() => {
        setUtcTime(formatUtc(new Date()))
        draw()
      }, 15000)

      return () => {
        disposed = true
        resetRef.current = () => {}
        setMapStyleRef.current = () => {}
        focusSightingRef.current = () => {}
        setLocationRef.current = () => {}
        adjustZoomRef.current = () => {}
        window.clearInterval(clockInterval)
        if (drawFrame !== null) window.cancelAnimationFrame(drawFrame)
        borderController.abort()
        resizeObserver.disconnect()
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        scene.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('keydown', onKeyDown)
        gl.deleteTexture(dayTexture)
        gl.deleteTexture(nightTexture)
        if (detailedDayTexture) gl.deleteTexture(detailedDayTexture)
        if (detailedNightTexture) gl.deleteTexture(detailedNightTexture)
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
        aria-label="Globo 3D da Terra. Arraste para girar, use a roda do mouse ou pinça para ampliar. As setas do teclado também giram o globo."
      />
      {mapStyle === 'hologram' && zoomPercent < 150 && !failed && <span className="planet-scene__holo-scan" aria-hidden="true" />}
      {!failed && locationMarker && (
        <span
          className="planet-scene__location-marker"
          style={{ left: `${locationMarker.left}%`, top: `${locationMarker.top}%` }}
          role="img"
          aria-label={`Sua localização aproximada pelo IP${location.city ? `: ${location.city}${location.country ? `, ${location.country}` : ''}` : ''}`}
        />
      )}
      {!failed && markers.filter(({ id }) => visibleSightings.some((sighting) => sighting.id === id)).map(({ id, left, top }) => {
        const sighting = visibleSightings.find((item) => item.id === id)
        return (
          <button
            key={id}
            className={`planet-scene__sighting-marker ${left > 58 ? 'planet-scene__sighting-marker--left' : ''}`}
            type="button"
            style={{ left: `${left}%`, top: `${top}%` }}
            title={sighting.title}
            aria-label={`Selecionar relato: ${sighting.title}, ${sighting.location}`}
            aria-pressed={selectedSightingId === id}
            onClick={() => onSelectSighting(id)}
          >
            <span className="planet-scene__sighting-point" aria-hidden="true" />
            <span className="planet-scene__sighting-name" aria-hidden="true">{sighting.mapLabel}</span>
          </button>
        )
      })}
      {!failed && (
        <div className="planet-scene__map-switch" role="group" aria-label="Tipo de mapa">
          {[
            { id: 'hologram', label: 'HOLOGRAMA' },
            { id: 'satellite', label: 'SATÉLITE' },
            { id: 'atlas', label: 'ATLAS' },
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
        <div className="planet-scene__zoom" role="group" aria-label="Zoom do planeta">
          <button type="button" aria-label="Diminuir zoom" disabled={zoomPercent <= 100} onClick={() => adjustZoomRef.current(0.8)}>−</button>
          <output className="mono" aria-label="Zoom atual">{zoomPercent}%</output>
          <button type="button" aria-label="Aumentar zoom" disabled={zoomPercent >= 500} onClick={() => adjustZoomRef.current(1.25)}>+</button>
        </div>
      )}
      {!failed && (
        <button className="planet-scene__reset mono" type="button" onClick={() => resetRef.current()}>
          ↺ {location ? 'MINHA POSIÇÃO' : 'REORIENTAR'}
        </button>
      )}
      <span className="planet-scene__label mono">{failed ? 'VISUALIZAÇÃO ESTÁTICA' : `DIA / NOITE · ${utcTime}`}</span>
    </>
  )
}
