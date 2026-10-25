import type { Problem } from '@/engine/problems/types'
import { bakery } from './e1-bakery'
import { oneServer } from './e2-one-server'
import { leaderboard } from './e3-leaderboard'
import { loggedOut } from './e4-logged-out'
import { blackFriday } from './h1-black-friday'
import { receipts } from './m1-receipts'
import { shortLinks } from './m2-short-links'
import { bankSync } from './m3-bank-sync'

export const PROBLEMS: Problem[] = [bakery, oneServer, leaderboard, loggedOut, receipts, shortLinks, bankSync, blackFriday]

export const problemById = (id: string) => PROBLEMS.find((p) => p.id === id)
