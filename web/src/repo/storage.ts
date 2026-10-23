import type { StateStorage } from 'zustand/middleware'

/**
 * Where learner state lives. v1 keeps everything in this browser's
 * localStorage. A PocketBase-backed implementation can replace this later
 * without touching the stores (see docs/ROADMAP.md).
 */
export interface ProgressRepo extends StateStorage {
  readonly kind: 'local' | 'pocketbase'
}

const memory = new Map<string, string>()

export const localRepo: ProgressRepo = {
  kind: 'local',
  getItem(name) {
    try {
      return localStorage.getItem(name) ?? memory.get(name) ?? null
    } catch {
      return memory.get(name) ?? null
    }
  },
  setItem(name, value) {
    memory.set(name, value)
    try {
      localStorage.setItem(name, value)
    } catch {
      // Storage is full or blocked (private mode); keep it in memory for this tab.
    }
  },
  removeItem(name) {
    memory.delete(name)
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const repo: ProgressRepo = localRepo
