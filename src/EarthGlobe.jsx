import React, { useEffect, useRef, useState } from 'react'
import { getInitialYaw, getSunDirection } from './solar.js'
import { sightings } from './sightings.js'
import { globePointAt, visibleTiles, tileAncestorUv, tileMesh } from './globeTiles.js'
import { GLOBAL_FRAGMENT_SHADER } from './globalGlobeShader.js'

const tileSourceForStyle = (style) => style === 'satellite' ? 'imagery' : 'osm'
const tileKey = (source, tile) => `${source}/${tile.level}/${tile.x}/${tile.y}`
const tileUrl = (source, tile) => source === 'imagery'
  ? `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.level}/${tile.y}/${tile.x}`
  : `https://tile.openstreetmap.org/${tile.level}/${tile.x}/${tile.y}.png`

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat3 uRotation;
  uniform float uZoom;
  uniform float uDepthOffset;
  uniform vec2 uViewportScale;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 rotated = uRotation * aPosition;
    vUv = aUv;
    vSurfaceNormal = aPosition;
    vViewNormal = rotated;
    gl_Position = vec4(rotated.xy * 0.86 * uZoom * uViewportScale, -rotated.z * 0.5 - uDepthOffset, 1.0);
  }
`

const TILE_FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uTile;
  uniform sampler2D uNight;
  uniform vec3 uSunDirection;
  uniform vec3 uSunViewDirection;
  uniform float uMapStyle;
  uniform float uStyleZoom;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    if (vViewNormal.z <= 0.0) discard;
    vec3 map = texture2D(uTile, vUv * uUvScale + uUvOffset).rgb;
    vec3 normal = normalize(vSurfaceNormal);
    vec3 viewNormal = normalize(vViewNormal);
    float sun = dot(normal, normalize(uSunDirection));
    float diffuse = max(sun, 0.0);
    float closeView = smoothstep(2.0, 6.0, uStyleZoom);
    float light = mix(0.82 + 0.18 * sqrt(diffuse), 0.97 + 0.03 * diffuse, closeView);
    float water = uMapStyle > 0.5 ? smoothstep(0.04, 0.18, map.b - map.r) : 0.0;
    float rim = 0.0;
    float glint = 0.0;
    float twilight = 0.0;
    if (uStyleZoom < 6.0) {
      rim = pow(1.0 - max(viewNormal.z, 0.0), 3.0) * (1.0 - closeView);
      if (uMapStyle > 0.5) {
        glint = pow(max(reflect(-normalize(uSunViewDirection), viewNormal).z, 0.0), 24.0)
          * water * smoothstep(0.0, 0.25, sun) * (1.0 - closeView);
      }
      twilight = (1.0 - smoothstep(0.0, 0.18, abs(sun))) * (1.0 - closeView);
    }
    vec3 color;
    if (uMapStyle > 1.5) {
      float detail = smoothstep(0.18, 0.92, dot(map, vec3(0.299, 0.587, 0.114)));
      vec3 land = mix(vec3(0.07, 0.22, 0.34), vec3(0.58, 0.82, 0.87), detail);
      vec3 sea = mix(vec3(0.13, 0.39, 0.57), vec3(0.30, 0.64, 0.78), detail);
      color = mix(land, sea, water) * light;
      color += rim * vec3(0.07, 0.22, 0.32);
      color += glint * vec3(0.04, 0.11, 0.15);
    } else if (uMapStyle > 0.5) {
      vec3 land = map * vec3(0.98, 0.99, 0.98);
      vec3 sea = mix(map * vec3(0.82, 1.0, 1.0), vec3(0.48, 0.73, 0.82), 0.20);
      color = mix(land, sea, water) * light;
      color += twilight * vec3(0.035, 0.04, 0.05);
      color += rim * vec3(0.09, 0.30, 0.42);
      color += glint * vec3(0.16, 0.22, 0.23);
    } else {
      vec3 brightMap = pow(map, vec3(0.78));
      float imageryWater = smoothstep(0.04, 0.16, map.b - max(map.r, map.g));
      vec3 dayColor = mix(brightMap, max(brightMap, vec3(0.18, 0.40, 0.62)), imageryWater * 0.65) * light;
      vec2 nightUv = vec2(atan(normal.x, normal.z) / 6.2831853 + 0.5, asin(normal.y) / 3.14159265 + 0.5);
      vec3 nightLights = texture2D(uNight, nightUv).rgb * mix(1.22, 0.45, closeView);
      vec3 nightColor = dayColor * mix(0.10, 0.45, closeView) + nightLights;
      color = mix(nightColor, dayColor, smoothstep(-0.09, 0.14, sun));
      color += twilight * vec3(0.07, 0.035, 0.014);
      color += rim * vec3(0.09, 0.32, 0.56);
    }
    gl_FragColor = vec4(color, uOpacity);
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 uSunDirection;
  uniform float uMapStyle;
  uniform float uGridZoom;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 normal = normalize(vSurfaceNormal);
    vec3 viewNormal = normalize(vViewNormal);
    float daylight = 0.85 + 0.15 * sqrt(max(dot(normal, normalize(uSunDirection)), 0.0));
    vec3 color;
    if (uMapStyle > 1.5) {
      color = vec3(0.22, 0.54, 0.72);
      float longitude = min(fract(vUv.x * 12.0), 1.0 - fract(vUv.x * 12.0));
      float latitude = min(fract(vUv.y * 12.0), 1.0 - fract(vUv.y * 12.0));
      float grid = 1.0 - smoothstep(0.0, 0.013, min(longitude, latitude));
      color = mix(color, vec3(0.12, 0.43, 0.61), grid * 0.38 * (1.0 - step(1.001, uGridZoom)));
    } else if (uMapStyle > 0.5) {
      color = vec3(0.48, 0.74, 0.80);
    } else {
      color = vec3(0.32, 0.62, 0.76);
    }
    color *= daylight;
    float rim = pow(1.0 - max(viewNormal.z, 0.0), 5.0);
    color += vec3(0.08, 0.32, 0.60) * rim;
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

function createProgram(gl, fragmentSource = FRAGMENT_SHADER) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
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

function createBordersCanvas(data, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size / 2
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
    context.lineWidth = width * size / 4096
    context.setLineDash(dash.map((length) => length * size / 4096))
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
    let globalProgram
    let tileProgram
    let vertexBuffer
    let indexBuffer
    let tileIndexBuffer
    let resizeObserver
    let clockInterval
    let yaw = getInitialYaw()
    let pitch = 0.13
    let zoom = 1
    let activeMapStyle = 'hologram'
    const pointers = new Map()
    let pinchDistance = null
    let currentLocation = null
    let drawFrame = null
    const tileCache = new Map()
    const fallbackLayers = new Map()
    let loadingTiles = 0
    let desiredTiles = []
    let desiredTileSource = 'osm'
    let desiredTileSignature = ''
    let tileRequestTimer = null
    let dayTexture
    let nightTexture
    let cloudTexture
    let borderTexture
    let borderController
    let loadedGlobalTextures = 0
    let nightTextureReady = false
    let dayTextureWidth = 4096

    try {
      program = createProgram(gl)
      globalProgram = createProgram(gl, GLOBAL_FRAGMENT_SHADER)
      tileProgram = createProgram(gl, TILE_FRAGMENT_SHADER)
      const sphere = createSphere(90, 180)
      vertexBuffer = gl.createBuffer()
      indexBuffer = gl.createBuffer()
      tileIndexBuffer = gl.createBuffer()
      const tileIndices = tileMesh({ level: 1, y: 0, unwrappedX: 0 }).indices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tileIndexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tileIndices, gl.STATIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, sphere.vertices, gl.STATIC_DRAW)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW)
      gl.useProgram(program)

      const positionLocation = gl.getAttribLocation(program, 'aPosition')
      const uvLocation = gl.getAttribLocation(program, 'aUv')
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)

      const rotationLocation = gl.getUniformLocation(program, 'uRotation')
      const zoomLocation = gl.getUniformLocation(program, 'uZoom')
      const depthOffsetLocation = gl.getUniformLocation(program, 'uDepthOffset')
      const viewportScaleLocation = gl.getUniformLocation(program, 'uViewportScale')
      const sunLocation = gl.getUniformLocation(program, 'uSunDirection')
      const mapStyleLocation = gl.getUniformLocation(program, 'uMapStyle')
      const gridZoomLocation = gl.getUniformLocation(program, 'uGridZoom')
      const globalUniforms = {
        rotation: gl.getUniformLocation(globalProgram, 'uRotation'),
        zoom: gl.getUniformLocation(globalProgram, 'uZoom'),
        depth: gl.getUniformLocation(globalProgram, 'uDepthOffset'),
        viewport: gl.getUniformLocation(globalProgram, 'uViewportScale'),
        sun: gl.getUniformLocation(globalProgram, 'uSunDirection'),
        sunView: gl.getUniformLocation(globalProgram, 'uSunViewDirection'),
        cloudOffset: gl.getUniformLocation(globalProgram, 'uCloudOffset'),
        style: gl.getUniformLocation(globalProgram, 'uMapStyle'),
        dayTexel: gl.getUniformLocation(globalProgram, 'uDayTexel'),
      }
      gl.useProgram(globalProgram)
      for (const [name, unit] of [['uDay', 0], ['uNight', 1], ['uClouds', 2], ['uBorders', 3]]) {
        gl.uniform1i(gl.getUniformLocation(globalProgram, name), unit)
      }
      const globalPositionLocation = gl.getAttribLocation(globalProgram, 'aPosition')
      const globalUvLocation = gl.getAttribLocation(globalProgram, 'aUv')

      const tileUniforms = {
        rotation: gl.getUniformLocation(tileProgram, 'uRotation'),
        zoom: gl.getUniformLocation(tileProgram, 'uZoom'),
        styleZoom: gl.getUniformLocation(tileProgram, 'uStyleZoom'),
        viewport: gl.getUniformLocation(tileProgram, 'uViewportScale'),
        depth: gl.getUniformLocation(tileProgram, 'uDepthOffset'),
        sun: gl.getUniformLocation(tileProgram, 'uSunDirection'),
        sunView: gl.getUniformLocation(tileProgram, 'uSunViewDirection'),
        style: gl.getUniformLocation(tileProgram, 'uMapStyle'),
        uvScale: gl.getUniformLocation(tileProgram, 'uUvScale'),
        uvOffset: gl.getUniformLocation(tileProgram, 'uUvOffset'),
        opacity: gl.getUniformLocation(tileProgram, 'uOpacity'),
      }
      gl.useProgram(tileProgram)
      gl.uniform1i(gl.getUniformLocation(tileProgram, 'uTile'), 0)
      gl.uniform1i(gl.getUniformLocation(tileProgram, 'uNight'), 1)
      const tilePositionLocation = gl.getAttribLocation(tileProgram, 'aPosition')
      const tileUvLocation = gl.getAttribLocation(tileProgram, 'aUv')

      function bindGeometry(position, uv, vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0)
        gl.enableVertexAttribArray(uv)
        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12)
      }

      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      const globalTextureSize = Math.min(4096, 2 ** Math.floor(Math.log2(maxTextureSize)))

      function uploadGlobalTexture(texture, unit, source) {
        let image = source
        if (source.width > globalTextureSize) {
          image = document.createElement('canvas')
          image.width = globalTextureSize
          image.height = globalTextureSize / 2
          image.getContext('2d').drawImage(source, 0, 0, image.width, image.height)
        }
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.generateMipmap(gl.TEXTURE_2D)
        return image.width
      }

      function loadGlobalTexture(url, unit) {
        const texture = gl.createTexture()
        const image = new Image()
        image.onload = () => {
          if (disposed) return
          const width = uploadGlobalTexture(texture, unit, image)
          if (unit === 0) dayTextureWidth = width
          if (unit === 1) nightTextureReady = true
          loadedGlobalTextures += 1
          scheduleDraw()
        }
        image.onerror = () => {
          if (!disposed) console.warn(`Não foi possível carregar a textura ${url}`)
        }
        image.src = url
        return texture
      }

      dayTexture = loadGlobalTexture('/earth-day-mid.webp', 0)
      nightTexture = loadGlobalTexture('/earth-night-mid.webp', 1)
      cloudTexture = loadGlobalTexture('/earth-clouds.webp', 2)
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
          const borderCanvas = createBordersCanvas(data, Math.min(globalTextureSize, 2048))
          gl.activeTexture(gl.TEXTURE3)
          gl.bindTexture(gl.TEXTURE_2D, borderTexture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, borderCanvas)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.generateMipmap(gl.TEXTURE_2D)
          scheduleDraw()
        })
        .catch((error) => {
          if (!disposed && error.name !== 'AbortError') console.warn('Não foi possível carregar as fronteiras:', error)
        })

      function ensureTileEntry(tile, source) {
        const key = tileKey(source, tile)
        const cached = tileCache.get(key)
        if (cached) return cached
        const vertices = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
        gl.bufferData(gl.ARRAY_BUFFER, tileMesh(tile).vertices, gl.STATIC_DRAW)
        const entry = { texture: null, vertices, loading: false, failed: false }
        tileCache.set(key, entry)
        return entry
      }

      function requestTile(tile, source) {
        if (loadingTiles >= 4) return
        const entry = ensureTileEntry(tile, source)
        if (entry.texture || entry.loading || entry.failed) return
        entry.loading = true
        loadingTiles += 1
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => {
          if (disposed) return
          loadingTiles -= 1
          const texture = gl.createTexture()
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          entry.texture = texture
          entry.loading = false
          scheduleDraw()
          if (tileRequestTimer === null) loadVisibleTiles()
        }
        image.onerror = () => {
          if (disposed) return
          entry.loading = false
          entry.failed = true
          loadingTiles -= 1
          if (tileRequestTimer === null) loadVisibleTiles()
        }
        image.src = tileUrl(source, tile)
      }

      function loadVisibleTiles() {
        for (const tile of desiredTiles) {
          if (loadingTiles >= 4) break
          requestTile(tile, desiredTileSource)
        }
      }

      function updateVisibleTiles(tiles, source) {
        desiredTiles = tiles
        desiredTileSource = source
        const signature = tiles.map((tile) => tileKey(source, tile)).join('|')
        if (signature === desiredTileSignature) return
        desiredTileSignature = signature
        if (tileRequestTimer !== null) window.clearTimeout(tileRequestTimer)
        tileRequestTimer = tiles.length ? window.setTimeout(() => {
          tileRequestTimer = null
          loadVisibleTiles()
        }, 120) : null
      }

      function drawTiles(tiles, source, rotation, viewportScale, sun, opacity) {
        if (!tiles.length) return
        const wanted = new Set(tiles.map((tile) => tileKey(source, tile)))
        const protectedKeys = new Set(wanted)
        const complete = tiles.every((tile) => tileCache.get(tileKey(source, tile))?.texture)
        gl.useProgram(tileProgram)
        gl.uniformMatrix3fv(tileUniforms.rotation, false, rotation)
        gl.uniform1f(tileUniforms.zoom, zoom)
        gl.uniform1f(tileUniforms.styleZoom, Math.min(zoom, 6))
        gl.uniform2f(tileUniforms.viewport, viewportScale[0], viewportScale[1])
        gl.uniform1f(tileUniforms.depth, 0.001)
        gl.uniform3f(tileUniforms.sun, sun[0], sun[1], sun[2])
        gl.uniform3f(tileUniforms.sunView,
          rotation[0] * sun[0] + rotation[3] * sun[1] + rotation[6] * sun[2],
          rotation[1] * sun[0] + rotation[4] * sun[1] + rotation[7] * sun[2],
          rotation[2] * sun[0] + rotation[5] * sun[1] + rotation[8] * sun[2])
        gl.uniform1f(tileUniforms.style, activeMapStyle === 'hologram' ? 2 : activeMapStyle === 'atlas' ? 1 : 0)
        gl.uniform1f(tileUniforms.opacity, opacity)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, nightTextureReady ? nightTexture : borderTexture)
        gl.disable(gl.DEPTH_TEST)
        if (opacity < 1) {
          gl.enable(gl.BLEND)
          // Keep the canvas opaque while mixing tile colors with the globe below.
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        }

        function paint(geometry, image, scale = 1, offsetX = 0, offsetY = 0) {
          bindGeometry(tilePositionLocation, tileUvLocation, geometry.vertices, tileIndexBuffer)
          gl.uniform2f(tileUniforms.uvScale, scale, scale)
          gl.uniform2f(tileUniforms.uvOffset, offsetX, offsetY)
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, image.texture)
          gl.drawElements(gl.TRIANGLES, tileIndices.length, gl.UNSIGNED_SHORT, 0)
        }

        // On zooming out, the last complete level still covers the center while new tiles arrive.
        const previous = fallbackLayers.get(source)
        if (!complete && previous?.[0]?.level >= tiles[0].level) {
          for (const tile of previous) {
            const key = tileKey(source, tile)
            if (wanted.has(key)) continue
            const entry = tileCache.get(key)
            if (!entry?.texture) continue
            protectedKeys.add(key)
            paint(entry, entry)
          }
        }

        for (const tile of tiles) {
          const key = tileKey(source, tile)
          let entry = tileCache.get(key)
          if (entry?.texture) {
            paint(entry, entry)
          } else {
            // Reuse the sharpest available parent on the new tile's own mesh.
            for (let level = tile.level - 1; level >= 2; level -= 1) {
              const parent = tileAncestorUv(tile, level)
              const parentKey = tileKey(source, parent.tile)
              const parentEntry = tileCache.get(parentKey)
              if (!parentEntry?.texture) continue
              protectedKeys.add(parentKey)
              entry ??= ensureTileEntry(tile, source)
              paint(entry, parentEntry, parent.scale, parent.offsetX, parent.offsetY)
              break
            }
          }
          if (entry) {
            tileCache.delete(key)
            tileCache.set(key, entry)
          }
        }
        gl.disable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
        if (complete) fallbackLayers.set(source, tiles)
        for (const [key, entry] of tileCache) {
          if (tileCache.size <= 64) break
          if (entry.loading || protectedKeys.has(key)) continue
          if (entry.texture) gl.deleteTexture(entry.texture)
          if (entry.vertices) gl.deleteBuffer(entry.vertices)
          tileCache.delete(key)
        }
      }

      function draw() {
        if (disposed || canvas.width === 0 || canvas.height === 0) return
        const sun = getSunDirection(new Date())
        const rotation = rotationMatrix(yaw, pitch)
        const viewportScale = [
          Math.min(1, canvas.clientHeight / canvas.clientWidth),
          Math.min(1, canvas.clientWidth / canvas.clientHeight),
        ]
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        const tiles = zoom >= 1.45 ? visibleTiles(canvas.clientWidth, canvas.clientHeight, zoom, rotation) : []
        const source = tileSourceForStyle(activeMapStyle)
        updateVisibleTiles(tiles, source)
        const completeTiles = tiles.length > 0 && tiles.every((tile) => tileCache.get(tileKey(source, tile))?.texture)
        const completeTileCoverage = zoom >= 10 && completeTiles
        if (!completeTileCoverage) {
          if (loadedGlobalTextures === 3) {
            gl.useProgram(globalProgram)
            bindGeometry(globalPositionLocation, globalUvLocation, vertexBuffer, indexBuffer)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, dayTexture)
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, nightTexture)
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, cloudTexture)
            gl.activeTexture(gl.TEXTURE3)
            gl.bindTexture(gl.TEXTURE_2D, borderTexture)
            gl.uniformMatrix3fv(globalUniforms.rotation, false, rotation)
            gl.uniform1f(globalUniforms.zoom, zoom)
            gl.uniform1f(globalUniforms.depth, 0)
            gl.uniform2f(globalUniforms.viewport, viewportScale[0], viewportScale[1])
            gl.uniform2f(globalUniforms.dayTexel, 1 / dayTextureWidth, 2 / dayTextureWidth)
            gl.uniform3f(globalUniforms.sun, sun[0], sun[1], sun[2])
            gl.uniform3f(globalUniforms.sunView,
              rotation[0] * sun[0] + rotation[3] * sun[1] + rotation[6] * sun[2],
              rotation[1] * sun[0] + rotation[4] * sun[1] + rotation[7] * sun[2],
              rotation[2] * sun[0] + rotation[5] * sun[1] + rotation[8] * sun[2])
            gl.uniform1f(globalUniforms.cloudOffset, ((Date.now() / 1000) % 43200) / 43200)
            gl.uniform1f(globalUniforms.style, activeMapStyle === 'hologram' ? 2 : activeMapStyle === 'atlas' ? 1 : 0)
          } else {
            gl.useProgram(program)
            bindGeometry(positionLocation, uvLocation, vertexBuffer, indexBuffer)
            gl.uniformMatrix3fv(rotationLocation, false, rotation)
            gl.uniform1f(zoomLocation, zoom)
            gl.uniform1f(depthOffsetLocation, 0)
            gl.uniform2f(viewportScaleLocation, viewportScale[0], viewportScale[1])
            gl.uniform3f(sunLocation, sun[0], sun[1], sun[2])
            gl.uniform1f(mapStyleLocation, activeMapStyle === 'hologram' ? 2 : activeMapStyle === 'atlas' ? 1 : 0)
            gl.uniform1f(gridZoomLocation, zoom)
          }
          gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0)
        }
        const blend = Math.max(0, Math.min(1, (zoom - 1.6) / 1.6))
        const tileOpacity = blend * blend * (3 - 2 * blend)
        if (tileOpacity > 0 && (zoom >= 3.2 || completeTiles)) {
          drawTiles(tiles, source, rotation, viewportScale, sun, tileOpacity)
        }
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
        const clamped = Math.max(1, Math.min(65536, nextZoom))
        if (Math.abs(clamped - zoom) < 0.001) return
        zoom = clamped
        setZoomPercent(Math.round(zoom * 100))
        scheduleDraw()
      }

      function zoomAround(nextZoom, clientX, clientY) {
        const bounds = canvas.getBoundingClientRect()
        const x = clientX - bounds.left
        const y = clientY - bounds.top
        const point = globePointAt(x, y, bounds.width, bounds.height, zoom, rotationMatrix(yaw, pitch))
        updateZoom(nextZoom)
        if (!point) return
        for (let iteration = 0; iteration < 2; iteration += 1) {
          const shifted = globePointAt(x, y, bounds.width, bounds.height, zoom, rotationMatrix(yaw, pitch))
          if (!shifted) break
          const longitudeDifference = ((point.longitude - shifted.longitude + 540) % 360) - 180
          yaw -= longitudeDifference * Math.PI / 180
          pitch = Math.max(-1.2, Math.min(1.2, pitch + (point.latitude - shifted.latitude) * Math.PI / 180))
        }
        scheduleDraw()
      }

      function resize() {
        const bounds = scene.getBoundingClientRect()
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
        const scale = Math.min(pixelRatio, 1400 / Math.max(bounds.width, bounds.height, 1))
        const width = Math.round(bounds.width * scale)
        const height = Math.round(bounds.height * scale)
        scene.style.setProperty('--scene-size', `${Math.min(bounds.width, bounds.height)}px`)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        draw()
      }

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
          if (pinchDistance && distance) {
            const [first, second] = [...pointers.values()]
            zoomAround(zoom * distance / pinchDistance, (first.x + second.x) / 2, (first.y + second.y) / 2)
          }
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
        zoomAround(zoom * Math.exp(-delta * 0.0015), event.clientX, event.clientY)
      }

      function onKeyDown(event) {
        const step = Math.PI / 15
        if (event.key === 'ArrowLeft') yaw -= step
        else if (event.key === 'ArrowRight') yaw += step
        else if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - step)
        else if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + step)
        else if (event.key === '+' || event.key === '=') updateZoom(zoom * (zoom < 4 ? 1.5 : 2))
        else if (event.key === '-') updateZoom(zoom / (zoom <= 4 ? 1.5 : 2))
        else if (event.key === 'Home') {
          yaw = getInitialYaw()
          pitch = 0.13
          updateZoom(1)
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
      setReady(true)

      return () => {
        disposed = true
        resetRef.current = () => {}
        setMapStyleRef.current = () => {}
        focusSightingRef.current = () => {}
        setLocationRef.current = () => {}
        adjustZoomRef.current = () => {}
        window.clearInterval(clockInterval)
        borderController.abort()
        if (tileRequestTimer !== null) window.clearTimeout(tileRequestTimer)
        if (drawFrame !== null) window.cancelAnimationFrame(drawFrame)
        resizeObserver.disconnect()
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        scene.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('keydown', onKeyDown)
        for (const entry of tileCache.values()) {
          if (entry.texture) gl.deleteTexture(entry.texture)
          if (entry.vertices) gl.deleteBuffer(entry.vertices)
        }
        gl.deleteBuffer(vertexBuffer)
        gl.deleteBuffer(indexBuffer)
        gl.deleteBuffer(tileIndexBuffer)
        gl.deleteTexture(dayTexture)
        gl.deleteTexture(nightTexture)
        gl.deleteTexture(cloudTexture)
        gl.deleteTexture(borderTexture)
        gl.deleteProgram(program)
        gl.deleteProgram(globalProgram)
        gl.deleteProgram(tileProgram)
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
      <canvas
        className="planet-scene__canvas"
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Globo 3D da Terra. Arraste para girar, use a roda do mouse ou pinça para ampliar até o nível das ruas. As setas giram o globo, mais e menos controlam o zoom."
      />
      {mapStyle === 'hologram' && zoomPercent === 100 && !failed && <span className="planet-scene__holo-scan" aria-hidden="true" />}
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
          <button type="button" aria-label="Diminuir zoom" disabled={zoomPercent <= 100} onClick={() => adjustZoomRef.current(zoomPercent <= 400 ? 0.8 : 0.5)}>−</button>
          <output className="mono" aria-label={`Zoom atual: ${zoomPercent}%`}>×{(zoomPercent / 100).toLocaleString('pt-BR', { maximumFractionDigits: zoomPercent < 1000 ? 1 : 0 })}</output>
          <button type="button" aria-label="Aumentar zoom" disabled={zoomPercent >= 6553600} onClick={() => adjustZoomRef.current(zoomPercent < 400 ? 1.5 : 2)}>+</button>
        </div>
      )}
      {!failed && (
        <div className="planet-scene__map-credit mono">
          {zoomPercent < 320 ? (
            <>
              <span>{zoomPercent > 160 ? 'GLOBO NASA · DETALHES NO ZOOM' : 'IMAGENS GLOBAIS · NASA'}</span>
              <a href="https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_8192.tif" target="_blank" rel="noopener noreferrer">
                NASA Blue Marble · Terra à noite
              </a>
              {zoomPercent > 160 && (
                <a href={mapStyle === 'satellite' ? 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9' : 'https://www.openstreetmap.org/copyright'} target="_blank" rel="noopener noreferrer">
                  {mapStyle === 'satellite' ? '© Esri e colaboradores' : '© OpenStreetMap contributors'}
                </a>
              )}
            </>
          ) : mapStyle === 'satellite' ? (
            <>
              <span>IMAGENS REAIS · ESRI</span>
              <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">
                © Esri, Vantor, Earthstar Geographics<br />e GIS User Community
              </a>
            </>
          ) : (
            <>
              <span>{zoomPercent >= 600 ? 'DETALHES DE RUAS · OSM' : 'MAPA BASE · OSM'}</span>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
            </>
          )}
        </div>
      )}
      {!failed && zoomPercent >= 600 && (
        <button className="planet-scene__overview mono" type="button" onClick={() => adjustZoomRef.current(100 / zoomPercent)}>VER GLOBO ↗</button>
      )}
      {!failed && (
        <button className="planet-scene__reset mono" type="button" onClick={() => resetRef.current()}>
          ↺ {location ? 'MINHA POSIÇÃO' : 'REORIENTAR'}
        </button>
      )}
      <span className="planet-scene__label mono">{failed ? 'GLOBO INDISPONÍVEL' : `DIA / NOITE · ${utcTime}`}</span>
    </>
  )
}
