import { Buffer } from 'buffer'

// Ensure Node-like globals exist before any SDK module evaluates.
const g = globalThis as any

g.Buffer ??= Buffer
// Some deps check `process` existence. Keep it minimal for browsers.
g.process ??= { env: {} }
// Some deps check `global`.
g.global ??= globalThis
