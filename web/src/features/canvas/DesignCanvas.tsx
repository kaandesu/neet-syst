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
import { BlockIcon } from '@/ui/BlockIcon'
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
}

export function DesignCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function CanvasInner({ design, onChange, result, blind, palette = [], ghost, highlight = [], zones = [], readOnly, fitPoints = [] }: CanvasProps) {
  const rf = useReactFlow()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<Record<string, { x: number; y: number }>>({})
  // Controlled React Flow needs measured sizes fed back, or handles never register.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})

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
          status: r?.status,
          utilization: r?.utilization,
          unlimited: (r?.capacity ?? 0) >= 1e9,
          inRps: r?.inRps,
          backlog: r?.backlog,
          blind,
          highlight: highlight.some((h) => matches(n.block, h)),
        },
        selected: selected.has(n.id),
        deletable: !n.locked && !readOnly,
        draggable: !readOnly,
        measured: measured[n.id],
      }
    })
    return [...zoneNodes, ...ghostNodes, ...blockNodes]
  }, [design, result, blind, ghost, highlight, zones, selected, dragging, readOnly, measured])

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
        },
      }
    })
  }, [design, result, blind, selected, readOnly])

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
    <div className="relative h-full w-full" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodesConnectable={!readOnly}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        connectionRadius={36}
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
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="var(--grid)" />
        <Controls showInteractive={false} position="top-right" />
      </ReactFlow>
      {!readOnly && palette.length > 0 && <PaletteTray palette={palette} onPick={(b) => place(b)} ghostBlock={ghost?.block} />}
    </div>
  )
}

function PaletteTray({ palette, onPick, ghostBlock }: { palette: BlockId[]; onPick: (b: BlockId) => void; ghostBlock?: BlockId }) {
  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface/95 p-1.5 shadow-card backdrop-blur scrollbar-thin">
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
