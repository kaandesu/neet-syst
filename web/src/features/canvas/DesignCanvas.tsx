import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { BLOCKS } from '@/content/blocks'
import { addEdge, addNode, canConnect, matches, removeEdges, removeNodes } from '@/engine/lesson/runner'
import type { BlockMatch } from '@/engine/lesson/types'
import { roleOf } from '@/engine/sim/specs'
import type { BlockId, Design, PhaseResult, RegionZone } from '@/engine/types'
import type { Callout } from '@/features/mentor/coach'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'
import { useSkin } from '@/ui/ThemeToggle'
import { edgeTypes, type FlowEdgeT } from './FlowEdge'
import { NODE_H, NODE_W, nodeTypes, type BlockFlowNode, type GhostFlowNode, type ZoneFlowNode } from './nodes'

const DRAG_MIME = 'application/x-neet-block'
const SNAP_DIST = 110

export interface CanvasProps {
  design: Design
  onChange?: (d: Design) => void
  result?: PhaseResult | null
  blind?: boolean
  palette?: BlockId[]
  ghost?: { block: BlockId; x: number; y: number } | null
  highlight?: BlockMatch[]
  zones?: RegionZone[]
  readOnly?: boolean
  /** Extra points (e.g. future slots) the initial view should include. */
  fitPoints?: { x: number; y: number }[]
  /** "Click the part that…" mode: clicks pick a node instead of selecting or dragging. */
  pickMode?: boolean
  /** Specific nodes to pulse (e.g. the real culprit after a prediction). */
  pulseIds?: string[]
  /** Node shown in the inspector. */
  inspected?: string | null
  onNodeClick?: (id: string) => void
  onPaneClick?: () => void
  /** Speech bubbles pinned above blocks (mentor reactions, design review, "show me"). */
  callouts?: Callout[]
  /** Where the block tray sits; the lesson stage keeps the bottom free for its dialogue dock. */
  trayAt?: 'top' | 'bottom'
  /** The learner's pick in a "which part…?" question. */
  marked?: string | null
  /** Blocks to ask "is this needed?" about; the answer comes back through `onDoubt`. */
  doubtIds?: string[]
  onDoubt?: (id: string, keep: boolean) => void
}

