import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBoundary, filterSightings } from './dateFilter.js'
import { sightings } from './sightings.js'

const idsFor = (from = '', to = '') => filterSightings(sightings, { from, to }).map(({ id }) => id)

test('intervalo inclui datas inicial e final', () => {
  assert.deepEqual(idsFor('1986-05-19', '1986-05-19'), ['sao-jose-1986'])
  assert.deepEqual(idsFor('1986-05-20', '1986-05-20'), [])
})

test('períodos documentados sem dia exato continuam visíveis quando coincidem', () => {
  assert.deepEqual(idsFor('1978-01-01', '1978-12-31'), ['colares-1977'])
  assert.deepEqual(idsFor('1980-12-15', '1980-12-31'), ['rendlesham-1980'])
})

test('limites opcionais e intervalo limpo', () => {
  assert.deepEqual(idsFor('', '1952-07-19'), ['washington-1952'])
  assert.deepEqual(idsFor('1986-01-01'), ['sao-jose-1986'])
  assert.deepEqual(idsFor(), sightings.map(({ id }) => id))
})

test('ano e mês sem dia usam os limites completos do período', () => {
  assert.equal(buildBoundary({ year: '1977', month: '', day: '' }, false), '1977-01-01')
  assert.equal(buildBoundary({ year: '1978', month: '', day: '' }, true), '1978-12-31')
  assert.equal(buildBoundary({ year: '1980', month: '12', day: '' }, true), '1980-12-31')
  assert.equal(buildBoundary({ year: '1986', month: '05', day: '19' }, false), '1986-05-19')
  assert.equal(buildBoundary({ year: '1980', month: '', day: '' }, true), '1980-12-31')
  assert.equal(buildBoundary({ year: '', month: '', day: '' }, true), '')
})
