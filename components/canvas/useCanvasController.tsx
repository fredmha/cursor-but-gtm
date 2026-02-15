import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  ReactFlowInstance
} from '@xyflow/react';
import { CanvasElement, CanvasElementKind, CanvasEmailBlock, CanvasEmailTemplate, CanvasRelation, CanvasScene, CanvasStrokePoint, CanvasTool, EmailBlockType } from '../../types';
import { generateId, useStore } from '../../store';
import { CanvasElementNode } from './CanvasElementNode';
import { canAssignParentForKind, getCanvasKindLabel, getElementKindForTool } from './canvas-element-catalog';
import {
  BlockResizeState,
  buildScene,
  CanvasNodeData,
  clampNumber,
  clearScheduledTimer,
  createDefaultCanvasScene,
  createEmailBlock,
  deriveEmailCardLabel,
  EMAIL_BLOCK_MAX_FONT_SIZE,
  EMAIL_BLOCK_MAX_HEIGHT,
  EMAIL_BLOCK_MAX_MARGIN_BOTTOM,
  EMAIL_BLOCK_MAX_PADDING,
  EMAIL_BLOCK_MIN_FONT_SIZE,
  EMAIL_BLOCK_MIN_HEIGHT,
  EMAIL_BLOCK_TYPES,
  ensureEmailTemplate,
  getAbsolutePosition,
  makeDefaultElement,
  mapSceneToState,
  pickDropContainerForNode,
  moveBlockById,
  normalizeEmailBlockOrder,
  normalizeBlockMetrics,
  pushSceneHistory,
  ResizeDimensions,
  resetSceneHistory,
  TicketRef,
  toAbsolutePosition,
  toFiniteNumber,
  toParentRelativePosition,
  VIEWPORT_COMMIT_MS
} from './canvas-core';
import { appendFreehandPoint, createFreehandDraft, finalizeFreehandElement, FreehandDraft } from './canvas-freehand';

export type ContainerOption = {
  id: string;
  label: string;
};

/**
 * Collects node ids that finished a drag operation in this ReactFlow change batch.
 * Inputs: batched node changes emitted by ReactFlow.
 * Output: set of node ids whose dragging flag transitioned to false.
 * Invariant: only position changes can mark drag-end membership reconciliation candidates.
 */
const getDroppedNodeIds = (changes: NodeChange<Node<CanvasNodeData>>[]): Set<string> => {
  const droppedNodeIds = new Set<string>();

  changes.forEach(change => {
    if (change.type !== 'position') return;
    const isDragEnd = (change as { dragging?: boolean }).dragging === false;
    if (isDragEnd) droppedNodeIds.add(change.id);
  });

  return droppedNodeIds;
};

/**
 * Canvas controller hook.
 * Inputs: none (reads store internally).
 * Output: full canvas state + commands for orchestration components.
 * Invariant: preserves existing scene behavior and store commit semantics.
 */
