const MAX_MERCATOR_LATITUDE = 85.05112878

export function tileCoordinates(latitude, longitude, level) {
  const count = 2 ** level
  const lat = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude)) * Math.PI / 180
  return {
    x: (longitude + 180) / 360 * count,
    y: (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * count,
  }
}

export function tileLatitude(y, level) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** level))) * 180 / Math.PI
}

export function tileLevel(zoom, sceneSize) {
  const tilePixelTarget = zoom < 2.5 ? 512 : 256
  return Math.max(2, Math.min(19, Math.floor(Math.log2(Math.PI * 0.86 * sceneSize * zoom / tilePixelTarget))))
}

// Sample the part of a loaded parent image that covers a more detailed tile.
export function tileAncestorUv(tile, ancestorLevel) {
  const tilesPerSide = 2 ** (tile.level - ancestorLevel)
  const x = Math.floor(tile.x / tilesPerSide)
  const y = Math.floor(tile.y / tilesPerSide)
  const scale = 1 / tilesPerSide
  return {
    tile: { level: ancestorLevel, x, y },
    scale,
    offsetX: (tile.x - x * tilesPerSide) * scale,
    offsetY: (tilesPerSide - 1 - (tile.y - y * tilesPerSide)) * scale,
  }
}

// Undo the orthographic globe projection at a point in canvas CSS pixels.
export function globePointAt(x, y, width, height, zoom, rotation) {
  const radius = Math.min(width, height) * 0.43 * zoom
  const viewX = (x - width / 2) / radius
  const viewY = (height / 2 - y) / radius
  const distance = viewX * viewX + viewY * viewY
  if (distance >= 1) return null
  const viewZ = Math.sqrt(1 - distance)
  const worldX = rotation[0] * viewX + rotation[1] * viewY + rotation[2] * viewZ
  const worldY = rotation[3] * viewX + rotation[4] * viewY + rotation[5] * viewZ
  const worldZ = rotation[6] * viewX + rotation[7] * viewY + rotation[8] * viewZ
  return {
    latitude: Math.asin(Math.max(-1, Math.min(1, worldY))) * 180 / Math.PI,
    longitude: Math.atan2(worldX, worldZ) * 180 / Math.PI,
  }
}

function tileIntersectsViewport(tile, width, height, zoom, rotation) {
  const steps = tile.level <= 2 ? 8 : tile.level <= 3 ? 4 : 2
  const count = 2 ** tile.level
  const radius = Math.min(width, height) * 0.43 * zoom
  for (let row = 0; row <= steps; row += 1) {
    const latitude = tileLatitude(tile.y + row / steps, tile.level) * Math.PI / 180
    for (let column = 0; column <= steps; column += 1) {
      const longitude = ((tile.unwrappedX + column / steps) / count * 360 - 180) * Math.PI / 180
      const x = Math.cos(latitude) * Math.sin(longitude)
      const y = Math.sin(latitude)
      const z = Math.cos(latitude) * Math.cos(longitude)
      const viewX = rotation[0] * x + rotation[3] * y + rotation[6] * z
      const viewY = rotation[1] * x + rotation[4] * y + rotation[7] * z
      const viewZ = rotation[2] * x + rotation[5] * y + rotation[8] * z
      if (viewZ > 0 && Math.abs(viewX * radius) <= width / 2 && Math.abs(viewY * radius) <= height / 2) return true
    }
  }
  return false
}

export function visibleTiles(width, height, zoom, rotation) {
  if (!width || !height) return []
  const level = tileLevel(zoom, Math.min(width, height))
  const count = 2 ** level
  const center = globePointAt(width / 2, height / 2, width, height, zoom, rotation)
  if (!center) return []
  const xs = []
  const ys = []
  function include(screenX, screenY) {
    const point = globePointAt(screenX, screenY, width, height, zoom, rotation)
    if (!point) return
    const unwrappedLongitude = center.longitude + ((point.longitude - center.longitude + 540) % 360) - 180
    const tile = tileCoordinates(point.latitude, unwrappedLongitude, level)
    xs.push(tile.x)
    ys.push(tile.y)
  }
  const divisions = zoom < 2.5 ? 4 : 2
  for (let column = 0; column <= divisions; column += 1) {
    for (let row = 0; row <= divisions; row += 1) {
      include(width * column / divisions, height * row / divisions)
    }
  }
  if (zoom < 2.5) {
    const radius = Math.min(width, height) * 0.43 * zoom * 0.999
    for (let angle = 0; angle < 32; angle += 1) {
      const radians = angle * Math.PI / 16
      const x = width / 2 + radius * Math.cos(radians)
      const y = height / 2 + radius * Math.sin(radians)
      if (x >= 0 && x <= width && y >= 0 && y <= height) include(x, y)
    }
  }
  if (!xs.length) return []
  const minX = Math.floor(Math.min(...xs))
  const maxX = Math.floor(Math.max(...xs))
  const minY = Math.max(0, Math.floor(Math.min(...ys)))
  const maxY = Math.min(count - 1, Math.floor(Math.max(...ys)))
  const result = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const tile = { level, x: ((x % count) + count) % count, y, unwrappedX: x }
      if (level > 3 || tileIntersectsViewport(tile, width, height, zoom, rotation)) result.push(tile)
    }
  }
  return result
}

export function tileMesh(tile, segments = 16) {
  const vertices = []
  const indices = []
  const count = 2 ** tile.level
  for (let row = 0; row <= segments; row += 1) {
    const latitude = tileLatitude(tile.y + row / segments, tile.level) * Math.PI / 180
    for (let column = 0; column <= segments; column += 1) {
      const longitude = ((tile.unwrappedX + column / segments) / count * 360 - 180) * Math.PI / 180
      vertices.push(
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude),
        column / segments,
        1 - row / segments,
      )
    }
  }
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const first = row * (segments + 1) + column
      const next = first + segments + 1
      indices.push(first, next, first + 1, first + 1, next, next + 1)
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}
