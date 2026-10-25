import type { Shift } from '@/engine/shifts/types'
import { launchDay, mondayRush } from './ch1'

export const SHIFTS: Shift[] = [mondayRush, launchDay]

export const shiftById = (id: string) => SHIFTS.find((s) => s.id === id)
