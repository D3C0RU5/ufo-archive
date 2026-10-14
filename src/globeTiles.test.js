import test from 'node:test'
import assert from 'node:assert/strict'
import { globePointAt, tileAncestorUv, tileCoordinates, tileLatitude, tileLevel, tileMesh, visibleTiles } from './globeTiles.js'

const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])

test('the global view requests only the visible hemisphere', () => {
  const tiles = visibleTiles(800, 600, 1, identity)
  assert.equal(tileLevel(1, 600), 2)
  assert.equal(tiles.length, 8)
  assert.ok(tiles.every(({ x }) => x === 1 || x === 2))
})

test('the visible area follows the globe projection at street zoom', () => {
  const zoom = 32768
  const tiles = visibleTiles(800, 600, zoom, identity)
  const level = tileLevel(zoom, 600)
  const center = tileCoordinates(0, 0, level)
  assert.ok(tiles.length > 0 && tiles.length < 30)
  assert.ok(tiles.some((tile) => tile.x === Math.floor(center.x) && tile.y === Math.floor(center.y)))
  assert.ok(tiles.every((tile) => tile.level === level && tile.y >= 0 && tile.y < 2 ** level))
})

test('tile selection stays local when the globe center crosses the date line', () => {
  const yaw = -179 * Math.PI / 180
  const rotation = new Float32Array([
    Math.cos(yaw), 0, -Math.sin(yaw),
    0, 1, 0,
    Math.sin(yaw), 0, Math.cos(yaw),
  ])
  const tiles = visibleTiles(800, 600, 100, rotation)
  assert.ok(tiles.length > 0 && tiles.length < 30)
  assert.ok(tiles.every(({ x, level }) => x >= 0 && x < 2 ** level))
})

test('tile mesh maps its top edge north and its image across the whole tile', () => {
  const tile = { level: 8, x: 128, unwrappedX: 128, y: 128 }
  const mesh = tileMesh(tile, 2)
  assert.equal(mesh.vertices[3], 0)
  assert.equal(mesh.vertices[4], 1)
  assert.equal(mesh.vertices[mesh.vertices.length - 2], 1)
  assert.equal(mesh.vertices[mesh.vertices.length - 1], 0)
  assert.ok(tileLatitude(128, 8) > tileLatitude(129, 8))
  assert.deepEqual(globePointAt(400, 300, 800, 600, 1, identity), { latitude: 0, longitude: 0 })
})

test('a missing tile samples the correct quadrant of a cached parent', () => {
  const northEast = tileAncestorUv({ level: 4, x: 7, y: 4 }, 3)
  assert.deepEqual(northEast, {
    tile: { level: 3, x: 3, y: 2 },
    scale: 0.5,
    offsetX: 0.5,
    offsetY: 0.5,
  })
  const southWest = tileAncestorUv({ level: 4, x: 6, y: 5 }, 3)
  assert.deepEqual(southWest, {
    tile: { level: 3, x: 3, y: 2 },
    scale: 0.5,
    offsetX: 0,
    offsetY: 0,
  })
  assert.deepEqual(tileAncestorUv({ level: 5, x: 15, y: 8 }, 3), {
    tile: { level: 3, x: 3, y: 2 },
    scale: 0.25,
    offsetX: 0.75,
    offsetY: 0.75,
  })
})
