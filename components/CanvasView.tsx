
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Node,
  NodeChange,
  NodeProps,
  Edge,
  EdgeChange,
  Connection,
  ReactFlowInstance,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  NodeResizer
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasElement, CanvasRelation, CanvasScene, CanvasTool } from '../types';
import { generateId, useStore } from '../store';
import { Icons } from '../constants';

type CanvasNodeData = {
  element: CanvasElement;
};

type ResizeDimensions = {
  width?: number;
  height?: number;
};

type TicketRef = {
  id: string;
  shortId: string;
  title: string;
  parentType: 'CHANNEL' | 'PROJECT';
  parentId: string;
};

const VIEWPORT_COMMIT_MS = 200;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const createDefaultCanvasScene = (): CanvasScene => ({
  version: 2,
  elements: [],
  relations: [],
  viewport: { x: 0, y: 0, zoom: 1 }
});

const makeDefaultElement = (kind: 'EMAIL_CARD' | 'CONTAINER', x: number, y: number, zIndex: number): CanvasElement => ({
  id: generateId(),
  kind,
  x,
  y,
  width: kind === 'CONTAINER' ? 560 : 340,
  height: kind === 'CONTAINER' ? 400 : 200,
  zIndex,
  text: kind === 'CONTAINER' ? 'Email Collection' : 'Email Card',
  style: {
    fill: kind === 'CONTAINER' ? '#f8fafc' : '#ffffff',
    stroke: '#d4d4d8',
    fontSize: 14,
    fontFamily: 'Inter'
  }
});

const getParentMap = (relations: CanvasRelation[]): Map<string, string> => {
  const map = new Map<string, string>();
  relations.forEach(relation => {
    if (relation.type === 'PARENT') map.set(relation.fromId, relation.toId);
  });
  return map;
};

const mapSceneToState = (scene: CanvasScene): {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  ticketLinks: CanvasRelation[];
  viewport: CanvasScene['viewport'];
} => {
  const parentMap = getParentMap(scene.relations);
  const nodes: Node<CanvasNodeData>[] = scene.elements
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(element => ({
      id: element.id,
      type: 'canvasElement',
      position: { x: element.x, y: element.y },
      parentId: parentMap.get(element.id),
      extent: parentMap.has(element.id) ? 'parent' : undefined,
      data: { element },
      style: { width: element.width, height: element.height, zIndex: element.zIndex },
      selectable: true,
      draggable: true
    }));

  const edges: Edge[] = scene.relations
    .filter(relation => relation.type === 'EDGE')
    .map(relation => ({
      id: relation.id,
      source: relation.fromId,
      target: relation.toId,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' }
    }));

  return {
    nodes,
    edges,
    ticketLinks: scene.relations.filter(relation => relation.type === 'TICKET_LINK'),
    viewport: scene.viewport
  };
};

const buildScene = (
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  ticketLinks: CanvasRelation[],
  viewport: CanvasScene['viewport']
): CanvasScene => {
  const elements = nodes.map(node => {
    const style = (node.style as { width?: unknown; height?: unknown; zIndex?: unknown } | undefined);
    const width = toFiniteNumber(node.width) ?? toFiniteNumber(node.measured?.width) ?? toFiniteNumber(style?.width) ?? node.data.element.width;
    const height = toFiniteNumber(node.height) ?? toFiniteNumber(node.measured?.height) ?? toFiniteNumber(style?.height) ?? node.data.element.height;
    const zIndex = toFiniteNumber(style?.zIndex) ?? node.data.element.zIndex;
    return { ...node.data.element, id: node.id, x: node.position.x, y: node.position.y, width, height, zIndex };
  });

  const elementIds = new Set(elements.map(element => element.id));
  const relations: CanvasRelation[] = [];

  nodes.forEach(node => {
    if (node.parentId && elementIds.has(node.parentId)) {
      relations.push({ id: `parent-${node.id}`, type: 'PARENT', fromId: node.id, toId: node.parentId });
    }
  });

  edges.forEach(edge => {
    if (elementIds.has(edge.source) && elementIds.has(edge.target)) {
      relations.push({ id: edge.id, type: 'EDGE', fromId: edge.source, toId: edge.target });
    }
  });

  const seenTicketLinks = new Set<string>();
  ticketLinks.forEach(link => {
    if (!elementIds.has(link.fromId)) return;
    const key = `${link.fromId}:${link.toId}`;
    if (seenTicketLinks.has(key)) return;
    seenTicketLinks.add(key);
    relations.push({ id: link.id, type: 'TICKET_LINK', fromId: link.fromId, toId: link.toId });
  });

  return { version: 2, elements, relations, viewport };
};

