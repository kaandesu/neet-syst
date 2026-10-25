import type { ReactNode } from 'react'
import type { BlockId, NodeStatus } from '@/engine/types'
import { FactoryDeco, SynthDeco, TransitCanvas, TransitDeco } from './decos'

export type SkinId = 'current' | 'pixel' | 'blueprint' | 'synth' | 'factory' | 'gameboy' | 'transit'

export type DecoProps = { block: BlockId; status: NodeStatus; util: number; dropped: number }

export interface Skin {
  root: string
  panel: string
  heading: string
  btn: string
  btnOn: string
  big: string
  edge: 'curve' | 'step' | 'sag' | 'octo'
  packet: 'circle' | 'square' | 'crate' | 'train'
  icon: 'lucide' | 'ascii' | 'tile' | 'none'
  arrow?: boolean
  /** One colour per link, cycled (patch cables, transit lines). */
  edgeColors?: string[]
  verdict?: [ok: string, bad: string]
  title?: string
  sound?: boolean
  /** Extra layers drawn inside each node. */
  Deco?: (p: DecoProps) => ReactNode
  /** SVG drawn behind the links. */
  CanvasDeco?: () => ReactNode
}

export const ASCII: Partial<Record<BlockId, string>> = {
  client: 'USR',
  'web-server': 'SRV',
  service: 'SVC',
  'load-balancer': 'LB',
  'sql-db': 'SQL',
  'nosql-db': 'NOS',
  'read-replica': 'REP',
  cache: 'CCH',
}

/* ── Skins ───────────────────────────────────────────────────────────────────── */

export const SKINS: Record<SkinId, Skin> = {
  current: {
    root: 'bg-bg text-ink font-sans pg-current',
    panel: 'rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line',
    heading: 'text-xs font-bold tracking-wider text-muted uppercase',
    btn: 'rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink',
    btnOn: 'border-accent/40 bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
    big: 'text-2xl font-extrabold leading-none',
    edge: 'curve',
    packet: 'circle',
    icon: 'tile',
  },
  pixel: {
    root: 'px-root pg-pixel',
    panel: 'px-frame p-4',
    heading: 'px-h text-[10px]',
    btn: 'px-chip px-h text-[9px]',
    btnOn: 'px-chip-on',
    big: 'text-[32px] leading-none',
    edge: 'step',
    packet: 'square',
    icon: 'ascii',
  },
  blueprint: {
    root: 'bp-root pg-blueprint',
    panel: 'bp-frame p-4',
    heading: 'text-[11px] tracking-[0.24em] uppercase',
    btn: 'bp-btn bp-btn-sm',
    btnOn: 'bp-btn-solid',
    big: 'text-[24px] leading-none',
    edge: 'curve',
    packet: 'square',
    icon: 'lucide',
    arrow: true,
  },
  synth: {
    root: 'syn-root pg-synth',
    panel: 'syn-panel p-4',
    heading: 'syn-h',
    btn: 'syn-btn',
    btnOn: 'syn-btn-on',
    big: 'syn-big',
    edge: 'sag',
    packet: 'circle',
    icon: 'none',
    edgeColors: ['#ff5a4e', '#ffc93c', '#36d399', '#4cc9f0', '#f472b6', '#ff9f1c', '#a78bfa'],
    verdict: ['In tune', 'Clipping'],
    title: 'Patchbay',
    sound: true,
    Deco: SynthDeco,
  },
  factory: {
    root: 'fac-root pg-factory',
    panel: 'fac-panel p-4',
    heading: 'fac-h',
    btn: 'fac-btn',
    btnOn: 'fac-btn-on',
    big: 'text-[30px] leading-none',
    edge: 'step',
    packet: 'crate',
    icon: 'lucide',
    verdict: ['Running', 'Jammed'],
    title: 'Factory floor',
    Deco: FactoryDeco,
  },
  gameboy: {
    root: 'gb-root pg-gameboy',
    panel: 'gb-panel p-4',
    heading: 'gb-h',
    btn: 'gb-btn',
    btnOn: 'gb-btn-on',
    big: 'gb-big',
    edge: 'step',
    packet: 'square',
    icon: 'ascii',
    verdict: ['OK!', 'GAME OVER'],
    title: 'NEET·BOY',
  },
  transit: {
    root: 'tr-root pg-transit',
    panel: 'tr-board p-4',
    heading: 'tr-h',
    btn: 'tr-btn',
    btnOn: 'tr-btn-on',
    big: 'tr-big',
    edge: 'octo',
    packet: 'train',
    icon: 'none',
    edgeColors: ['#dc241f', '#0019a8', '#00782a', '#ffce00', '#9b0056', '#00a4a7', '#ee7c0e', '#894e24'],
    verdict: ['Good service', 'Severe delays'],
    title: 'Network map',
    Deco: TransitDeco,
    CanvasDeco: TransitCanvas,
  },
}
