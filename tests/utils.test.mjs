import test from 'node:test'
import assert from 'node:assert/strict'

import { cn, firstRow } from '../src/lib/utils.ts'

test('cn merges Tailwind classes correctly', () => {
  assert.equal(cn('px-2 py-1', 'px-4'), 'py-1 px-4')
  assert.equal(cn('text-red-500', 'text-blue-500'), 'text-blue-500')
})

test('cn handles conditional classes', () => {
  assert.equal(cn('base', false && 'hidden', 'visible'), 'base visible')
  assert.equal(cn('base', undefined, 'visible'), 'base visible')
  assert.equal(cn('base', null, 'visible'), 'base visible')
})

test('cn handles arrays', () => {
  assert.equal(cn(['base', 'text-sm']), 'base text-sm')
  assert.equal(cn(['base', false && 'hidden']), 'base')
})

test('cn handles objects', () => {
  assert.equal(cn({ base: true, hidden: false, visible: true }), 'base visible')
})

test('firstRow returns null for null or undefined', () => {
  assert.equal(firstRow(null), null)
  assert.equal(firstRow(undefined), null)
})

test('firstRow returns first element of array', () => {
  assert.equal(firstRow(['first', 'second', 'third']), 'first')
  assert.equal(firstRow([42, 99]), 42)
  assert.deepEqual(firstRow([{ id: 1 }, { id: 2 }]), { id: 1 })
})

test('firstRow returns single value as-is', () => {
  assert.equal(firstRow('single'), 'single')
  assert.equal(firstRow(42), 42)
  assert.deepEqual(firstRow({ id: 1 }), { id: 1 })
})

test('firstRow returns null for empty array', () => {
  assert.equal(firstRow([]), null)
})