const getAbsolutePosition = (nodeId: string, nodeMap: Map<string, Node<CanvasNodeData>>): { x: number; y: number } => {
  const node = nodeMap.get(nodeId);
  if (!node) return { x: 0, y: 0 };
  if (!node.parentId) return { x: node.position.x, y: node.position.y };
  const parent = getAbsolutePosition(node.parentId, nodeMap);
  return { x: parent.x + node.position.x, y: parent.y + node.position.y };
};

type CanvasElementNodeProps = NodeProps<CanvasNodeData> & {
  onResizeLive: (id: string, dimensions: ResizeDimensions) => void;
  onResizeDone: (id: string, dimensions: ResizeDimensions) => void;
};

const CanvasElementNode: React.FC<CanvasElementNodeProps> = ({ id, data, selected, width, height, onResizeLive, onResizeDone }) => {
  const element = data.element;
  const isContainer = element.kind === 'CONTAINER';
  const frameWidth = toFiniteNumber(width) ?? element.width;
  const frameHeight = toFiniteNumber(height) ?? element.height;

  return (
    <div
      className={`h-full w-full rounded-lg border shadow-sm overflow-hidden flex ${selected ? 'ring-2 ring-indigo-400' : ''}`}
      style={{
        width: frameWidth,
        height: frameHeight,
        background: element.style?.fill || '#ffffff',
        borderColor: element.style?.stroke || '#d4d4d8',
        borderStyle: isContainer ? 'dashed' : 'solid'
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineStyle={{ borderColor: '#6366f1' }}
        handleStyle={{ borderColor: '#6366f1' }}
        onResize={(_, params) => onResizeLive(id, params)}
        onResizeEnd={(_, params) => onResizeDone(id, params)}
      />
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8 }} />
      <Handle type="target" position={Position.Bottom} style={{ width: 8, height: 8 }} />
      <Handle type="source" position={Position.Left} style={{ width: 8, height: 8 }} />

      <div className="h-full w-full p-3 flex flex-col min-h-0">
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-2">
          {element.kind.replace('_', ' ')}
        </span>
        <div
          className="text-zinc-800 leading-snug font-medium"
          style={{
            fontSize: element.style?.fontSize || 14,
            fontFamily: element.style?.fontFamily || 'Inter'
          }}
        >
          {element.text || (isContainer ? 'Email Collection' : 'Email Card')}
        </div>
      </div>
    </div>
  );
};

