import assert from 'node:assert/strict'
import test from 'node:test'
import { getSubsolarPoint, getSunDirection } from './solar.js'

test('the subsolar point stays near the equator at the March equinox', () => {
  const point = getSubsolarPoint(new Date('2026-03-20T12:00:00Z'))
  assert.ok(Math.abs(point.latitude) < 2)
  assert.ok(Math.abs(point.longitude) < 5)
})

test('the Sun moves west by about 90 degrees over six hours', () => {
  const noon = getSubsolarPoint(new Date('2026-03-20T12:00:00Z'))
  const evening = getSubsolarPoint(new Date('2026-03-20T18:00:00Z'))
  assert.ok(Math.abs((noon.longitude - evening.longitude) - 90) < 2)
})

test('the Sun direction is a unit vector', () => {
  const direction = getSunDirection(new Date('2026-10-10T16:00:00Z'))
  const length = Math.hypot(...direction)
  assert.ok(Math.abs(length - 1) < 0.000001)
})