export const useCanvasController = () => {
  const { campaign, updateCanvasScene } = useStore();

  // Local runtime state
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
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<BlockResizeState | null>(null);
  const [freehandDraft, setFreehandDraft] = useState<FreehandDraft | null>(null);

  // Refs for commit/historical state
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const ticketLinksRef = useRef(ticketLinks);
  const viewportRef = useRef(viewport);
  const freehandDraftRef = useRef<FreehandDraft | null>(freehandDraft);
  const commitTimerRef = useRef<number | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const historyRef = useRef<CanvasScene[]>([initialScene]);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    ticketLinksRef.current = ticketLinks;
  }, [ticketLinks]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    freehandDraftRef.current = freehandDraft;
  }, [freehandDraft]);

  // Commit helpers
  const bumpHistoryVersion = useCallback(() => {
    setHistoryVersion(value => value + 1);
  }, []);

  const commitScene = useCallback((pushToHistory = true) => {
    const nextScene = buildScene(nodesRef.current, edgesRef.current, ticketLinksRef.current, viewportRef.current);
    updateCanvasScene(nextScene);

    if (pushToHistory) {
      pushSceneHistory(nextScene, historyRef, historyIndexRef, bumpHistoryVersion);
    }
  }, [bumpHistoryVersion, updateCanvasScene]);

  const scheduleCommit = useCallback((pushToHistory = true) => {
    clearScheduledTimer(commitTimerRef);
    commitTimerRef.current = window.setTimeout(() => commitScene(pushToHistory), 0);
  }, [commitScene]);

  const scheduleViewportCommit = useCallback(() => {
    clearScheduledTimer(viewportCommitTimerRef);
    viewportCommitTimerRef.current = window.setTimeout(() => commitScene(false), VIEWPORT_COMMIT_MS);
  }, [commitScene]);

  const syncNodeDimensions = useCallback((nodeId: string, dimensions: ResizeDimensions) => {
    const nextWidth = toFiniteNumber(dimensions.width);
    const nextHeight = toFiniteNumber(dimensions.height);
    if (nextWidth === undefined && nextHeight === undefined) return;

    setNodes(previousNodes => previousNodes.map(node => {
      if (node.id !== nodeId) return node;

      const width = nextWidth
        ?? toFiniteNumber(node.width)
        ?? toFiniteNumber(node.measured?.width)
        ?? toFiniteNumber((node.style as { width?: unknown } | undefined)?.width)
        ?? node.data.element.width;

      const height = nextHeight
        ?? toFiniteNumber(node.height)
        ?? toFiniteNumber(node.measured?.height)
        ?? toFiniteNumber((node.style as { height?: unknown } | undefined)?.height)
        ?? node.data.element.height;

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
    clearScheduledTimer(commitTimerRef);
    clearScheduledTimer(viewportCommitTimerRef);
    commitScene(false);
  }, [commitScene]);

  const applyScene = useCallback((nextScene: CanvasScene, resetHistory: boolean) => {
    const nextState = mapSceneToState(nextScene);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setTicketLinks(nextState.ticketLinks);
    setViewport(nextState.viewport);

    if (rfInstance) {
      rfInstance.setViewport(nextState.viewport, { duration: 0 });
    }

    if (resetHistory) {
      resetSceneHistory(nextScene, historyRef, historyIndexRef, bumpHistoryVersion);
    }
  }, [bumpHistoryVersion, rfInstance]);

  useEffect(() => {
    const nextScene = campaign?.canvasScene || createDefaultCanvasScene();
    applyScene(nextScene, true);
  }, [applyScene, campaign?.id]);

  useEffect(() => () => {
    clearScheduledTimer(commitTimerRef);
    clearScheduledTimer(viewportCommitTimerRef);
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

  // Derived selection state
  const selectedNodes = useMemo(() => nodes.filter(node => node.selected), [nodes]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const selectedEdgeIds = useMemo(() => new Set(edges.filter(edge => edge.selected).map(edge => edge.id)), [edges]);

  useEffect(() => {
    if (!selectedNode || selectedNode.data.element.kind !== 'EMAIL_CARD') {
      setEditingCardId(null);
      setActiveBlockId(null);
      setResizeState(null);
      return;
    }

    setEditingCardId(selectedNode.id);
    const blocks = selectedNode.data.element.emailTemplate?.blocks || [];

    if (blocks.length === 0) {
      setActiveBlockId(null);
      return;
    }

    setActiveBlockId(previousBlockId => (previousBlockId && blocks.some(block => block.id === previousBlockId)) ? previousBlockId : blocks[0].id);
  }, [selectedNode]);

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

  const containerOptions = useMemo<ContainerOption[]>(() => {
    if (!selectedNode) return [];
    return nodes
      .filter(node => node.data.element.kind === 'CONTAINER' && node.id !== selectedNode.id)
      .map(node => ({ id: node.id, label: node.data.element.text || `${getCanvasKindLabel('CONTAINER')} ${node.id.slice(0, 6)}` }));
  }, [nodes, selectedNode]);

  const linkedTicketIdsForSelection = useMemo(() => {
    if (!selectedNode) return [];
    return ticketLinks.filter(link => link.fromId === selectedNode.id).map(link => link.toId);
  }, [selectedNode, ticketLinks]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  const canGroupSelection = selectedNodes.length > 1;

  // Commands
  /**
   * Computes the next front-most z-index for a new element.
   * This keeps newly created primitives discoverable without rewriting historical z-order.
   * Tradeoff: z-index values are monotonic and can grow over long editing sessions.
   */
  const getNextZIndex = useCallback((sourceNodes: Node<CanvasNodeData>[]): number => (
    sourceNodes.reduce((maxValue, node) => Math.max(maxValue, node.data.element.zIndex), 0) + 1
  ), []);

  /**
   * Converts a persisted canvas element into a ReactFlow node payload.
   * This keeps node construction consistent across click-create, freehand finalize, and grouping flows.
   * Tradeoff: every caller must supply fully normalized element data before conversion.
   */
  const createNodeFromElement = useCallback((element: CanvasElement): Node<CanvasNodeData> => ({
    id: element.id,
    type: 'canvasElement',
    position: { x: element.x, y: element.y },
    data: { element },
    style: { width: element.width, height: element.height, zIndex: element.zIndex },
    selectable: true,
    draggable: true
  }), []);

  /**
   * Translates screen-space coordinates into flow-space coordinates.
   * This centralizes pointer conversion so all creation tools use identical positioning semantics.
   * Tradeoff: before rfInstance initialization, a fixed fallback point is used.
   */
  const toFlowPoint = useCallback((clientX: number, clientY: number): CanvasStrokePoint => {
    if (!rfInstance) return { x: 80, y: 80 };
    return rfInstance.screenToFlowPosition({ x: clientX, y: clientY });
  }, [rfInstance]);

  /**
   * Creates one element from the active non-selection tool at a flow coordinate.
   * It preserves container-on-back semantics while placing regular primitives on top.
   * Tradeoff: containers always start at z-index 0 and may need manual z-order adjustment.
   */
  const createElementFromTool = useCallback((kind: CanvasElementKind, flowX: number, flowY: number) => {
    setNodes(previousNodes => {
      const zIndex = kind === 'CONTAINER' ? 0 : getNextZIndex(previousNodes);
      const element = makeDefaultElement(kind, flowX, flowY, zIndex, generateId);
      const clearedSelectionNodes = previousNodes.map(node => (
        node.selected ? { ...node, selected: false } : node
      ));
      const createdNode = { ...createNodeFromElement(element), selected: true };
      return [...clearedSelectionNodes, createdNode];
    });

    setEdges(previousEdges => previousEdges.map(edge => (
      edge.selected ? { ...edge, selected: false } : edge
    )));

    scheduleCommit();
  }, [createNodeFromElement, getNextZIndex, scheduleCommit]);

  /**
   * Reconciles parent container membership for nodes that were just dropped.
   * This enables drag-in grouping and drag-out ungrouping without rigid parent bounds.
   * Tradeoff: membership resolves on drag-end, not continuously during hover.
   */
  const reconcileContainerMembershipAfterDrop = useCallback((
    sourceNodes: Node<CanvasNodeData>[],
    droppedNodeIds: Set<string>
  ): Node<CanvasNodeData>[] => {
    if (droppedNodeIds.size === 0) return sourceNodes;

    const nodeById = new Map<string, Node<CanvasNodeData>>(
      sourceNodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>])
    );

    return sourceNodes.map(node => {
      if (!droppedNodeIds.has(node.id)) return node;
      if (!canAssignParentForKind(node.data.element.kind)) return node;

      const absolutePosition = toAbsolutePosition(node.id, nodeById);
      const targetContainer = pickDropContainerForNode(node, sourceNodes, nodeById);
      const targetParentId = targetContainer?.id;

      if (targetParentId === node.parentId) return node;

      if (!targetParentId) {
        return {
          ...node,
          parentId: undefined,
          position: absolutePosition,
          data: {
            ...node.data,
            element: {
              ...node.data.element,
              x: absolutePosition.x,
              y: absolutePosition.y
            }
          }
        };
      }

      const relativePosition = toParentRelativePosition(absolutePosition, targetParentId, nodeById);
      return {
        ...node,
        parentId: targetParentId,
        position: relativePosition,
        data: {
          ...node.data,
          element: {
            ...node.data.element,
            x: relativePosition.x,
            y: relativePosition.y
          }
        }
      };
    });
  }, []);

  /**
   * Wraps the current multi-selection into a new container to form a component group.
   * Absolute coordinates are preserved so grouping is non-destructive to existing layout.
   * Tradeoff: nested container grouping is intentionally limited to avoid complex parent graphs.
   */
  const groupSelectionIntoContainer = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const nodeById = new Map<string, Node<CanvasNodeData>>(
      nodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>])
    );
    const absoluteSelection = selectedNodes.map(node => ({
      node,
      absolute: getAbsolutePosition(node.id, nodeById)
    }));

    const minX = Math.min(...absoluteSelection.map(entry => entry.absolute.x));
    const minY = Math.min(...absoluteSelection.map(entry => entry.absolute.y));
    const maxX = Math.max(...absoluteSelection.map(entry => entry.absolute.x + entry.node.data.element.width));
    const maxY = Math.max(...absoluteSelection.map(entry => entry.absolute.y + entry.node.data.element.height));

    const containerPadding = 40;
    const containerElement = makeDefaultElement('CONTAINER', minX - containerPadding, minY - containerPadding, 0, generateId);
    containerElement.width = Math.max(containerElement.width, maxX - minX + containerPadding * 2);
    containerElement.height = Math.max(containerElement.height, maxY - minY + containerPadding * 2);
    containerElement.text = 'Component Group';

    const selectedIds = new Set(selectedNodes.map(node => node.id));
    setNodes(previousNodes => {
      const nextNodes = previousNodes.map(node => {
        if (!selectedIds.has(node.id)) return node;

        const absolute = getAbsolutePosition(node.id, nodeById);
        const relative = {
          x: absolute.x - containerElement.x,
          y: absolute.y - containerElement.y
        };

        return {
          ...node,
          selected: false,
          parentId: containerElement.id,
          position: relative,
          data: {
            ...node.data,
            element: {
              ...node.data.element,
              x: relative.x,
              y: relative.y
            }
          }
        };
      });

      return [...nextNodes, { ...createNodeFromElement(containerElement), selected: true }];
    });

    scheduleCommit();
  }, [createNodeFromElement, nodes, scheduleCommit, selectedNodes]);

  const updateSelectedElement = useCallback((updater: (element: CanvasElement) => CanvasElement) => {
    if (!selectedNode) return;

    setNodes(previousNodes => previousNodes.map(node => {
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

  const updateSelectedEmailTemplate = useCallback((updater: (template: CanvasEmailTemplate) => CanvasEmailTemplate) => {
    updateSelectedElement(element => {
      if (element.kind !== 'EMAIL_CARD') return element;

      const baseTemplate = ensureEmailTemplate(element.emailTemplate);
      const nextTemplate = updater(baseTemplate);
      const normalizedTemplate: CanvasEmailTemplate = {
        ...nextTemplate,
        blocks: normalizeEmailBlockOrder(nextTemplate.blocks)
      };
      const nextLabel = deriveEmailCardLabel(normalizedTemplate);

      return {
        ...element,
        emailTemplate: normalizedTemplate,
        text: nextLabel
      };
    });
  }, [updateSelectedElement]);

  const addEmailBlock = useCallback((type: EmailBlockType) => {
    updateSelectedEmailTemplate(template => ({
      ...template,
      blocks: [...template.blocks, createEmailBlock(type, generateId, template.blocks.length)]
    }));
  }, [updateSelectedEmailTemplate]);

  const updateEmailBlock = useCallback((blockId: string, updater: (block: CanvasEmailBlock) => CanvasEmailBlock) => {
    updateSelectedEmailTemplate(template => ({
      ...template,
      blocks: template.blocks.map(block => (block.id === blockId ? updater(block) : block))
    }));
  }, [updateSelectedEmailTemplate]);

  const deleteEmailBlock = useCallback((blockId: string) => {
    updateSelectedEmailTemplate(template => ({
      ...template,
      blocks: template.blocks.filter(block => block.id !== blockId)
    }));
  }, [updateSelectedEmailTemplate]);

  const handleEmailBlockUpload = useCallback((blockId: string, file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      updateEmailBlock(blockId, block => ({ ...block, imageUrl: result }));
    };

    reader.readAsDataURL(file);
  }, [updateEmailBlock]);

  const assignSelectedParent = useCallback((parentId?: string) => {
    if (!selectedNode || !canAssignParentForKind(selectedNode.data.element.kind)) return;

    const nodeMap = new Map<string, Node<CanvasNodeData>>(
      nodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>])
    );

    const absolute = getAbsolutePosition(selectedNode.id, nodeMap);

    setNodes(previousNodes => previousNodes.map(node => {
      if (node.id !== selectedNode.id) return node;

      // Keep absolute coordinates when removing parent relation.
      if (!parentId) {
        return {
          ...node,
          parentId: undefined,
          position: absolute,
          data: { element: { ...node.data.element, x: absolute.x, y: absolute.y } }
        };
      }

      // Convert absolute coordinates into parent-relative local space.
      const relative = toParentRelativePosition(absolute, parentId, nodeMap);
      return {
        ...node,
        parentId,
        position: relative,
        data: { element: { ...node.data.element, x: relative.x, y: relative.y } }
      };
    }));

    scheduleCommit();
  }, [nodes, scheduleCommit, selectedNode]);

  const removeSelection = useCallback(() => {
    const selectedIds = new Set(selectedNodes.map(node => node.id));
    if (selectedIds.size === 0 && selectedEdgeIds.size === 0) return;

    setNodes(previousNodes => {
      const nodeById = new Map<string, Node<CanvasNodeData>>(
        previousNodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>])
      );

      return previousNodes
        .filter(node => !selectedIds.has(node.id))
        .map(node => {
          if (!node.parentId || !selectedIds.has(node.parentId)) return node;
          const absolutePosition = toAbsolutePosition(node.id, nodeById);
          return {
            ...node,
            parentId: undefined,
            position: absolutePosition,
            data: {
              ...node.data,
              element: {
                ...node.data.element,
                x: absolutePosition.x,
                y: absolutePosition.y
              }
            }
          };
        });
    });

    setEdges(previousEdges => previousEdges.filter(edge =>
      !selectedIds.has(edge.source)
      && !selectedIds.has(edge.target)
      && !selectedEdgeIds.has(edge.id)
    ));

    setTicketLinks(previousLinks => previousLinks.filter(link => !selectedIds.has(link.fromId)));
    scheduleCommit();
  }, [scheduleCommit, selectedEdgeIds, selectedNodes]);

  const duplicateSelection = useCallback((sourceNodes: Node<CanvasNodeData>[]) => {
    if (sourceNodes.length === 0) return;

    const selectedIds = new Set(sourceNodes.map(node => node.id));
    const idMap = new Map<string, string>();
    sourceNodes.forEach(node => idMap.set(node.id, generateId()));

    setNodes(previousNodes => {
      const cleared = previousNodes.map(node => ({ ...node, selected: false }));

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
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: { element: clonedElement },
          style: { ...(node.style || {}), zIndex: clonedElement.zIndex },
          selected: true
        } as Node<CanvasNodeData>;
      });

      return [...cleared, ...clones];
    });

    setTicketLinks(previousLinks => {
      const copiedLinks = previousLinks
        .filter(link => selectedIds.has(link.fromId))
        .map(link => ({ ...link, id: generateId(), fromId: idMap.get(link.fromId) || link.fromId }));
      return [...previousLinks, ...copiedLinks];
    });

    scheduleCommit();
  }, [scheduleCommit]);

  const openLinkPanel = useCallback(() => {
    if (!selectedNode) return;
    setDraftLinkedTicketIds(linkedTicketIdsForSelection);
    setLinkSearch('');
    setLinkPanelOpen(true);
  }, [linkedTicketIdsForSelection, selectedNode]);

  const saveTicketLinks = useCallback(() => {
    if (!selectedNode) return;

    setTicketLinks(previousLinks => {
      const withoutSelected = previousLinks.filter(link => !(link.type === 'TICKET_LINK' && link.fromId === selectedNode.id));
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
    const nextScene = historyRef.current[historyIndexRef.current];
    applyScene(nextScene, false);
    updateCanvasScene(nextScene);
    setHistoryVersion(value => value + 1);
  }, [applyScene, updateCanvasScene]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    historyIndexRef.current += 1;
    const nextScene = historyRef.current[historyIndexRef.current];
    applyScene(nextScene, false);
    updateCanvasScene(nextScene);
    setHistoryVersion(value => value + 1);
  }, [applyScene, updateCanvasScene]);

  // ReactFlow event handlers
  const onNodesChange = useCallback((changes: NodeChange<Node<CanvasNodeData>>[]) => {
    const droppedNodeIds = getDroppedNodeIds(changes);

    setNodes(previousNodes => {
      const changedDimensions = new Map<string, ResizeDimensions>();

      changes.forEach(change => {
        if (change.type !== 'dimensions') return;
        const dimensions = (change as { id: string; dimensions?: ResizeDimensions }).dimensions;
        if (!dimensions) return;
        changedDimensions.set(change.id, dimensions);
      });

      const changedNodes = applyNodeChanges(changes, previousNodes);
      const nodesWithDimensions = changedDimensions.size === 0
        ? changedNodes
        : changedNodes.map(node => {
          const dimensions = changedDimensions.get(node.id);
          if (!dimensions) return node;

          const width = toFiniteNumber(dimensions.width)
            ?? toFiniteNumber(node.width)
            ?? toFiniteNumber(node.measured?.width)
            ?? toFiniteNumber((node.style as { width?: unknown } | undefined)?.width)
            ?? node.data.element.width;

          const height = toFiniteNumber(dimensions.height)
            ?? toFiniteNumber(node.height)
            ?? toFiniteNumber(node.measured?.height)
            ?? toFiniteNumber((node.style as { height?: unknown } | undefined)?.height)
            ?? node.data.element.height;

          return {
            ...node,
            width,
            height,
            measured: { ...(node.measured || {}), width, height },
            data: { ...node.data, element: { ...node.data.element, width, height } },
            style: { ...(node.style || {}), width, height }
          };
        });

      return reconcileContainerMembershipAfterDrop(nodesWithDimensions, droppedNodeIds);
    });

    const shouldCommit = changes.some(change => {
      if (change.type === 'remove') return true;
      if (change.type === 'position') return (change as { dragging?: boolean }).dragging === false;
      if (change.type === 'dimensions') return (change as { resizing?: boolean }).resizing === false;
      return false;
    });

    if (shouldCommit) scheduleCommit();
  }, [reconcileContainerMembershipAfterDrop, scheduleCommit]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges(previousEdges => applyEdgeChanges(changes, previousEdges));
    if (changes.some(change => change.type === 'remove')) scheduleCommit();
  }, [scheduleCommit]);

  const onConnect = useCallback((connection: Connection) => {
    const edgeWithMeta = {
      ...connection,
      id: generateId(),
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' as const }
    };

    setEdges(previousEdges => addEdge(edgeWithMeta, previousEdges));
    scheduleCommit();
  }, [scheduleCommit]);

  /**
   * Commits an in-progress freehand draft into a persisted pencil element.
   * This separates high-frequency pointer updates from store/history writes for better responsiveness.
   * Tradeoff: unfinished drafts are discarded when fewer than two points exist.
   */
  const finishFreehandDraw = useCallback(() => {
    if (tool !== 'PENCIL') return;

    const currentDraft = freehandDraftRef.current;
    setFreehandDraft(null);
    if (!currentDraft) return;

    setNodes(previousNodes => {
      const zIndex = getNextZIndex(previousNodes);
      const element = finalizeFreehandElement(currentDraft, zIndex, generateId);
      if (!element) return previousNodes;
      return [...previousNodes, createNodeFromElement(element)];
    });

    scheduleCommit();
  }, [createNodeFromElement, getNextZIndex, scheduleCommit, tool]);

  /**
   * Handles pane pointer movement while pencil mode is active.
   * The handler creates or extends drafts using the primary mouse button state.
   * Tradeoff: touch/pen pressure input is not modeled in this V1 implementation.
   */
  const onPaneMouseMove = useCallback((event: ReactMouseEvent) => {
    if (tool !== 'PENCIL') return;

    if (event.buttons !== 1) {
      if (freehandDraftRef.current) finishFreehandDraw();
      return;
    }

    const point = toFlowPoint(event.clientX, event.clientY);
    setFreehandDraft(previousDraft => (
      previousDraft
        ? appendFreehandPoint(previousDraft, point)
        : createFreehandDraft(point)
    ));
  }, [finishFreehandDraw, toFlowPoint, tool]);

  /**
   * Finalizes drawing when pointer leaves the pane during pencil mode.
   * This prevents orphan drafts when mouseup happens outside the canvas surface.
   * Tradeoff: leaving the pane always commits current stroke instead of canceling it.
   */
  const onPaneMouseLeave = useCallback(() => {
    if (tool !== 'PENCIL') return;
    if (!freehandDraftRef.current) return;
    finishFreehandDraw();
  }, [finishFreehandDraw, tool]);

  /**
   * Creates a new element for click-based creation tools.
   * Selection and navigation tools intentionally no-op here.
   * Tradeoff: pencil creation uses move-driven drafting and is excluded from click creation.
   */
  const onPaneClick = useCallback((event: ReactMouseEvent) => {
    const kind = getElementKindForTool(tool);
    if (!kind || kind === 'PENCIL') return;

    const flowPosition = toFlowPoint(event.clientX, event.clientY);
    createElementFromTool(kind, flowPosition.x, flowPosition.y);
    setTool('SELECT');
  }, [createElementFromTool, toFlowPoint, tool]);

  const onEmailBlockSelect = useCallback((cardId: string, blockId: string) => {
    setEditingCardId(cardId);
    setActiveBlockId(blockId);
  }, []);

  const selectPanelBlock = useCallback((blockId: string) => {
    if (!selectedNode) return;
    onEmailBlockSelect(selectedNode.id, blockId);
  }, [onEmailBlockSelect, selectedNode]);

  const onEmailCardSurfaceSelect = useCallback((cardId: string) => {
    setEditingCardId(cardId);
    setActiveBlockId(null);
  }, []);

  const onEmailBlockReorder = useCallback((cardId: string, sourceBlockId: string, targetBlockId: string) => {
    if (selectedNode?.id !== cardId || sourceBlockId === targetBlockId) return;

    updateSelectedEmailTemplate(template => ({
      ...template,
      blocks: moveBlockById(template.blocks, sourceBlockId, targetBlockId)
    }));
    setActiveBlockId(sourceBlockId);
  }, [selectedNode?.id, updateSelectedEmailTemplate]);

  const onEmailBlockResizeStart = useCallback((cardId: string, blockId: string, clientY: number) => {
    if (selectedNode?.id !== cardId || selectedNode.data.element.kind !== 'EMAIL_CARD') return;

    const block = (selectedNode.data.element.emailTemplate?.blocks || []).find(candidate => candidate.id === blockId);
    if (!block) return;

    const metrics = normalizeBlockMetrics(block);
    setEditingCardId(cardId);
    setActiveBlockId(blockId);
    setResizeState({ blockId, startY: clientY, startHeight: metrics.heightPx });
  }, [selectedNode]);

  const onEmailBlockTextChange = useCallback((cardId: string, blockId: string, value: string) => {
    if (selectedNode?.id !== cardId) return;
    updateEmailBlock(blockId, block => ({ ...block, text: value }));
  }, [selectedNode?.id, updateEmailBlock]);

  useEffect(() => {
    if (!resizeState || selectedNode?.data.element.kind !== 'EMAIL_CARD') return;

    const currentBlocks = selectedNode.data.element.emailTemplate?.blocks || [];
    const resizingBlock = currentBlocks.find(block => block.id === resizeState.blockId);
    if (!resizingBlock) return;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const delta = event.clientY - resizeState.startY;
      const nextHeight = clampNumber(resizeState.startHeight + delta, EMAIL_BLOCK_MIN_HEIGHT, EMAIL_BLOCK_MAX_HEIGHT);

      updateEmailBlock(resizeState.blockId, block => {
        const metrics = normalizeBlockMetrics(block);
        const nextMetrics: Partial<CanvasEmailBlock> = { heightPx: nextHeight };

        if (block.type !== 'IMAGE') {
          const derivedFont = clampNumber(metrics.fontSizePx + delta * 0.08, EMAIL_BLOCK_MIN_FONT_SIZE, EMAIL_BLOCK_MAX_FONT_SIZE);
          nextMetrics.fontSizePx = derivedFont;
        }

        return { ...block, ...nextMetrics };
      });
    };

    const handleMouseUp = () => {
      setResizeState(null);
      scheduleCommit();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, scheduleCommit, selectedNode, updateEmailBlock]);

  const nodeTypes = useMemo(() => ({
    canvasElement: (props: NodeProps<Node<CanvasNodeData>>) => (
      <CanvasElementNode
        {...props}
        onResizeLive={(nodeId, dimensions) => syncNodeDimensions(nodeId, dimensions)}
        onResizeDone={(nodeId, dimensions) => {
          syncNodeDimensions(nodeId, dimensions);
          scheduleCommit();
        }}
        editingCardId={editingCardId}
        activeBlockId={activeBlockId}
        resizingBlockId={resizeState?.blockId || null}
        onEmailBlockSelect={onEmailBlockSelect}
        onEmailBlockReorder={onEmailBlockReorder}
        onEmailBlockResizeStart={onEmailBlockResizeStart}
        onEmailCardSurfaceSelect={onEmailCardSurfaceSelect}
        onEmailBlockTextChange={onEmailBlockTextChange}
      />
    )
  }), [
    activeBlockId,
    editingCardId,
    onEmailBlockReorder,
    onEmailBlockResizeStart,
    onEmailBlockSelect,
    onEmailCardSurfaceSelect,
    onEmailBlockTextChange,
    resizeState?.blockId,
    scheduleCommit,
    syncNodeDimensions
  ]);

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

      if (isMeta && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        groupSelectionIntoContainer();
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
  }, [clipboardNodes, duplicateSelection, groupSelectionIntoContainer, redo, removeSelection, selectedNodes, undo]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (tool !== 'PENCIL') return;
      if (!freehandDraftRef.current) return;
      finishFreehandDraw();
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [finishFreehandDraw, tool]);

  useEffect(() => {
    if (tool === 'PENCIL') return;
    if (!freehandDraftRef.current) return;
    setFreehandDraft(null);
  }, [tool]);

  const selectedElement = selectedNode?.data.element;
  const selectedIsEmailCard = selectedElement?.kind === 'EMAIL_CARD';
  const selectedEmailBlocks = selectedIsEmailCard ? ensureEmailTemplate(selectedElement.emailTemplate).blocks : [];
  const panelEmailBlocks = selectedEmailBlocks;

  const activeSelectedBlock = selectedEmailBlocks.find(block => block.id === activeBlockId);
  const activeSelectedBlockMetrics = activeSelectedBlock ? normalizeBlockMetrics(activeSelectedBlock) : null;
  const panelIsBlockMode = selectedIsEmailCard && !!activeSelectedBlock;

  const resetViewport = useCallback(() => {
    rfInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 120 });
    setViewport({ x: 0, y: 0, zoom: 1 });
    scheduleViewportCommit();
  }, [rfInstance, scheduleViewportCommit]);

  /**
   * Persists viewport updates after panning/zooming ends.
   * This keeps local state in sync with ReactFlow without committing every transient frame.
   * Tradeoff: viewport snapshots are eventually consistent during active movement.
   */
  const onCanvasMoveEnd = useCallback((_: unknown, nextViewport: { x: number; y: number; zoom: number }) => {
    setViewport(nextViewport);
    scheduleViewportCommit();
  }, [scheduleViewportCommit]);

  /**
   * Zooms the canvas viewport in with a short animation.
   * A named command keeps toolbar wiring explicit and test-friendly.
   * Tradeoff: zoom step granularity relies on ReactFlow defaults.
   */
  const zoomIn = useCallback(() => {
    rfInstance?.zoomIn({ duration: 120 });
  }, [rfInstance]);

  /**
   * Zooms the canvas viewport out with a short animation.
   * A named command mirrors zoom-in semantics for symmetric toolbar behavior.
   * Tradeoff: zoom bounds are enforced by ReactFlow configuration, not this helper.
   */
  const zoomOut = useCallback(() => {
    rfInstance?.zoomOut({ duration: 120 });
  }, [rfInstance]);

  return {
    campaign,
    nodes,
    edges,
    nodeTypes,
    viewport,
    tool,
    spacePan,
    rfInstance,
    historyVersion,
    linkPanelOpen,
    linkSearch,
    draftLinkedTicketIds,
    filteredTickets,
    selectedNode,
    selectedElement,
    selectedIsEmailCard,
    panelIsBlockMode,
    panelEmailBlocks,
    activeSelectedBlock,
    activeSelectedBlockMetrics,
    activeBlockId,
    freehandDraft,
    containerOptions,
    linkedTicketIdsForSelection,
    ticketById,
    canUndo,
    canRedo,
    canGroupSelection,
    setRfInstance,
    setTool,
    setLinkPanelOpen,
    setLinkSearch,
    setDraftLinkedTicketIds,
    setActiveBlockId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onPaneClick,
    onPaneMouseMove,
    onPaneMouseLeave,
    onMoveEnd: onCanvasMoveEnd,
    undo,
    redo,
    removeSelection,
    groupSelectionIntoContainer,
    addEmailBlock,
    updateEmailBlock,
    deleteEmailBlock,
    handleEmailBlockUpload,
    updateSelectedElement,
    assignSelectedParent,
    openLinkPanel,
    saveTicketLinks,
    selectPanelBlock,
    resetViewport,
    zoomIn,
    zoomOut,
    blockTypeOptions: EMAIL_BLOCK_TYPES,
    blockLimits: {
      minHeight: EMAIL_BLOCK_MIN_HEIGHT,
      maxHeight: EMAIL_BLOCK_MAX_HEIGHT,
      minFontSize: EMAIL_BLOCK_MIN_FONT_SIZE,
      maxFontSize: EMAIL_BLOCK_MAX_FONT_SIZE,
      maxPadding: EMAIL_BLOCK_MAX_PADDING,
      maxMarginBottom: EMAIL_BLOCK_MAX_MARGIN_BOTTOM
    }
  };
};

export type CanvasController = ReturnType<typeof useCanvasController>;