const CanvasWorkspace: React.FC = () => {
  const { campaign, updateCanvasScene } = useStore();

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [tool, setTool] = useState<CanvasTool>('SELECT');
  const [spacePan, setSpacePan] = useState(false);

  const initialScene = campaign?.canvasScene || createDefaultCanvasScene();
  const initialState = mapSceneToState(initialScene);

  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>(initialState.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialState.edges);
  const [ticketLinks, setTicketLinks] = useState<CanvasRelation[]>(initialState.ticketLinks);
  const [viewport, setViewport] = useState(initialState.viewport);

  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [draftLinkedTicketIds, setDraftLinkedTicketIds] = useState<string[]>([]);
  const [clipboardNodes, setClipboardNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const ticketLinksRef = useRef(ticketLinks);
  const viewportRef = useRef(viewport);
  const commitTimerRef = useRef<number | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const historyRef = useRef<CanvasScene[]>([initialScene]);
  const historyIndexRef = useRef(0);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { ticketLinksRef.current = ticketLinks; }, [ticketLinks]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const pushHistory = useCallback((scene: CanvasScene) => {
    const serialized = JSON.stringify(scene);
    const current = historyRef.current[historyIndexRef.current];
    if (current && JSON.stringify(current) === serialized) return;
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(scene);
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setHistoryVersion(value => value + 1);
  }, []);

  const commitScene = useCallback((pushToHistory = true) => {
    const scene = buildScene(nodesRef.current, edgesRef.current, ticketLinksRef.current, viewportRef.current);
    updateCanvasScene(scene);
    if (pushToHistory) pushHistory(scene);
  }, [pushHistory, updateCanvasScene]);

  const scheduleCommit = useCallback((pushToHistory = true) => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => commitScene(pushToHistory), 0);
  }, [commitScene]);

  const scheduleViewportCommit = useCallback(() => {
    if (viewportCommitTimerRef.current !== null) window.clearTimeout(viewportCommitTimerRef.current);
    viewportCommitTimerRef.current = window.setTimeout(() => commitScene(false), VIEWPORT_COMMIT_MS);
  }, [commitScene]);

  const syncNodeDimensions = useCallback((nodeId: string, dimensions: ResizeDimensions) => {
    const nextWidth = toFiniteNumber(dimensions.width);
    const nextHeight = toFiniteNumber(dimensions.height);
    if (nextWidth === undefined && nextHeight === undefined) return;

    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      const width = nextWidth ?? toFiniteNumber(node.width) ?? toFiniteNumber(node.measured?.width) ?? toFiniteNumber((node.style as { width?: unknown } | undefined)?.width) ?? node.data.element.width;
      const height = nextHeight ?? toFiniteNumber(node.height) ?? toFiniteNumber(node.measured?.height) ?? toFiniteNumber((node.style as { height?: unknown } | undefined)?.height) ?? node.data.element.height;
      return {
        ...node,
        width,
        height,
        measured: { ...(node.measured || {}), width, height },
        data: { ...node.data, element: { ...node.data.element, width, height } },
        style: { ...(node.style || {}), width, height }
      };
    }));
  }, []);

  const flushPendingCommits = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (viewportCommitTimerRef.current !== null) {
      window.clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = null;
    }
    commitScene(false);
  }, [commitScene]);

  const applyScene = useCallback((scene: CanvasScene, resetHistory: boolean) => {
    const state = mapSceneToState(scene);
    setNodes(state.nodes);
    setEdges(state.edges);
    setTicketLinks(state.ticketLinks);
    setViewport(state.viewport);

    if (rfInstance) rfInstance.setViewport(state.viewport, { duration: 0 });

    if (resetHistory) {
      historyRef.current = [scene];
      historyIndexRef.current = 0;
      setHistoryVersion(value => value + 1);
    }
  }, [rfInstance]);

  useEffect(() => {
    const scene = campaign?.canvasScene || createDefaultCanvasScene();
    applyScene(scene, true);
  }, [applyScene, campaign?.id]);

  useEffect(() => () => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    if (viewportCommitTimerRef.current !== null) window.clearTimeout(viewportCommitTimerRef.current);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingCommits();
    };
    const handlePageHide = () => flushPendingCommits();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushPendingCommits]);

  const selectedNodes = useMemo(() => nodes.filter(node => node.selected), [nodes]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const selectedEdgeIds = useMemo(() => new Set(edges.filter(edge => edge.selected).map(edge => edge.id)), [edges]);

  const allTickets = useMemo<TicketRef[]>(() => {
    if (!campaign) return [];
    const channelTickets = campaign.channels.flatMap(channel => channel.tickets.map(ticket => ({
      id: ticket.id,
      shortId: ticket.shortId,
      title: ticket.title,
      parentType: 'CHANNEL' as const,
      parentId: channel.id
    })));
    const projectTickets = campaign.projects.flatMap(project => project.tickets.map(ticket => ({
      id: ticket.id,
      shortId: ticket.shortId,
      title: ticket.title,
      parentType: 'PROJECT' as const,
      parentId: project.id
    })));
    return [...channelTickets, ...projectTickets];
  }, [campaign]);

  const ticketById = useMemo(() => new Map(allTickets.map(ticket => [ticket.id, ticket])), [allTickets]);

  const filteredTickets = useMemo(() => {
    const query = linkSearch.trim().toLowerCase();
    if (!query) return allTickets;
    return allTickets.filter(ticket =>
      ticket.shortId.toLowerCase().includes(query) || ticket.title.toLowerCase().includes(query)
    );
  }, [allTickets, linkSearch]);

  const containerOptions = useMemo(() => {
    if (!selectedNode) return [];
    return nodes
      .filter(node => node.data.element.kind === 'CONTAINER' && node.id !== selectedNode.id)
      .map(node => ({ id: node.id, label: node.data.element.text || `Container ${node.id.slice(0, 6)}` }));
  }, [nodes, selectedNode]);

  const selectedTicketIds = useMemo(() => {
    if (!selectedNode) return [];
    return ticketLinks.filter(link => link.fromId === selectedNode.id).map(link => link.toId);
  }, [selectedNode, ticketLinks]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const createElementFromTool = useCallback((kind: 'EMAIL_CARD' | 'CONTAINER', flowX: number, flowY: number) => {
    setNodes(prev => {
      const maxZ = prev.reduce((max, node) => Math.max(max, node.data.element.zIndex), 0);
      const zIndex = kind === 'CONTAINER' ? 0 : maxZ + 1;
      const element = makeDefaultElement(kind, flowX, flowY, zIndex);
      const nextNode: Node<CanvasNodeData> = {
        id: element.id,
        type: 'canvasElement',
        position: { x: element.x, y: element.y },
        data: { element },
        style: { width: element.width, height: element.height, zIndex: element.zIndex },
        selectable: true,
        draggable: true
      };
      return [...prev, nextNode];
    });
    scheduleCommit();
  }, [scheduleCommit]);

  const updateSelectedElement = useCallback((updater: (element: CanvasElement) => CanvasElement) => {
    if (!selectedNode) return;
    setNodes(prev => prev.map(node => {
      if (node.id !== selectedNode.id) return node;
      const nextElement = updater(node.data.element);
      return {
        ...node,
        data: { element: nextElement },
        style: {
          ...(node.style || {}),
          width: nextElement.width,
          height: nextElement.height,
          zIndex: nextElement.zIndex
        }
      };
    }));
    scheduleCommit();
  }, [scheduleCommit, selectedNode]);

  const assignSelectedParent = useCallback((parentId?: string) => {
    if (!selectedNode || selectedNode.data.element.kind === 'CONTAINER') return;
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const absolute = getAbsolutePosition(selectedNode.id, nodeMap);

    setNodes(prev => prev.map(node => {
      if (node.id !== selectedNode.id) return node;

      if (!parentId) {
        return {
          ...node,
          parentId: undefined,
          extent: undefined,
          position: absolute,
          data: { element: { ...node.data.element, x: absolute.x, y: absolute.y } }
        };
      }

      const parentAbsolute = getAbsolutePosition(parentId, nodeMap);
      const relative = { x: absolute.x - parentAbsolute.x, y: absolute.y - parentAbsolute.y };
      return {
        ...node,
        parentId,
        extent: 'parent',
        position: relative,
        data: { element: { ...node.data.element, x: relative.x, y: relative.y } }
      };
    }));
    scheduleCommit();
  }, [nodes, scheduleCommit, selectedNode]);

  const removeSelection = useCallback(() => {
    const selectedIds = new Set(selectedNodes.map(node => node.id));
    if (selectedIds.size === 0 && selectedEdgeIds.size === 0) return;

    setNodes(prev => prev
      .filter(node => !selectedIds.has(node.id))
      .map(node => {
        if (!node.parentId || !selectedIds.has(node.parentId)) return node;
        return { ...node, parentId: undefined, extent: undefined };
      })
    );

    setEdges(prev => prev.filter(edge =>
      !selectedIds.has(edge.source) &&
      !selectedIds.has(edge.target) &&
      !selectedEdgeIds.has(edge.id)
    ));

    setTicketLinks(prev => prev.filter(link => !selectedIds.has(link.fromId)));
    scheduleCommit();
  }, [scheduleCommit, selectedEdgeIds, selectedNodes]);

  const duplicateSelection = useCallback((sourceNodes: Node<CanvasNodeData>[]) => {
    if (sourceNodes.length === 0) return;
    const selectedIds = new Set(sourceNodes.map(node => node.id));
    const idMap = new Map<string, string>();
    sourceNodes.forEach(node => idMap.set(node.id, generateId()));

    setNodes(prev => {
      const cleared = prev.map(node => ({ ...node, selected: false }));
      const clones = sourceNodes.map(node => {
        const nextId = idMap.get(node.id) || generateId();
        const clonedParentId = node.parentId && selectedIds.has(node.parentId)
          ? idMap.get(node.parentId)
          : node.parentId;
        const clonedElement: CanvasElement = {
          ...node.data.element,
          id: nextId,
          x: node.position.x + 40,
          y: node.position.y + 40,
          zIndex: node.data.element.zIndex + 1
        };

        return {
          ...node,
          id: nextId,
          parentId: clonedParentId,
          extent: clonedParentId ? 'parent' : undefined,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: { element: clonedElement },
          style: { ...(node.style || {}), zIndex: clonedElement.zIndex },
          selected: true
        } as Node<CanvasNodeData>;
      });

      return [...cleared, ...clones];
    });

    setTicketLinks(prev => {
      const copied = prev
        .filter(link => selectedIds.has(link.fromId))
        .map(link => ({ ...link, id: generateId(), fromId: idMap.get(link.fromId) || link.fromId }));
      return [...prev, ...copied];
    });

    scheduleCommit();
  }, [scheduleCommit]);

  const openLinkPanel = useCallback(() => {
    if (!selectedNode) return;
    setDraftLinkedTicketIds(selectedTicketIds);
    setLinkSearch('');
    setLinkPanelOpen(true);
  }, [selectedNode, selectedTicketIds]);

  const saveTicketLinks = useCallback(() => {
    if (!selectedNode) return;
    setTicketLinks(prev => {
      const withoutSelected = prev.filter(link => !(link.type === 'TICKET_LINK' && link.fromId === selectedNode.id));
      const next = draftLinkedTicketIds.map(ticketId => ({
        id: generateId(),
        type: 'TICKET_LINK' as const,
        fromId: selectedNode.id,
        toId: ticketId
      }));
      return [...withoutSelected, ...next];
    });
    setLinkPanelOpen(false);
    scheduleCommit();
  }, [draftLinkedTicketIds, scheduleCommit, selectedNode]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const scene = historyRef.current[historyIndexRef.current];
    applyScene(scene, false);
    updateCanvasScene(scene);
    setHistoryVersion(value => value + 1);
  }, [applyScene, updateCanvasScene]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const scene = historyRef.current[historyIndexRef.current];
    applyScene(scene, false);
    updateCanvasScene(scene);
    setHistoryVersion(value => value + 1);
  }, [applyScene, updateCanvasScene]);

  const onNodesChange = useCallback((changes: NodeChange<Node<CanvasNodeData>>[]) => {
    setNodes(prev => {
      const changedDimensions = new Map<string, ResizeDimensions>();
      changes.forEach(change => {
        if (change.type !== 'dimensions') return;
        const dimensions = (change as { id: string; dimensions?: ResizeDimensions }).dimensions;
        if (!dimensions) return;
        changedDimensions.set(change.id, dimensions);
      });

      const next = applyNodeChanges(changes, prev);
      if (changedDimensions.size === 0) return next;

      return next.map(node => {
        const dimensions = changedDimensions.get(node.id);
        if (!dimensions) return node;
        const width = toFiniteNumber(dimensions.width) ?? toFiniteNumber(node.width) ?? toFiniteNumber(node.measured?.width) ?? toFiniteNumber((node.style as { width?: unknown } | undefined)?.width) ?? node.data.element.width;
        const height = toFiniteNumber(dimensions.height) ?? toFiniteNumber(node.height) ?? toFiniteNumber(node.measured?.height) ?? toFiniteNumber((node.style as { height?: unknown } | undefined)?.height) ?? node.data.element.height;
        return {
          ...node,
          width,
          height,
          measured: { ...(node.measured || {}), width, height },
          data: { ...node.data, element: { ...node.data.element, width, height } },
          style: { ...(node.style || {}), width, height }
        };
      });
    });

    const shouldCommit = changes.some(change => {
      if (change.type === 'remove') return true;
      if (change.type === 'position') return (change as { dragging?: boolean }).dragging === false;
      if (change.type === 'dimensions') return (change as { resizing?: boolean }).resizing === false;
      return false;
    });
    if (shouldCommit) scheduleCommit();
  }, [scheduleCommit]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges(prev => applyEdgeChanges(changes, prev));
    if (changes.some(change => change.type === 'remove')) scheduleCommit();
  }, [scheduleCommit]);

  const onConnect = useCallback((connection: Connection) => {
    const withId = {
      ...connection,
      id: generateId(),
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' as const }
    };
    setEdges(prev => addEdge(withId, prev));
    scheduleCommit();
  }, [scheduleCommit]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (tool !== 'EMAIL_CARD' && tool !== 'CONTAINER') return;
    const pos = rfInstance ? rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) : { x: 80, y: 80 };
    createElementFromTool(tool, pos.x, pos.y);
  }, [createElementFromTool, rfInstance, tool]);

  const nodeTypes = useMemo(() => ({
    canvasElement: (props: NodeProps<CanvasNodeData>) => (
      <CanvasElementNode
        {...props}
        onResizeLive={(nodeId, dimensions) => syncNodeDimensions(nodeId, dimensions)}
        onResizeDone={(nodeId, dimensions) => {
          syncNodeDimensions(nodeId, dimensions);
          scheduleCommit();
        }}
      />
    )
  }), [scheduleCommit, syncNodeDimensions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.code === 'Space') setSpacePan(true);

      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelection(selectedNodes);
        return;
      }

      if (isMeta && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setClipboardNodes(selectedNodes);
        return;
      }

      if (isMeta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        duplicateSelection(clipboardNodes);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelection();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePan(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [clipboardNodes, duplicateSelection, redo, removeSelection, selectedNodes, undo]);

  if (!campaign) {
    return (
      <div className="h-full flex items-center justify-center bg-white border border-zinc-100 rounded-xl">
        <p className="text-sm text-zinc-500">Initialize a campaign to use the canvas.</p>
      </div>
    );
  }

  const selectedElement = selectedNode?.data.element;

  return (
    <div className="h-full w-full bg-zinc-50 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onInit={setRfInstance}
        onMoveEnd={(_, nextViewport) => {
          setViewport(nextViewport);
          scheduleViewportCommit();
        }}
        defaultViewport={viewport}
        panOnDrag={tool === 'HAND' || spacePan}
        nodesDraggable={tool === 'SELECT' && !spacePan}
        selectionOnDrag={tool === 'SELECT' && !spacePan}
        fitView={false}
        minZoom={0.2}
        maxZoom={3}
      >
        <Background gap={24} color="#e4e4e7" />
      </ReactFlow>

      {selectedElement && (
        <div className="absolute top-4 right-4 z-20 w-[300px] bg-white border border-zinc-200 rounded-xl shadow-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">Selection</span>
            <button onClick={removeSelection} className="text-xs text-red-600 hover:text-red-700">Delete</button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Text</label>
            <textarea
              value={selectedElement.text || ''}
              rows={3}
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-800"
              onChange={event => updateSelectedElement(element => ({ ...element, text: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Width</label>
              <input
                type="number"
                value={selectedElement.width}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                onChange={event => updateSelectedElement(element => ({ ...element, width: Math.max(120, Number(event.target.value) || 120) }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Height</label>
              <input
                type="number"
                value={selectedElement.height}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                onChange={event => updateSelectedElement(element => ({ ...element, height: Math.max(80, Number(event.target.value) || 80) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateSelectedElement(element => ({ ...element, zIndex: Math.max(0, element.zIndex - 1) }))}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Back
            </button>
            <button
              onClick={() => updateSelectedElement(element => ({ ...element, zIndex: element.zIndex + 1 }))}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Front
            </button>
          </div>

          {selectedElement.kind !== 'CONTAINER' && (
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Container</label>
              <select
                value={selectedNode?.parentId || ''}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                onChange={event => assignSelectedParent(event.target.value || undefined)}
              >
                <option value="">No container</option>
                {containerOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-zinc-100 pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ticket Links</span>
              <button onClick={openLinkPanel} className="text-xs text-indigo-600 hover:text-indigo-700">Manage</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedTicketIds.length === 0 && <span className="text-xs text-zinc-400">No links</span>}
              {selectedTicketIds.map(ticketId => {
                const ticket = ticketById.get(ticketId);
                return (
                  <span key={ticketId} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px]">
                    {ticket ? ticket.shortId : ticketId.slice(0, 8)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white border border-zinc-200 rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-1">
        <button onClick={() => setTool('SELECT')} className={`px-2 py-1.5 rounded ${tool === 'SELECT' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Select">
          <Icons.MousePointer className="w-4 h-4" />
        </button>
        <button onClick={() => setTool('HAND')} className={`px-2 py-1.5 rounded ${tool === 'HAND' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Hand">
          <Icons.Layers className="w-4 h-4" />
        </button>
        <button onClick={() => setTool('EMAIL_CARD')} className={`px-2 py-1.5 rounded ${tool === 'EMAIL_CARD' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Email Card">
          <Icons.FileText className="w-4 h-4" />
        </button>
        <button onClick={() => setTool('CONTAINER')} className={`px-2 py-1.5 rounded ${tool === 'CONTAINER' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Container">
          <Icons.Layout className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-zinc-200 mx-1" />

        <button onClick={undo} disabled={!canUndo} className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40" title="Undo">U</button>
        <button onClick={redo} disabled={!canRedo} className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40" title="Redo">R</button>
        <button onClick={() => rfInstance?.zoomIn({ duration: 120 })} className="px-2 py-1.5 rounded text-zinc-600 hover:bg-zinc-100" title="Zoom In">
          <Icons.Plus className="w-4 h-4" />
        </button>
        <button onClick={() => rfInstance?.zoomOut({ duration: 120 })} className="px-2 py-1.5 rounded text-zinc-600 hover:bg-zinc-100" title="Zoom Out">
          <Icons.Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            rfInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 120 });
            setViewport({ x: 0, y: 0, zoom: 1 });
            scheduleViewportCommit();
          }}
          className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          title="Reset View"
        >
          100%
        </button>

        <div className="w-px h-6 bg-zinc-200 mx-1" />
        <button onClick={removeSelection} className="px-2 py-1.5 rounded text-red-600 hover:bg-red-50" title="Delete">
          <Icons.Trash className="w-4 h-4" />
        </button>
      </div>

      {linkPanelOpen && selectedNode && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setLinkPanelOpen(false)} />
          <div className="relative z-10 w-[520px] max-h-[70vh] bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900">Link Selected Element to Tickets</h3>
              <button onClick={() => setLinkPanelOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <Icons.XCircle className="w-4 h-4" />
              </button>
            </div>

            <input
              autoFocus
              value={linkSearch}
              placeholder="Search tickets..."
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm mb-3"
              onChange={event => setLinkSearch(event.target.value)}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar border border-zinc-100 rounded-lg">
              {filteredTickets.map(ticket => {
                const checked = draftLinkedTicketIds.includes(ticket.id);
                return (
                  <label key={ticket.id} className="flex items-center gap-3 px-3 py-2 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => {
                        setDraftLinkedTicketIds(prev => {
                          if (event.target.checked) return [...prev, ticket.id];
                          return prev.filter(id => id !== ticket.id);
                        });
                      }}
                    />
                    <span className="text-xs font-mono text-zinc-400">{ticket.shortId}</span>
                    <span className="text-sm text-zinc-700 flex-1 truncate">{ticket.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">{ticket.parentType}</span>
                  </label>
                );
              })}

              {filteredTickets.length === 0 && (
                <div className="p-4 text-sm text-zinc-400 text-center">No matching tickets.</div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setLinkPanelOpen(false)} className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-800">Cancel</button>
              <button onClick={saveTicketLinks} className="px-4 py-1.5 rounded bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800">Save Links</button>
            </div>
          </div>
        </div>
      )}

      <span className="sr-only">history:{historyVersion}</span>
    </div>
  );
};

export const CanvasView: React.FC = () => (
  <ReactFlowProvider>
    <CanvasWorkspace />
  </ReactFlowProvider>
);
