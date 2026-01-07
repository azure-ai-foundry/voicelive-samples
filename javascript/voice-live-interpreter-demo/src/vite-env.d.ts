/// <reference types="vite/client" />

import type { Buffer } from 'buffer'

declare global {
  interface Window {
    Buffer?: typeof Buffer
    process?: any
    global?: typeof globalThis
  }
}

export {}
