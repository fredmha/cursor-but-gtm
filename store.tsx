
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Campaign, Channel, Ticket, TicketStatus, User, Priority, Project, ProjectUpdate, ChannelLink, ChannelNote, ChannelPlan, ViewMode, Role, CanvasScene, CanvasElement, CanvasRelation, ExecutionRowType, CanvasEmailTemplate, CanvasEmailBlock, EmailBlockType, EmailBlockAlign, CanvasElementKind, CanvasElementStyle, CanvasStrokeData, CanvasStrokePoint } from './types';

// --- Constants ---

const STORAGE_KEYS = {
  campaign: 'gtm-os-campaign',
  users: 'gtm-os-users'
} as const;

const createDefaultCanvasScene = (): CanvasScene => ({
  version: 2,
  elements: [],
  relations: [],
  viewport: { x: 0, y: 0, zoom: 1 }
});

const USER_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-blue-500',
  'bg-cyan-500'
];

const EXECUTION_ALLOWED_STATUSES: TicketStatus[] = [
  TicketStatus.Todo,
  TicketStatus.InProgress,
  TicketStatus.Done
];

type AddExecutionRowInput = {
  rowType: ExecutionRowType;
  title?: string;
  executionText?: string;
  description?: string;
  dueDate?: string;
  assigneeId?: string;
  status?: TicketStatus;
  channelId?: string;
  projectId?: string;
  priority?: Priority;
};

// --- Shared Helpers ---

// Safe ID Generator
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const DEFAULT_USER: User = {
  id: 'u_owner',
  name: 'Owner',
  initials: 'OW',
  color: 'bg-indigo-500',
  role: 'Admin'
};

// Convert a date string to a sortable timestamp. Missing/invalid dates sort last.
const getTimestamp = (dateString?: string) => {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(dateString).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const getExecutionSafeStatus = (status?: TicketStatus): TicketStatus => {
  if (!status) return TicketStatus.Todo;
  return EXECUTION_ALLOWED_STATUSES.includes(status) ? status : TicketStatus.Todo;
};

const normalizeTicketForExecution = (ticket: Ticket): Ticket => ({
  ...ticket,
  rowType: ticket.rowType === 'TEXT' ? 'TEXT' : 'TASK',
  canvasItemIds: Array.isArray(ticket.canvasItemIds) ? ticket.canvasItemIds : []
});

const updateById = <T extends { id: string }>(items: T[], id: string, updates: Partial<T>) =>
  items.map(item => item.id === id ? { ...item, ...updates } : item);

const removeById = <T extends { id: string }>(items: T[], id: string) =>
  items.filter(item => item.id !== id);

const CANVAS_ELEMENT_KINDS: CanvasElementKind[] = [
  'EMAIL_CARD',
  'CONTAINER',
  'RECTANGLE',
  'ELLIPSE',
  'DIAMOND',
  'TEXT',
  'PENCIL'
];

const getCanvasElementKind = (value: unknown): CanvasElementKind => {
  if (typeof value !== 'string') return 'EMAIL_CARD';
  return CANVAS_ELEMENT_KINDS.includes(value as CanvasElementKind) ? value as CanvasElementKind : 'EMAIL_CARD';
};

const getDefaultCanvasDimensions = (kind: CanvasElementKind): { width: number; height: number } => {
  if (kind === 'CONTAINER') return { width: 520, height: 380 };
  if (kind === 'TEXT') return { width: 260, height: 90 };
  if (kind === 'PENCIL') return { width: 120, height: 80 };
  if (kind === 'RECTANGLE') return { width: 260, height: 160 };
  if (kind === 'ELLIPSE') return { width: 240, height: 160 };
  if (kind === 'DIAMOND') return { width: 220, height: 170 };
  return { width: 320, height: 180 };
};

const normalizeCanvasStyle = (value: unknown): CanvasElementStyle | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;

  return {
    fill: typeof source.fill === 'string' ? source.fill : undefined,
    stroke: typeof source.stroke === 'string' ? source.stroke : undefined,
    strokeWidth: parseCanvasNumber(source.strokeWidth),
    fontSize: parseCanvasNumber(source.fontSize),
    fontFamily: typeof source.fontFamily === 'string' ? source.fontFamily : undefined
  };
};

const toStrokePoint = (value: unknown): CanvasStrokePoint | null => {
  if (!value || typeof value !== 'object') return null;
  const point = value as Record<string, unknown>;
  const x = parseCanvasNumber(point.x);
  const y = parseCanvasNumber(point.y);
  if (x === undefined || y === undefined) return null;
  return { x, y };
};

const normalizeCanvasStroke = (value: unknown): CanvasStrokeData | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.points)) return undefined;

  const points = source.points
    .map(toStrokePoint)
    .filter((point): point is CanvasStrokePoint => point !== null);

  if (points.length < 2) return undefined;
  return { points };
};

const normalizeCanvasElement = (value: unknown): CanvasElement => {
  const element = value && typeof value === 'object' ? (value as Record<string, unknown>) : {} as Record<string, unknown>;
  const kind = getCanvasElementKind(element.kind);
  const defaults = getDefaultCanvasDimensions(kind);

  return {
    id: typeof element.id === 'string' ? element.id : generateId(),
    kind,
    x: parseCanvasNumber(element.x) ?? 0,
    y: parseCanvasNumber(element.y) ?? 0,
    width: Math.max(40, parseCanvasNumber(element.width) ?? defaults.width),
    height: Math.max(30, parseCanvasNumber(element.height) ?? defaults.height),
    zIndex: parseCanvasNumber(element.zIndex) ?? 0,
    text: typeof element.text === 'string' ? element.text : '',
    style: normalizeCanvasStyle(element.style),
    emailTemplate: normalizeEmailTemplate(element.emailTemplate),
    stroke: normalizeCanvasStroke(element.stroke)
  };
};

const parseCanvasNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const EMAIL_BLOCK_TYPES: EmailBlockType[] = ['H1', 'H2', 'H3', 'BODY', 'IMAGE'];
const EMAIL_BLOCK_ALIGNMENTS: EmailBlockAlign[] = ['left', 'center', 'right'];
const DEFAULT_EMAIL_SUBJECT = 'Subject line...';
const REQUIRED_EMAIL_BODY_BLOCK_ID_BASE = 'required-body';

const getDefaultBlockLayout = (type: EmailBlockType): Required<Pick<CanvasEmailBlock, 'heightPx' | 'fontSizePx' | 'paddingY' | 'paddingX' | 'marginBottomPx'>> => {
  if (type === 'H1') return { heightPx: 56, fontSizePx: 30, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (type === 'H2') return { heightPx: 46, fontSizePx: 24, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (type === 'H3') return { heightPx: 40, fontSizePx: 20, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (type === 'IMAGE') return { heightPx: 140, fontSizePx: 14, paddingY: 6, paddingX: 6, marginBottomPx: 10 };
  return { heightPx: 84, fontSizePx: 16, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
};

const normalizeEmailBlock = (rawBlock: unknown, fallbackOrder: number): CanvasEmailBlock | null => {
  if (!rawBlock || typeof rawBlock !== 'object') return null;
  const block = rawBlock as Record<string, unknown>;
  const type = typeof block.type === 'string' && EMAIL_BLOCK_TYPES.includes(block.type as EmailBlockType)
    ? block.type as EmailBlockType
    : null;
  if (!type) return null;

  const align = typeof block.align === 'string' && EMAIL_BLOCK_ALIGNMENTS.includes(block.align as EmailBlockAlign)
    ? block.align as EmailBlockAlign
    : 'left';
  const defaults = getDefaultBlockLayout(type);
  const heightPx = clampNumber(parseCanvasNumber(block.heightPx) ?? defaults.heightPx, 32, 420);
  const fontSizePx = clampNumber(parseCanvasNumber(block.fontSizePx) ?? defaults.fontSizePx, 10, 48);
  const paddingY = clampNumber(parseCanvasNumber(block.paddingY) ?? defaults.paddingY, 0, 24);
  const paddingX = clampNumber(parseCanvasNumber(block.paddingX) ?? defaults.paddingX, 0, 24);
  const marginBottomPx = clampNumber(parseCanvasNumber(block.marginBottomPx) ?? defaults.marginBottomPx, 0, 48);
  const order = parseCanvasNumber(block.order) ?? fallbackOrder;

  return {
    id: typeof block.id === 'string' ? block.id : generateId(),
    order,
    type,
    align,
    text: typeof block.text === 'string' ? block.text : '',
    imageUrl: typeof block.imageUrl === 'string' ? block.imageUrl : '',
    heightPx,
    fontSizePx,
    paddingY,
    paddingX,
    marginBottomPx
  };
};

/**
 * Derives a subject fallback from legacy text blocks.
 * This preserves prior author intent for templates without explicit subject storage.
 * Tradeoff: fallback picks first available text block and may not match perfect subject semantics.
 */
const getSubjectFallbackFromBlocks = (blocks: CanvasEmailBlock[]): string => {
  const firstTextBlock = blocks.find(block => block.type !== 'IMAGE' && (block.text || '').trim().length > 0);
  return (firstTextBlock?.text || '').trim();
};

/**
 * Builds a deterministic id for injected required-body blocks.
 * Stable ids avoid noisy churn when normalizing legacy templates repeatedly.
 * Tradeoff: deterministic ids are predictable and optimized for editor consistency.
 */
const getRequiredBodyBlockIdCandidate = (blocks: CanvasEmailBlock[]): string => {
  const existingBlockIds = new Set(blocks.map(block => block.id));
  let suffix = 1;
  let candidateId = REQUIRED_EMAIL_BODY_BLOCK_ID_BASE;

  while (existingBlockIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${REQUIRED_EMAIL_BODY_BLOCK_ID_BASE}-${suffix}`;
  }

  return candidateId;
};

/**
 * Creates an injected BODY block payload for templates that are missing BODY content.
 * This guarantees editor safety while preserving user-authored block ordering.
 * Tradeoff: injected body copy starts from a generic placeholder.
 */
const createRequiredBodyBlock = (blockId: string): CanvasEmailBlock => {
  const defaults = getDefaultBlockLayout('BODY');
  return {
    id: blockId,
    order: 0,
    type: 'BODY',
    align: 'left',
    text: 'Body copy...',
    imageUrl: '',
    ...defaults
  };
};

/**
 * Ensures persisted templates contain at least one BODY block without forcing BODY-first ordering.
 * This preserves drag-reordered layouts while still repairing malformed BODY-free templates.
 * Tradeoff: repaired templates append synthesized BODY content at the end.
 */
const ensureAtLeastOneBodyBlock = (blocks: CanvasEmailBlock[]): CanvasEmailBlock[] => {
  const orderedBlocks = [...blocks]
    .sort((leftBlock, rightBlock) => {
      if (leftBlock.order !== rightBlock.order) return leftBlock.order - rightBlock.order;
      return leftBlock.id.localeCompare(rightBlock.id);
    })
    .map((block, index) => ({ ...block, order: index }));

  const hasBodyBlock = orderedBlocks.some(block => block.type === 'BODY');
  if (!hasBodyBlock) {
    const requiredBodyBlockId = getRequiredBodyBlockIdCandidate(orderedBlocks);
    return [...orderedBlocks, createRequiredBodyBlock(requiredBodyBlockId)]
      .map((block, index) => ({ ...block, order: index }));
  }

  return orderedBlocks;
};

/**
 * Normalizes persisted email-template payloads into the mandated subject/body structure.
 * This migrates legacy blocks-only templates while preserving existing content where possible.
 * Tradeoff: malformed payloads may gain synthesized defaults to keep editing stable.
 */
const normalizeEmailTemplate = (rawTemplate: unknown): CanvasEmailTemplate | undefined => {
  if (!rawTemplate || typeof rawTemplate !== 'object') return undefined;
  const template = rawTemplate as Record<string, unknown>;
  const hasRawSubject = typeof template.subject === 'string';
  const rawSubject = hasRawSubject ? template.subject as string : '';
  const rawBlocks = Array.isArray(template.blocks) ? template.blocks : [];
  if (rawBlocks.length === 0 && !hasRawSubject) return undefined;

  const blocks = rawBlocks
    .map((rawBlock, index) => normalizeEmailBlock(rawBlock, index))
    .filter((block): block is CanvasEmailBlock => block !== null);
  const orderedBlocks = [...blocks]
    .sort((leftBlock, rightBlock) => {
      if (leftBlock.order !== rightBlock.order) return leftBlock.order - rightBlock.order;
      return leftBlock.id.localeCompare(rightBlock.id);
    })
    .map((block, index) => ({ ...block, order: index }));
  const normalizedSubject = rawSubject.trim().length > 0
    ? rawSubject
    : (getSubjectFallbackFromBlocks(orderedBlocks) || DEFAULT_EMAIL_SUBJECT);
  const structuredBlocks = ensureAtLeastOneBodyBlock(orderedBlocks);

  return {
    version: 1,
    subject: normalizedSubject,
    blocks: structuredBlocks
  };
};

const normalizeCanvasViewport = (value: unknown): CanvasScene['viewport'] => {
  const viewport = value && typeof value === 'object' ? (value as Record<string, unknown>) : {} as Record<string, unknown>;
  return {
    x: Number(viewport.x) || 0,
    y: Number(viewport.y) || 0,
    zoom: Number(viewport.zoom) || 1
  };
};

const normalizeCanvasRelation = (value: unknown): CanvasRelation | null => {
  if (!value || typeof value !== 'object') return null;
  const relation = value as Record<string, unknown>;
  if (relation.type !== 'PARENT' && relation.type !== 'TICKET_LINK') return null;
  const fromId = typeof relation.fromId === 'string' ? relation.fromId : '';
  const toId = typeof relation.toId === 'string' ? relation.toId : '';
  if (!fromId || !toId) return null;
  return {
    id: typeof relation.id === 'string' ? relation.id : generateId(),
    type: relation.type,
    fromId,
    toId,
    meta: relation.meta && typeof relation.meta === 'object' ? relation.meta as Record<string, unknown> : undefined
  };
};

const migrateCanvasScene = (rawValue: unknown): CanvasScene => {
  if (!rawValue || typeof rawValue !== 'object') return createDefaultCanvasScene();
  const rawScene = rawValue as Record<string, unknown>;

  const viewport = normalizeCanvasViewport(rawScene.viewport);

  if (rawScene.version === 2 && Array.isArray(rawScene.elements) && Array.isArray(rawScene.relations)) {
    const elements = rawScene.elements.map(normalizeCanvasElement);
    const validElementIds = new Set(elements.map(element => element.id));
    const relations = rawScene.relations
      .map(normalizeCanvasRelation)
      .filter((relation): relation is CanvasRelation => relation !== null)
      .filter(relation =>
        relation.type === 'TICKET_LINK'
          ? validElementIds.has(relation.fromId)
          : validElementIds.has(relation.fromId) && validElementIds.has(relation.toId)
      );
    return { version: 2, elements, relations, viewport };
  }

  // Legacy v1 migration: items + parentId/ticketIds -> elements + relations
  const legacyItems = Array.isArray(rawScene.items) ? rawScene.items : [];
  const normalized = legacyItems.map(item => {
    const legacy = item && typeof item === 'object' ? (item as Record<string, unknown>) : {} as Record<string, unknown>;
    const element = normalizeCanvasElement(legacy);
    return {
      element,
      legacyParentId: typeof legacy.parentId === 'string' ? legacy.parentId : undefined,
      legacyTicketIds: Array.isArray(legacy.ticketIds)
        ? legacy.ticketIds.filter((id): id is string => typeof id === 'string')
        : []
    };
  });

  const idMap = new Map<string, string>();
  normalized.forEach(({ element }, index) => {
    const legacyItem = legacyItems[index];
    const legacyId = legacyItem && typeof legacyItem === 'object' && typeof (legacyItem as { id?: unknown }).id === 'string'
      ? (legacyItem as { id: string }).id
      : element.id;
    idMap.set(legacyId, element.id);
  });

  const relations: CanvasRelation[] = [];
  normalized.forEach(({ element, legacyParentId, legacyTicketIds }) => {
    if (legacyParentId) {
      const mappedParentId = idMap.get(legacyParentId);
      if (mappedParentId && mappedParentId !== element.id) {
        relations.push({
          id: generateId(),
          type: 'PARENT',
          fromId: element.id,
          toId: mappedParentId
        });
      }
    }

    legacyTicketIds.forEach(ticketId => {
      relations.push({
        id: generateId(),
        type: 'TICKET_LINK',
        fromId: element.id,
        toId: ticketId
      });
    });
  });

  return {
    version: 2,
    elements: normalized.map(entry => entry.element),
    relations,
    viewport
  };
};

const removeTicketLinksFromScene = (scene: CanvasScene, ticketId: string): CanvasScene => ({
  ...scene,
  relations: scene.relations.filter(relation => !(relation.type === 'TICKET_LINK' && relation.toId === ticketId))
});

/**
 * Builds a child->container parent lookup from scene relations.
 * Inputs: scene and known container ids.
 * Output: map where child ids resolve to their container parent id.
 * Invariant: only parent relations targeting container ids are included.
 */
const getParentContainerByChildId = (scene: CanvasScene, containerIds: Set<string>): Map<string, string> => {
  const parentContainerByChildId = new Map<string, string>();

  scene.relations.forEach(relation => {
    if (relation.type !== 'PARENT') return;
    if (!containerIds.has(relation.toId)) return;
    parentContainerByChildId.set(relation.fromId, relation.toId);
  });

  return parentContainerByChildId;
};

/**
 * Canonicalizes canvas element ids into container link-owner ids.
 * Inputs: current scene and requested element ids from UI payloads.
 * Output: deduped container ids that are valid ticket-link owners.
 * Invariant: only container ids are returned; ungrouped non-container ids are dropped.
 */
const toContainerTicketLinkOwnerIds = (scene: CanvasScene, requestedElementIds: string[]): string[] => {
  const elementById = new Map(scene.elements.map(element => [element.id, element] as [string, CanvasElement]));
  const containerIds = new Set(
    scene.elements
      .filter(element => element.kind === 'CONTAINER')
      .map(element => element.id)
  );
  const parentContainerByChildId = getParentContainerByChildId(scene, containerIds);

  const dedupedOwnerIds: string[] = [];
  const seenOwnerIds = new Set<string>();

  requestedElementIds.forEach(elementId => {
    const element = elementById.get(elementId);
    if (!element) return;

    const ownerId = element.kind === 'CONTAINER'
      ? element.id
      : parentContainerByChildId.get(element.id);

    if (!ownerId || seenOwnerIds.has(ownerId)) return;
    seenOwnerIds.add(ownerId);
    dedupedOwnerIds.push(ownerId);
  });

  return dedupedOwnerIds;
};

interface StoreState {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;

  campaign: Campaign | null;
  users: User[];
  currentUser: User;
  setCampaign: (campaign: Campaign) => void;
  updateCampaign: (updates: Partial<Campaign>) => void;

  // User Actions
  addUser: (name: string, role: Role) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;

  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  updateChannelPlan: (channelId: string, plan: ChannelPlan) => void;

  addChannelPrinciple: (channelId: string, text: string) => void;
  deleteChannelPrinciple: (channelId: string, principleId: string) => void;
  addChannelLink: (channelId: string, link: ChannelLink) => void;
  removeChannelLink: (channelId: string, linkId: string) => void;
  addChannelNote: (channelId: string, note: ChannelNote) => void;
  deleteChannelNote: (channelId: string, noteId: string) => void;
  addChannelMember: (channelId: string, userId: string) => void;
  removeChannelMember: (channelId: string, userId: string) => void;

  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  addProjectUpdate: (projectId: string, update: ProjectUpdate) => void;

  addProjectTicket: (projectId: string, ticket: Ticket) => void;
  updateProjectTicket: (projectId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteProjectTicket: (projectId: string, ticketId: string) => void;

  addTicket: (channelId: string, ticket: Ticket) => void;
  updateTicket: (channelId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteTicket: (channelId: string, ticketId: string) => void;
  getExecutionRows: () => Ticket[];
  addExecutionRow: (input: AddExecutionRowInput) => void;
  updateExecutionRow: (ticketId: string, updates: Partial<Ticket>) => void;
  deleteExecutionRow: (ticketId: string) => void;

  updateCanvasScene: (scene: CanvasScene) => void;
  getCanvasChildren: (containerId: string) => CanvasElement[];
  getCanvasTicketLinks: (elementId: string) => string[];
  getCanvasElementsLinkedToTicket: (ticketId: string) => string[];

  importAIPlan: (channelsData: any[]) => void;
  switchUser: (userId: string) => void;
  reset: () => void;
  toggleSampleData: () => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shouldResetOnReload = import.meta.env.DEV;
  const shouldPersist = !shouldResetOnReload;
  const resetGuard = useRef(false);

  if (shouldResetOnReload && !resetGuard.current) {
    localStorage.removeItem(STORAGE_KEYS.campaign);
    localStorage.removeItem(STORAGE_KEYS.users);
    resetGuard.current = true;
  }

  const [users, setUsers] = useState<User[]>(() => {
    if (!shouldPersist) return [DEFAULT_USER];
    const saved = localStorage.getItem(STORAGE_KEYS.users);
    return saved ? JSON.parse(saved) : [DEFAULT_USER];
  });

  const [currentUser, setCurrentUser] = useState<User>(users[0] || DEFAULT_USER);
  const [currentView, setCurrentView] = useState<ViewMode>('CANVAS');

  const [campaign, setCampaignState] = useState<Campaign | null>(() => {
    if (!shouldPersist) return null;
    const saved = localStorage.getItem(STORAGE_KEYS.campaign);
    if (!saved) return null;

    const data = JSON.parse(saved);

    // MIGRATION Logic
    if (data.channels) {
      data.channels = data.channels.map((c: any) => ({
        ...c,
        principles: c.principles || [],
        tags: c.tags || [],
        links: c.links || [],
        notes: c.notes || [],
        memberIds: c.memberIds || [],
        plan: c.plan || undefined,
        tickets: (c.tickets || []).map((t: any) => {
          const normalized = { ...t };
          delete normalized.roadmapItemId;
          return {
            ...normalized,
            rowType: normalized.rowType === 'TEXT' ? 'TEXT' : 'TASK',
            canvasItemIds: Array.isArray(normalized.canvasItemIds) ? normalized.canvasItemIds : []
          };
        })
      }));
    }

    if (!data.projects) {
      data.projects = [];
    } else {
      data.projects = data.projects.map((p: any) => ({
        ...p,
        tickets: (p.tickets || []).map((t: any) => {
          const normalized = { ...t };
          delete normalized.roadmapItemId;
          return {
            ...normalized,
            rowType: normalized.rowType === 'TEXT' ? 'TEXT' : 'TASK',
            canvasItemIds: Array.isArray(normalized.canvasItemIds) ? normalized.canvasItemIds : []
          };
        })
      }));
    }

    data.standaloneTickets = (data.standaloneTickets || []).map((t: any) => {
      const normalized = { ...t };
      delete normalized.roadmapItemId;
      return {
        ...normalized,
        rowType: normalized.rowType === 'TEXT' ? 'TEXT' : 'TASK',
        canvasItemIds: Array.isArray(normalized.canvasItemIds) ? normalized.canvasItemIds : []
      };
    });

    delete data.roadmapItems;
    delete data.timelineTags;
    if (data.sampleData) {
      delete data.sampleData.roadmapItemIds;
      delete data.sampleData.timelineTagIds;
    }
    data.canvasScene = migrateCanvasScene(data.canvasScene);

    return data;
  });

  useEffect(() => {
    if (!shouldPersist) return;
    if (campaign) {
      localStorage.setItem(STORAGE_KEYS.campaign, JSON.stringify(campaign));
    } else {
      localStorage.removeItem(STORAGE_KEYS.campaign);
    }
  }, [campaign]);

  useEffect(() => {
    if (!shouldPersist) return;
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }, [users]);

  // --- Shared State Helpers ---

  const updateCampaignState = (updater: (prev: Campaign) => Campaign) => {
    setCampaignState(prev => prev ? updater(prev) : null);
  };

  // --- User Actions ---
  const addUser = (name: string, role: Role) => {
    const newUser: User = {
      id: generateId(),
      name,
      initials: name.substring(0, 2).toUpperCase(),
      color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
      role
    };
    setUsers([...users, newUser]);
  };

  const removeUser = (userId: string) => {
    if (users.length <= 1) return; // Prevent deleting last user
    setUsers(users.filter(u => u.id !== userId));
    if (currentUser.id === userId) {
      setCurrentUser(users.find(u => u.id !== userId) || users[0]);
    }
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers(updateById(users, userId, updates));
    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
  };

  const setCampaign = (c: Campaign) => setCampaignState(c);

  const updateCampaign = (updates: Partial<Campaign>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({ ...prev, ...updates }));
  };

  // --- Channel Actions ---

  const addChannel = (channel: Channel) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: [...prev.channels, {
        ...channel,
        tickets: [],
        principles: channel.principles || [],
        tags: channel.tags || [],
        links: [],
        notes: [],
        memberIds: []
      }]
    }));
  };

  const updateChannel = (channelId: string, updates: Partial<Channel>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: updateById(prev.channels, channelId, updates)
    }));
  };

  const updateChannelPlan = (channelId: string, plan: ChannelPlan) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: updateById(prev.channels, channelId, { plan })
    }));
  };

  const deleteChannel = (channelId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c.id !== channelId)
    }));
  };

  const addChannelPrinciple = (channelId: string, text: string) => {
    if (!campaign) return;
    const principle = { id: generateId(), text };
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, principles: [...(c.principles || []), principle] } : c
      )
    }));
  };

  const deleteChannelPrinciple = (channelId: string, principleId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, principles: (c.principles || []).filter(p => p.id !== principleId) } : c
      )
    }));
  };

  const addChannelLink = (channelId: string, link: ChannelLink) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, links: [...(c.links || []), link] } : c
      )
    }));
  };

  const removeChannelLink = (channelId: string, linkId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, links: (c.links || []).filter(l => l.id !== linkId) } : c
      )
    }));
  };

  const addChannelNote = (channelId: string, note: ChannelNote) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, notes: [note, ...(c.notes || [])] } : c
      )
    }));
  };

  const deleteChannelNote = (channelId: string, noteId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, notes: (c.notes || []).filter(n => n.id !== noteId) } : c
      )
    }));
  };

  const addChannelMember = (channelId: string, userId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c => {
        if (c.id !== channelId) return c;
        const currentMembers = c.memberIds || [];
        if (currentMembers.includes(userId)) return c;
        return { ...c, memberIds: [...currentMembers, userId] };
      })
    }));
  };

  const removeChannelMember = (channelId: string, userId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c => {
        if (c.id !== channelId) return c;
        return { ...c, memberIds: (c.memberIds || []).filter(id => id !== userId) };
      })
    }));
  };

  // --- Project Actions ---

  const addProject = (project: Project) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      projects: [...(prev.projects || []), { ...project, tickets: [] }]
    }));
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      projects: updateById(prev.projects || [], projectId, updates)
    }));
  };

  const deleteProject = (projectId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      projects: removeById(prev.projects || [], projectId)
    }));
  };

  const addProjectUpdate = (projectId: string, update: ProjectUpdate) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? {
        ...p,
        updates: [update, ...(p.updates || [])]
      } : p)
    }));
  };

  // --- Project Ticket Actions ---

  const addProjectTicket = (projectId: string, ticket: Ticket) => {
    if (!campaign) return;
    const finalTicket = normalizeTicketForExecution({
      ...ticket,
      projectId,
      rowType: ticket.rowType === 'TEXT' ? 'TEXT' : 'TASK',
      canvasItemIds: ticket.canvasItemIds || []
    });

    updateCampaignState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === projectId ? {
        ...p,
        tickets: [...(p.tickets || []), finalTicket]
      } : p)
    }));
  };

  const updateProjectTicket = (projectId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === projectId ? {
        ...p,
        tickets: p.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
      } : p)
    }));
  };

  const deleteProjectTicket = (projectId: string, ticketId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      canvasScene: prev.canvasScene
        ? removeTicketLinksFromScene(prev.canvasScene, ticketId)
        : prev.canvasScene,
      projects: prev.projects.map(p => p.id === projectId ? {
        ...p,
        tickets: p.tickets.filter(t => t.id !== ticketId)
      } : p)
    }));
  };

  // --- Channel Ticket Actions ---

  const addTicket = (channelId: string, ticket: Ticket) => {
    if (!campaign) return;
    const shortId = `T-${Math.floor(Math.random() * 1000)}`;
    const finalTicket = normalizeTicketForExecution({
      ...ticket,
      shortId,
      channelId,
      rowType: ticket.rowType === 'TEXT' ? 'TEXT' : 'TASK',
      canvasItemIds: ticket.canvasItemIds || []
    });

    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, tickets: [...c.tickets, finalTicket] } : c
      )
    }));
  };

  const updateTicket = (channelId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      channels: prev.channels.map(c =>
        c.id === channelId ? {
          ...c,
          tickets: c.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
        } : c
      )
    }));
  };

  const deleteTicket = (channelId: string, ticketId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      canvasScene: prev.canvasScene
        ? removeTicketLinksFromScene(prev.canvasScene, ticketId)
        : prev.canvasScene,
      channels: prev.channels.map(c =>
        c.id === channelId ? {
          ...c,
          tickets: c.tickets.filter(t => t.id !== ticketId)
        } : c
      )
    }));
  };

  const getExecutionRows = (): Ticket[] => {
    if (!campaign) return [];
    // Execution view aggregates all ticket containers into one flat working set.
    // Ordering invariant: stable oldest-first by createdAt, then id for deterministic rendering.
    const channelTickets = campaign.channels.flatMap(channel => channel.tickets);
    const projectTickets = campaign.projects.flatMap(project => project.tickets);
    const standaloneTickets = campaign.standaloneTickets || [];
    return [...channelTickets, ...projectTickets, ...standaloneTickets]
      .map(normalizeTicketForExecution)
      .filter(ticket => ticket.rowType === 'TASK')
      .sort((a, b) => {
        const timeDiff = getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });
  };

  const addExecutionRow = (input: AddExecutionRowInput) => {
    if (!campaign) return;
    const now = new Date().toISOString();
    const rowType: ExecutionRowType = input.rowType === 'TEXT' ? 'TEXT' : 'TASK';
    const title = rowType === 'TEXT'
      ? (input.title?.trim() || 'Note')
      : (input.title?.trim() || 'Untitled Task');
    const ticket: Ticket = {
      id: generateId(),
      shortId: `T-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      description: rowType === 'TASK' ? input.description : undefined,
      rowType,
      executionText: rowType === 'TEXT' ? (input.executionText || '') : undefined,
      status: rowType === 'TEXT' ? TicketStatus.Todo : getExecutionSafeStatus(input.status),
      channelId: input.channelId,
      projectId: input.projectId,
      assigneeId: rowType === 'TASK' ? input.assigneeId : undefined,
      priority: input.priority || 'Medium',
      dueDate: rowType === 'TASK' ? input.dueDate : undefined,
      createdAt: now,
      canvasItemIds: []
    };

    if (ticket.channelId) {
      // Resolution order: channel-scoped destination wins when channelId exists.
      addTicket(ticket.channelId, ticket);
      return;
    }
    if (ticket.projectId) {
      // Next resolution path: project-scoped destination.
      addProjectTicket(ticket.projectId, ticket);
      return;
    }

    // Final fallback path: execution-only standalone ticket container.
    updateCampaignState(prev => ({
      ...prev,
      standaloneTickets: [...(prev.standaloneTickets || []), ticket]
    }));
  };

  const updateExecutionRow = (ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;
    // Status sanitization is intentionally conditional.
    // Non-status edits must not remap legacy statuses (Backlog/Canceled) implicitly.
    const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, 'status');

    // Entity resolution order is deterministic:
    // 1) channel tickets -> 2) project tickets -> 3) standalone tickets.
    const channel = campaign.channels.find(c => c.tickets.some(t => t.id === ticketId));
    if (channel) {
      const nextUpdates: Partial<Ticket> = { ...updates };
      if (hasStatusUpdate && nextUpdates.status) nextUpdates.status = getExecutionSafeStatus(nextUpdates.status);
      if (nextUpdates.rowType === 'TEXT') nextUpdates.status = TicketStatus.Todo;
      updateTicket(channel.id, ticketId, nextUpdates);
    } else {
      const project = campaign.projects.find(p => p.tickets.some(t => t.id === ticketId));
      if (project) {
        const nextUpdates: Partial<Ticket> = { ...updates };
        if (hasStatusUpdate && nextUpdates.status) nextUpdates.status = getExecutionSafeStatus(nextUpdates.status);
        if (nextUpdates.rowType === 'TEXT') nextUpdates.status = TicketStatus.Todo;
        updateProjectTicket(project.id, ticketId, nextUpdates);
      } else {
        updateCampaignState(prev => ({
          ...prev,
          standaloneTickets: (prev.standaloneTickets || []).map(ticket => {
            if (ticket.id !== ticketId) return ticket;
            const nextTicket: Ticket = { ...ticket, ...updates };
            if (hasStatusUpdate && nextTicket.status) nextTicket.status = getExecutionSafeStatus(nextTicket.status);
            if (nextTicket.rowType === 'TEXT') nextTicket.status = TicketStatus.Todo;
            return normalizeTicketForExecution(nextTicket);
          })
        }));
      }
    }

    if (updates.canvasItemIds && campaign.canvasScene) {
      // Canvas link sync path:
      // - Remove previous ticket links for this ticket id.
      // - Rebuild with validated container owner ids only.
      const nextOwnerElementIds = toContainerTicketLinkOwnerIds(campaign.canvasScene, updates.canvasItemIds);
      const nonTicketRelations = campaign.canvasScene.relations.filter(
        relation => !(relation.type === 'TICKET_LINK' && relation.toId === ticketId)
      );
      const nextLinks = nextOwnerElementIds.map(elementId => ({
        id: generateId(),
        type: 'TICKET_LINK' as const,
        fromId: elementId,
        toId: ticketId
      }));
      updateCanvasScene({
        ...campaign.canvasScene,
        relations: [...nonTicketRelations, ...nextLinks]
      });
    }
  };

  const deleteExecutionRow = (ticketId: string) => {
    if (!campaign) return;

    const channel = campaign.channels.find(c => c.tickets.some(t => t.id === ticketId));
    if (channel) {
      deleteTicket(channel.id, ticketId);
      return;
    }

    const project = campaign.projects.find(p => p.tickets.some(t => t.id === ticketId));
    if (project) {
      deleteProjectTicket(project.id, ticketId);
      return;
    }

    updateCampaignState(prev => ({
      ...prev,
      canvasScene: prev.canvasScene ? removeTicketLinksFromScene(prev.canvasScene, ticketId) : prev.canvasScene,
      standaloneTickets: (prev.standaloneTickets || []).filter(ticket => ticket.id !== ticketId)
    }));
  };

  // --- Canvas Actions ---

  const updateCanvasScene = (scene: CanvasScene) => {
    if (!campaign) return;
    updateCampaignState(prev => {
      const normalizedScene = migrateCanvasScene(scene);
      const validElementIds = new Set(normalizedScene.elements.map(element => element.id));
      const validTicketIds = new Set<string>();
      prev.channels.forEach(channel => channel.tickets.forEach(ticket => validTicketIds.add(ticket.id)));
      prev.projects.forEach(project => project.tickets.forEach(ticket => validTicketIds.add(ticket.id)));
      (prev.standaloneTickets || []).forEach(ticket => validTicketIds.add(ticket.id));

      const relations = normalizedScene.relations.filter(relation => {
        if (relation.type === 'TICKET_LINK') {
          return validElementIds.has(relation.fromId) && validTicketIds.has(relation.toId);
        }
        return validElementIds.has(relation.fromId) && validElementIds.has(relation.toId);
      });

      const ticketToElements = new Map<string, string[]>();
      relations.forEach(relation => {
        if (relation.type !== 'TICKET_LINK') return;
        const existing = ticketToElements.get(relation.toId) || [];
        if (!existing.includes(relation.fromId)) existing.push(relation.fromId);
        ticketToElements.set(relation.toId, existing);
      });

      const nextChannels = prev.channels.map(channel => ({
        ...channel,
        tickets: channel.tickets.map(ticket => ({
          ...ticket,
          canvasItemIds: ticketToElements.get(ticket.id) || []
        }))
      }));

      const nextProjects = prev.projects.map(project => ({
        ...project,
        tickets: project.tickets.map(ticket => ({
          ...ticket,
          canvasItemIds: ticketToElements.get(ticket.id) || []
        }))
      }));

      const nextStandaloneTickets = (prev.standaloneTickets || []).map(ticket => ({
        ...ticket,
        canvasItemIds: ticketToElements.get(ticket.id) || []
      }));

      return {
        ...prev,
        canvasScene: {
          ...normalizedScene,
          relations
        },
        channels: nextChannels,
        projects: nextProjects,
        standaloneTickets: nextStandaloneTickets
      };
    });
  };

  const getCanvasChildren = (containerId: string): CanvasElement[] => {
    if (!campaign?.canvasScene) return [];
    const childIds = new Set(
      campaign.canvasScene.relations
        .filter(relation => relation.type === 'PARENT' && relation.toId === containerId)
        .map(relation => relation.fromId)
    );
    return campaign.canvasScene.elements.filter(element => childIds.has(element.id));
  };

  const getCanvasTicketLinks = (elementId: string): string[] => {
    if (!campaign?.canvasScene) return [];
    const [ownerId] = toContainerTicketLinkOwnerIds(campaign.canvasScene, [elementId]);
    if (!ownerId) return [];
    return campaign.canvasScene.relations
      .filter(relation => relation.type === 'TICKET_LINK' && relation.fromId === ownerId)
      .map(relation => relation.toId);
  };

  const getCanvasElementsLinkedToTicket = (ticketId: string): string[] => {
    if (!campaign?.canvasScene) return [];
    return campaign.canvasScene.relations
      .filter(relation => relation.type === 'TICKET_LINK' && relation.toId === ticketId)
      .map(relation => relation.fromId);
  };

  // --- AI Import ---

  const importAIPlan = (channelsData: any[]) => {
    if (!campaign) return;
    const newChannels: Channel[] = channelsData.map((c: any) => ({
      id: generateId(),
      name: c.name,
      campaignId: campaign.id,
      tickets: c.tickets.map((t: any) => ({
        id: generateId(),
        shortId: `T-${Math.floor(Math.random() * 1000)}`,
        title: t.title,
        description: t.description,
        rowType: 'TASK',
        status: TicketStatus.Todo,
        channelId: '', // Set in loop below
        priority: 'Medium',
        createdAt: new Date().toISOString(),
        canvasItemIds: []
      })),
      principles: [],
      tags: [],
      links: [],
      notes: [],
      memberIds: []
    }));

    newChannels.forEach(c => {
      c.tickets.forEach(t => t.channelId = c.id);
    });

    updateCampaignState(prev => ({
      ...prev,
      channels: [...prev.channels, ...newChannels]
    }));
  };

  // --- Sample Data ---

  const toggleSampleData = () => {
    if (!campaign) return;

    setCampaignState(prev => {
      if (!prev) return null;
      const sample = prev.sampleData;

      if (!sample || !sample.enabled) {
        const now = new Date();
        const campaignStart = prev.startDate ? new Date(prev.startDate) : now;
        const week1 = new Date(campaignStart);
        week1.setDate(week1.getDate() + 7);
        const week2 = new Date(campaignStart);
        week2.setDate(week2.getDate() + 14);
        const week3 = new Date(campaignStart);
        week3.setDate(week3.getDate() + 21);

        const channelPaidId = generateId();
        const channelLifecycleId = generateId();
        const projectId = generateId();

        const ticketPaid1Id = generateId();
        const ticketPaid2Id = generateId();
        const ticketLifecycleId = generateId();
        const ticketProject1Id = generateId();
        const ticketProject2Id = generateId();

        const tickets: Ticket[] = [
          {
            id: ticketPaid1Id,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: 'Launch prospecting ads',
            description: 'Initial campaign setup and testing.',
            status: TicketStatus.Todo,
            channelId: channelPaidId,
            assigneeId: currentUser.id,
            priority: 'High',
            startDate: campaignStart.toISOString(),
            dueDate: week1.toISOString(),
            createdAt: now.toISOString()
          },
          {
            id: ticketPaid2Id,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: 'Refresh creative tests',
            description: 'New variations for top ads.',
            status: TicketStatus.InProgress,
            channelId: channelPaidId,
            assigneeId: currentUser.id,
            priority: 'Medium',
            startDate: week1.toISOString(),
            dueDate: week2.toISOString(),
            createdAt: now.toISOString()
          },
          {
            id: ticketLifecycleId,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: 'Draft onboarding sequence',
            description: '3-email onboarding flow.',
            status: TicketStatus.Todo,
            channelId: channelLifecycleId,
            assigneeId: currentUser.id,
            priority: 'Medium',
            startDate: campaignStart.toISOString(),
            dueDate: week2.toISOString(),
            createdAt: now.toISOString()
          },
          {
            id: ticketProject1Id,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: 'Rewrite hero section',
            description: 'Improve value prop clarity.',
            status: TicketStatus.InProgress,
            projectId,
            assigneeId: currentUser.id,
            priority: 'High',
            startDate: week1.toISOString(),
            dueDate: week2.toISOString(),
            createdAt: now.toISOString()
          },
          {
            id: ticketProject2Id,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: 'Audit CTA performance',
            description: 'Review click-through trends.',
            status: TicketStatus.Todo,
            projectId,
            assigneeId: currentUser.id,
            priority: 'Low',
            startDate: campaignStart.toISOString(),
            dueDate: week1.toISOString(),
            createdAt: now.toISOString()
          }
        ];

        const channels: Channel[] = [
          {
            id: channelPaidId,
            name: 'Paid Social',
            campaignId: prev.id,
            tickets: tickets.filter(t => t.channelId === channelPaidId),
            principles: [],
            tags: ['Outbound'],
            links: [],
            notes: [],
            memberIds: []
          },
          {
            id: channelLifecycleId,
            name: 'Lifecycle',
            campaignId: prev.id,
            tickets: tickets.filter(t => t.channelId === channelLifecycleId),
            principles: [],
            tags: ['Inbound'],
            links: [],
            notes: [],
            memberIds: []
          }
        ];

        const projects: Project[] = [
          {
            id: projectId,
            name: 'Website Refresh',
            description: 'Improve landing page conversion rate.',
            status: 'On Track',
            priority: 'High',
            startDate: campaignStart.toISOString(),
            targetDate: week3.toISOString(),
            updates: [],
            tickets: tickets.filter(t => t.projectId === projectId)
          }
        ];

        return {
          ...prev,
          channels: [...prev.channels, ...channels],
          projects: [...prev.projects, ...projects],
          sampleData: {
            enabled: true,
            channelIds: [channelPaidId, channelLifecycleId],
            projectIds: [projectId],
            ticketIds: [
              ticketPaid1Id,
              ticketPaid2Id,
              ticketLifecycleId,
              ticketProject1Id,
              ticketProject2Id
            ]
          }
        };
      }

      const removeChannelIds = new Set(sample.channelIds);
      const removeProjectIds = new Set(sample.projectIds);
      const removeTicketIds = new Set(sample.ticketIds);

      const channels = prev.channels
        .filter(c => !removeChannelIds.has(c.id))
        .map(c => ({
          ...c,
          tickets: c.tickets.filter(t => !removeTicketIds.has(t.id))
        }));

      const projects = prev.projects
        .filter(p => !removeProjectIds.has(p.id))
        .map(p => ({
          ...p,
          tickets: p.tickets.filter(t => !removeTicketIds.has(t.id))
        }));

      return {
        ...prev,
        channels,
        projects,
        sampleData: undefined
      };
    });
  };

  const switchUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const reset = () => {
    setCampaignState(null);
  };

  return (
    <StoreContext.Provider value={{
      currentView,
      setCurrentView,
      campaign,
      users,
      currentUser,
      setCampaign,
      updateCampaign,
      addUser,
      removeUser,
      updateUser,
      addChannel,
      updateChannel,
      deleteChannel,
      updateChannelPlan,
      addChannelPrinciple,
      deleteChannelPrinciple,
      addChannelLink,
      removeChannelLink,
      addChannelNote,
      deleteChannelNote,
      addChannelMember,
      removeChannelMember,
      addProject,
      updateProject,
      deleteProject,
      addProjectUpdate,
      addProjectTicket,
      updateProjectTicket,
      deleteProjectTicket,
      addTicket,
      updateTicket,
      deleteTicket,
      getExecutionRows,
      addExecutionRow,
      updateExecutionRow,
      deleteExecutionRow,
      updateCanvasScene,
      getCanvasChildren,
      getCanvasTicketLinks,
      getCanvasElementsLinkedToTicket,
      importAIPlan,
      switchUser,
      reset,
      toggleSampleData
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};



