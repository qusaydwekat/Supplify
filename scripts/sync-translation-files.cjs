/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Rebuilds messages/ar-keys.json and messages/en-column.txt from ar.json + en.overlay.json
 * so string-level translation tables stay aligned (same sort, same length).
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const arPath = path.join(root, 'messages', 'ar.json')
const enPath = path.join(root, 'messages', 'en.overlay.json')
const keysPath = path.join(root, 'messages', 'ar-keys.json')
const colPath = path.join(root, 'messages', 'en-column.txt')

function collectStrings(node, out) {
  if (typeof node === 'string') {
    out.add(node)
    return
  }
  if (!node || typeof node !== 'object') return
  for (const v of Object.values(node)) collectStrings(v, out)
}

function walkPairs(a, e, pathKeys, onLeaf) {
  if (typeof a === 'string') {
    if (typeof e !== 'string') throw new Error(`Expected string at ${pathKeys.join('.')}`)
    onLeaf(a, e)
    return
  }
  if (!a || typeof a !== 'object') {
    if (a !== e) throw new Error(`Structure mismatch at ${pathKeys.join('.')}`)
    return
  }
  if (!e || typeof e !== 'object') throw new Error(`Structure mismatch at ${pathKeys.join('.')}`)
  const ak = Object.keys(a).sort()
  const ek = Object.keys(e).sort()
  if (ak.join(',') !== ek.join(',')) {
    throw new Error(`Key mismatch at ${pathKeys.join('.')}: ${ak.join(',')} vs ${ek.join(',')}`)
  }
  for (const k of ak) {
    walkPairs(a[k], e[k], [...pathKeys, k], onLeaf)
  }
}

const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'))
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

const map = new Map()
walkPairs(ar, en, [], (arS, enS) => {
  map.set(arS, enS)
})

const unique = new Set()
collectStrings(ar, unique)
const keys = [...unique].sort()

for (const k of keys) {
  if (!map.has(k)) {
    console.error('Missing EN for Arabic string:', JSON.stringify(k))
    process.exit(1)
  }
}

const lines = keys.map((k) => map.get(k))

fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2) + '\n')
fs.writeFileSync(colPath, lines.join('\n') + '\n')
console.log('Synced', keys.length, 'translation rows')