export function DesignCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function CanvasInner({
  design,
  onChange,
  result,
  blind,
  palette = [],
  ghost,
  highlight = [],
  zones = [],
  readOnly,
  fitPoints = [],
  pickMode,
  pulseIds = [],
  inspected,
  onNodeClick,
  onPaneClick,
  callouts = [],
  trayAt = 'bottom',
  marked,
  doubtIds = [],
  onDoubt,
}: CanvasProps) {
  const rf = useReactFlow()
  const skin = useSkin()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<Record<string, { x: number; y: number }>>({})
  // Controlled React Flow needs measured sizes fed back, or handles never register.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})

  // The focused block (inspected, or the one selected block) and what it's wired to directly.
  const selectedNodes = design.nodes.filter((n) => selected.has(n.id))
  const focus = inspected ?? (selectedNodes.length === 1 ? selectedNodes[0].id : null)
  const neighbors = useMemo(() => {
    const out = new Set<string>()
    if (!focus) return out
    for (const e of design.edges) {
      if (e.from === focus) out.add(e.to)
      if (e.to === focus) out.add(e.from)
    }
    return out
  }, [design.edges, focus])

  const nodes = useMemo(() => {
    const zoneNodes: ZoneFlowNode[] = zones.map((z) => ({
      id: `zone:${z.id}`,
      type: 'zone',
      position: { x: z.x, y: z.y },
      data: { label: z.label, w: z.w, h: z.h },
      draggable: false,
      selectable: false,
      zIndex: -1,
      measured: measured[`zone:${z.id}`],
    }))
    const ghostNodes: GhostFlowNode[] = ghost
      ? [{ id: 'ghost', type: 'ghost', position: { x: ghost.x, y: ghost.y }, data: { block: ghost.block }, draggable: false, selectable: false, measured: measured.ghost }]
      : []
    const blockNodes: BlockFlowNode[] = design.nodes.map((n) => {
      const r = result?.nodes[n.id]
      return {
        id: n.id,
        type: 'block',
        position: dragging[n.id] ?? { x: n.x, y: n.y },
        data: {
          block: n.block,
          locked: n.locked,
          sticky: n.sticky,
          label: n.label,
          tier: n.tier,
          status: r?.status,
          utilization: r?.utilization,
          unlimited: (r?.capacity ?? 0) >= 1e9,
          inRps: r?.inRps,
          backlog: r?.backlog,
          blind,
          highlight: highlight.some((h) => matches(n.block, h)) || pulseIds.includes(n.id),
          pick: pickMode,
          inspected: inspected === n.id,
          callout: callouts.find((c) => c.nodeId === n.id),
          onDelete: readOnly || pickMode || n.locked || !onChange ? undefined : () => onChange(removeNodes(design, [n.id])),
          neighbor: neighbors.has(n.id),
          marked: !!marked && marked === n.id,
          doubt: onDoubt && doubtIds.includes(n.id) ? { onKeep: () => onDoubt(n.id, true), onRemove: () => onDoubt(n.id, false) } : undefined,
        },
        selected: !pickMode && selected.has(n.id),
        deletable: !n.locked && !readOnly,
        draggable: !readOnly && !pickMode,
        // Lift blocks that are talking so their bubble isn't hidden under a neighbour.
        zIndex: callouts.some((c) => c.nodeId === n.id) ? 10 : undefined,
        measured: measured[n.id],
      }
    })
    return [...zoneNodes, ...ghostNodes, ...blockNodes]
  }, [design, onChange, result, blind, ghost, highlight, zones, selected, dragging, readOnly, measured, pickMode, pulseIds, inspected, callouts, neighbors, marked, doubtIds, onDoubt])

  const edges = useMemo<FlowEdgeT[]>(() => {
    const maxRps = Math.max(1, ...Object.values(result?.edges ?? {}))
    const byId = new Map(design.nodes.map((n) => [n.id, n]))
    return design.edges.map((e) => {
      const target = byId.get(e.to)
      const role = target ? roleOf(target.block) : undefined
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'flow',
        selected: selected.has(e.id),
        deletable: !readOnly,
        markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9 },
        data: {
          rps: blind ? 0 : result?.edges[e.id],
          maxRps,
          tone: blind ? undefined : result?.nodes[e.to]?.status,
          async: role === 'queue',
          passive: role === 'monitor',
          lit: !!focus && (e.from === focus || e.to === focus),
        },
      }
    })
  }, [design, result, blind, selected, readOnly, focus])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let next = design
      let touched = false
      const sel = new Set(selected)
      const drag = { ...dragging }
      const dims: Record<string, { width: number; height: number }> = {}
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions) {
          dims[c.id] = c.dimensions
        } else if (c.type === 'select') {
          if (c.selected) sel.add(c.id)
          else sel.delete(c.id)
        } else if (c.type === 'position' && c.position) {
          if (c.dragging) drag[c.id] = c.position
          else {
            delete drag[c.id]
            const p = c.position
            next = { ...next, nodes: next.nodes.map((n) => (n.id === c.id ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n)) }
            touched = true
          }
        } else if (c.type === 'position' && !c.dragging && drag[c.id]) {
          const p = drag[c.id]
          delete drag[c.id]
          next = { ...next, nodes: next.nodes.map((n) => (n.id === c.id ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n)) }
          touched = true
        } else if (c.type === 'remove') {
          next = removeNodes(next, [c.id])
          sel.delete(c.id)
          touched = true
        }
      }
      if (Object.keys(dims).length) setMeasured((m) => ({ ...m, ...dims }))
      setSelected(sel)
      setDragging(drag)
      if (touched) onChange?.(next)
    },
    [design, onChange, selected, dragging],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const sel = new Set(selected)
      const removed: string[] = []
      for (const c of changes) {
        if (c.type === 'select') {
          if (c.selected) sel.add(c.id)
          else sel.delete(c.id)
        } else if (c.type === 'remove') {
          removed.push(c.id)
          sel.delete(c.id)
        }
      }
      setSelected(sel)
      if (removed.length) onChange?.(removeEdges(design, removed))
    },
    [design, onChange, selected],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) onChange?.(addEdge(design, c.source, c.target))
    },
    [design, onChange],
  )

  const isValidConnection = useCallback(
    (c: Connection | FlowEdgeT) => !!c.source && !!c.target && canConnect(design, c.source, c.target),
    [design],
  )

  const place = useCallback(
    (block: BlockId, at?: { x: number; y: number }) => {
      let pos = at
      if (ghost && ghost.block === block) {
        const near = !at || Math.hypot(at.x - ghost.x, at.y - ghost.y) < SNAP_DIST
        if (near) pos = { x: ghost.x, y: ghost.y }
      }
      if (!pos) {
        const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        pos = { x: center.x - NODE_W / 2 + design.nodes.length * 8, y: center.y - NODE_H / 2 }
        // Step down until the new block doesn't land on top of an existing one.
        const clear = (p: { x: number; y: number }) => !design.nodes.some((n) => Math.abs(n.x - p.x) < NODE_W + 16 && Math.abs(n.y - p.y) < NODE_H + 16)
        for (let i = 0; i < 12 && !clear(pos); i++) pos = { x: pos.x, y: pos.y + NODE_H + 28 }
      }
      onChange?.(addNode(design, block, Math.round(pos.x), Math.round(pos.y)).design)
    },
    [design, ghost, onChange, rf],
  )

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      const block = e.dataTransfer.getData(DRAG_MIME) as BlockId
      if (!block || !BLOCKS[block]) return
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      place(block, { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 })
    },
    [place, rf],
  )

  return (
    <div className={cn('relative h-full w-full', pickMode && 'pick-mode')} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, n) => n.type === 'block' && onNodeClick?.(n.id)}
        onPaneClick={onPaneClick}
        nodesConnectable={!readOnly && !pickMode}
        elementsSelectable={!pickMode}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        connectionRadius={60}
        onInit={(inst) => {
          const pts = [
            ...design.nodes.map((n) => ({ x: n.x, y: n.y })),
            ...fitPoints,
            ...zones.flatMap((z) => [{ x: z.x, y: z.y }, { x: z.x + z.w - NODE_W, y: z.y + z.h - NODE_H }]),
          ]
          if (!pts.length) return
          const xs = pts.map((p) => p.x)
          const ys = pts.map((p) => p.y)
          const minX = Math.min(...xs)
          const minY = Math.min(...ys)
          const bounds = { x: minX, y: minY, width: Math.max(...xs) + NODE_W - minX, height: Math.max(...ys) + NODE_H - minY }
          void inst.fitBounds(bounds, { padding: 0.2 }).then(() => {
            if (inst.getZoom() > 1.1) void inst.zoomTo(1.1)
          })
        }}
        minZoom={0.3}
        maxZoom={1.6}
      >
        {skin === 'factory' ? (
          <Background variant={BackgroundVariant.Lines} gap={48} lineWidth={2} color="var(--grid)" />
        ) : (
          <Background variant={BackgroundVariant.Dots} gap={skin === 'pixel' ? 20 : 22} size={skin === 'pixel' ? 2 : 1.6} color="var(--grid)" />
        )}
        <Controls showInteractive={false} position="top-right" />
      </ReactFlow>
      {!readOnly && !pickMode && palette.length > 0 && <PaletteTray palette={palette} onPick={(b) => place(b)} ghostBlock={ghost?.block} at={trayAt} />}
    </div>
  )
}

function PaletteTray({ palette, onPick, ghostBlock, at }: { palette: BlockId[]; onPick: (b: BlockId) => void; ghostBlock?: BlockId; at: 'top' | 'bottom' }) {
  return (
    <div
      className={cn(
        'absolute left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface/95 p-1.5 shadow-card backdrop-blur scrollbar-thin',
        at === 'top' ? 'top-3' : 'bottom-4',
      )}
    >
      {palette.map((b) => (
        <button
          key={b}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, b)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onClick={() => onPick(b)}
          title={`${BLOCKS[b].name}: ${BLOCKS[b].tagline}`}
          className={`flex shrink-0 cursor-grab items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition hover:bg-surface-2 active:cursor-grabbing ${
            ghostBlock === b ? 'pulse-ring bg-accent-soft text-accent' : ''
          }`}
        >
          <BlockIcon block={b} size={28} />
          {BLOCKS[b].short}
        </button>
      ))}
    </div>
  )
}
