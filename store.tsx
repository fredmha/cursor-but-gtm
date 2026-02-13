
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Campaign, Channel, Ticket, TicketStatus, Status, User, Priority, RoadmapItem, Project, ProjectUpdate, ChannelLink, ChannelNote, TimelineTag, ChannelPlan, ContextDoc, DocFolder, ViewMode, Role, ChatMessage, CanvasScene, CanvasElement, CanvasRelation, ExecutionRowType, CanvasEmailTemplate, CanvasEmailBlock, EmailBlockType, EmailBlockAlign } from './types';

// --- Constants ---

const STORAGE_KEYS = {
  campaign: 'gtm-os-campaign',
  users: 'gtm-os-users'
} as const;

const ORDER_STEP = 1000;
const ROOT_KEY = '__root__';
const RECENT_DOC_LIMIT = 25;
const DEFAULT_FOLDER_ICON = '\u{1F4C1}';

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

const DOC_SHORT_ID_PREFIX = 'D-';

const generateDocShortId = (existing: Set<string>): string => {
  let next = '';
  do {
    next = `${DOC_SHORT_ID_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existing.has(next));
  existing.add(next);
  return next;
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

const normalizeOrdering = <T extends { id: string; order?: number }>(
  items: T[],
  getParentId: (item: T) => string | undefined,
  getTimestampValue: (item: T) => string | undefined
): T[] => {
  const cloned = items.map(item => ({ ...item }));
  const grouped = new Map<string, T[]>();

  cloned.forEach(item => {
    const key = getParentId(item) || ROOT_KEY;
    const group = grouped.get(key) || [];
    group.push(item);
    grouped.set(key, group);
  });

  grouped.forEach(group => {
    group.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const at = getTimestamp(getTimestampValue(a));
      const bt = getTimestamp(getTimestampValue(b));
      return at - bt;
    });

    let nextOrder = ORDER_STEP;
    group.forEach(item => {
      if (item.order === undefined || Number.isNaN(item.order)) {
        item.order = nextOrder;
      }
      nextOrder = (item.order || nextOrder) + ORDER_STEP;
    });
  });

  return cloned;
};

const normalizeCanvasElement = (element: any): CanvasElement => ({
  id: typeof element?.id === 'string' ? element.id : generateId(),
  kind: element?.kind === 'CONTAINER' ? 'CONTAINER' : 'EMAIL_CARD',
  x: parseCanvasNumber(element?.x) ?? 0,
  y: parseCanvasNumber(element?.y) ?? 0,
  width: Math.max(
    40,
    parseCanvasNumber(element?.width) ?? (element?.kind === 'CONTAINER' ? 520 : 320)
  ),
  height: Math.max(
    30,
    parseCanvasNumber(element?.height) ?? (element?.kind === 'CONTAINER' ? 380 : 180)
  ),
  zIndex: parseCanvasNumber(element?.zIndex) ?? 0,
  text: typeof element?.text === 'string' ? element.text : '',
  style: element?.style && typeof element.style === 'object' ? element.style : undefined,
  emailTemplate: normalizeEmailTemplate(element?.emailTemplate)
});

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

const EMAIL_BLOCK_TYPES: EmailBlockType[] = ['H1', 'H2', 'BODY', 'IMAGE'];
const EMAIL_BLOCK_ALIGNMENTS: EmailBlockAlign[] = ['left', 'center', 'right'];

const getDefaultBlockLayout = (type: EmailBlockType): Required<Pick<CanvasEmailBlock, 'heightPx' | 'fontSizePx' | 'paddingY' | 'paddingX' | 'marginBottomPx'>> => {
  if (type === 'H1') return { heightPx: 56, fontSizePx: 30, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (type === 'H2') return { heightPx: 46, fontSizePx: 24, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (type === 'IMAGE') return { heightPx: 140, fontSizePx: 14, paddingY: 6, paddingX: 6, marginBottomPx: 10 };
  return { heightPx: 84, fontSizePx: 16, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
};

const normalizeEmailBlock = (rawBlock: unknown): CanvasEmailBlock | null => {
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

  return {
    id: typeof block.id === 'string' ? block.id : generateId(),
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

const normalizeEmailTemplate = (rawTemplate: unknown): CanvasEmailTemplate | undefined => {
  if (!rawTemplate || typeof rawTemplate !== 'object') return undefined;
  const template = rawTemplate as Record<string, unknown>;
  const rawBlocks = Array.isArray(template.blocks) ? template.blocks : [];
  const blocks = rawBlocks
    .map(normalizeEmailBlock)
    .filter((block): block is CanvasEmailBlock => block !== null);
  if (blocks.length === 0) return undefined;
  return {
    version: 1,
    blocks
  };
};

const normalizeCanvasViewport = (viewport: any): CanvasScene['viewport'] => ({
  x: Number(viewport?.x) || 0,
  y: Number(viewport?.y) || 0,
  zoom: Number(viewport?.zoom) || 1
});

const normalizeCanvasRelation = (relation: any): CanvasRelation | null => {
  if (!relation || typeof relation !== 'object') return null;
  if (relation.type !== 'PARENT' && relation.type !== 'TICKET_LINK' && relation.type !== 'EDGE') return null;
  const fromId = typeof relation.fromId === 'string' ? relation.fromId : '';
  const toId = typeof relation.toId === 'string' ? relation.toId : '';
  if (!fromId || !toId) return null;
  return {
    id: typeof relation.id === 'string' ? relation.id : generateId(),
    type: relation.type,
    fromId,
    toId,
    meta: relation.meta && typeof relation.meta === 'object' ? relation.meta : undefined
  };
};

const migrateCanvasScene = (rawScene: any): CanvasScene => {
  if (!rawScene || typeof rawScene !== 'object') return createDefaultCanvasScene();

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
  const normalized = legacyItems.map((item: any) => {
    const element = normalizeCanvasElement(item);
    return {
      element,
      legacyParentId: typeof item?.parentId === 'string' ? item.parentId : undefined,
      legacyTicketIds: Array.isArray(item?.ticketIds) ? item.ticketIds.filter((id: unknown) => typeof id === 'string') as string[] : []
    };
  });

  const idMap = new Map<string, string>();
  normalized.forEach(({ element }, index) => {
    const legacyId = typeof legacyItems[index]?.id === 'string' ? legacyItems[index].id : element.id;
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

  linkDocToTicket: (docId: string, ticketId: string, channelId?: string, projectId?: string) => void;

  addRoadmapItem: (item: RoadmapItem) => void;
  updateRoadmapItem: (itemId: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (itemId: string) => void;
  moveRoadmapItem: (itemId: string, newChannelId: string, newWeekIndex: number) => void;

  addTimelineTag: (tag: TimelineTag) => void;
  deleteTimelineTag: (tagId: string) => void;

  addDocFolder: (name: string, icon?: string, parentId?: string, order?: number) => void;
  updateDocFolder: (folderId: string, updates: Partial<DocFolder>) => void;
  renameDocFolder: (folderId: string, name: string) => void;
  moveDocFolder: (folderId: string, parentId: string | undefined, order?: number) => void;
  deleteDocFolder: (folderId: string) => void;
  toggleRagIndexing: (type: 'DOC' | 'FOLDER', id: string, isIndexed: boolean) => void;
  toggleDocFavorite: (docId: string, value?: boolean) => void;
  toggleFolderFavorite: (folderId: string, value?: boolean) => void;
  recordRecentDoc: (docId: string) => void;

  addDoc: (doc: ContextDoc) => void;
  updateDoc: (docId: string, updates: Partial<ContextDoc>) => void;
  deleteDoc: (docId: string) => void;
  moveDoc: (docId: string, folderId: string | undefined, order?: number) => void;

  updateCanvasScene: (scene: CanvasScene) => void;
  getCanvasChildren: (containerId: string) => CanvasElement[];
  getCanvasTicketLinks: (elementId: string) => string[];
  getCanvasElementsLinkedToTicket: (ticketId: string) => string[];

  addCampaignTag: (tag: string) => void;

  importAIPlan: (channelsData: any[]) => void;
  switchUser: (userId: string) => void;
  reset: () => void;
  toggleSampleData: () => void;

  // Agent / Review Actions
  updateChatHistory: (mode: 'DAILY' | 'WEEKLY', messages: ChatMessage[]) => void;
  completeReviewSession: (mode: 'DAILY' | 'WEEKLY') => void;

  // Flow State
  pendingTicketLink: string | null;
  initiateDocCreationForTicket: (ticketId: string) => void;
  clearPendingTicketLink: () => void;
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
  const [currentView, setCurrentView] = useState<ViewMode>('ROADMAP');
  const [pendingTicketLink, setPendingTicketLink] = useState<string | null>(null);

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
        tickets: (c.tickets || []).map((t: any) => ({
          ...t,
          rowType: t.rowType === 'TEXT' ? 'TEXT' : 'TASK',
          canvasItemIds: Array.isArray(t.canvasItemIds) ? t.canvasItemIds : []
        }))
      }));
    }

    if (!data.projects) {
      data.projects = [];
    } else {
      data.projects = data.projects.map((p: any) => ({
        ...p,
        tickets: (p.tickets || []).map((t: any) => ({
          ...t,
          rowType: t.rowType === 'TEXT' ? 'TEXT' : 'TASK',
          canvasItemIds: Array.isArray(t.canvasItemIds) ? t.canvasItemIds : []
        }))
      }));
    }

    data.standaloneTickets = (data.standaloneTickets || []).map((t: any) => ({
      ...t,
      rowType: t.rowType === 'TEXT' ? 'TEXT' : 'TASK',
      canvasItemIds: Array.isArray(t.canvasItemIds) ? t.canvasItemIds : []
    }));

    if (!data.timelineTags) data.timelineTags = [];
    if (!data.docs) data.docs = [];

    const ORDER_STEP = 1000;
    const ROOT_KEY = '__root__';

    const normalizeOrdering = <T extends { id: string; order?: number }>(
      items: T[],
      getParentId: (item: T) => string | undefined,
      getTimestamp: (item: T) => string | undefined
    ): T[] => {
      const cloned = items.map(item => ({ ...item }));
      const grouped = new Map<string, T[]>();

      cloned.forEach(item => {
        const key = getParentId(item) || ROOT_KEY;
        const group = grouped.get(key) || [];
        group.push(item);
        grouped.set(key, group);
      });

      grouped.forEach(group => {
        group.sort((a, b) => {
          const ao = a.order ?? Number.POSITIVE_INFINITY;
          const bo = b.order ?? Number.POSITIVE_INFINITY;
          if (ao !== bo) return ao - bo;
          const at = new Date(getTimestamp(a) || 0).getTime();
          const bt = new Date(getTimestamp(b) || 0).getTime();
          return at - bt;
        });

        let nextOrder = ORDER_STEP;
        group.forEach(item => {
          if (item.order === undefined || Number.isNaN(item.order)) {
            item.order = nextOrder;
          }
          nextOrder = (item.order || nextOrder) + ORDER_STEP;
        });
      });

      return cloned;
    };

    // Folder Migration
    if (!data.docFolders) {
      data.docFolders = [];
    } else {
      // Ensure icons exist if migrating from old version
      data.docFolders = data.docFolders.map((f: any) => ({
        ...f,
        icon: f.icon || DEFAULT_FOLDER_ICON
      }));
    }

    data.docFolders = (data.docFolders || []).map((f: any) => ({
      ...f,
      icon: f.icon || DEFAULT_FOLDER_ICON,
      isArchived: !!f.isArchived,
      isFavorite: !!f.isFavorite
    }));

    const docShortIds = new Set<string>();
    data.docs = (data.docs || []).map((d: any) => {
      const candidate = typeof d.shortId === 'string' ? d.shortId : '';
      let shortId = candidate;
      if (!shortId || docShortIds.has(shortId)) {
        shortId = generateDocShortId(docShortIds);
      } else {
        docShortIds.add(shortId);
      }

      return {
        ...d,
        shortId,
        isArchived: !!d.isArchived,
        isFavorite: !!d.isFavorite
      };
    });

    data.docFolders = normalizeOrdering(data.docFolders, f => f.parentId, f => f.createdAt);
    data.docs = normalizeOrdering(data.docs, d => d.folderId, d => d.createdAt || d.lastUpdated);

    if (!data.recentDocIds) {
      data.recentDocIds = [];
    }
    if (!data.availableTags) {
      data.availableTags = [];
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

  const updateRecentDocs = (docId: string, recentDocIds?: string[]) => {
    const existing = (recentDocIds || []).filter(id => id !== docId);
    return [docId, ...existing].slice(0, RECENT_DOC_LIMIT);
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
    const newChannels = campaign.channels.filter(c => c.id !== channelId);
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.channelId !== channelId);

    updateCampaignState(prev => ({
      ...prev,
      channels: newChannels,
      roadmapItems: newRoadmapItems
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
      projects: removeById(prev.projects || [], projectId),
      roadmapItems: (prev.roadmapItems || []).filter(i => i.projectId !== projectId)
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

    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const finalTicket = normalizeTicketForExecution({
      ...ticket,
      projectId,
      rowType: ticket.rowType === 'TEXT' ? 'TEXT' : 'TASK',
      canvasItemIds: ticket.canvasItemIds || []
    });

    if (!finalTicket.roadmapItemId) {
      const newItemId = generateId();
      finalTicket.roadmapItemId = newItemId;

      const newItem: RoadmapItem = {
        id: newItemId,
        channelId: undefined,
        weekIndex: -1, // Unscheduled by default
        durationWeeks: 1,
        title: ticket.title,
        description: ticket.description,
        type: 'CONTENT',
        ticketId: finalTicket.id,
        projectId: projectId,
        status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
        ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
        priority: ticket.priority,
        label: 'Task',
        startDate: ticket.startDate,
        endDate: ticket.dueDate
      };
      if (ticket.startDate && campaign.startDate) {
        const start = new Date(ticket.startDate);
        const campStart = new Date(campaign.startDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(campStart.getTime())) {
          newItem.weekIndex = Math.floor((start.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
        }
      }
      if (ticket.startDate && ticket.dueDate) {
        const start = new Date(ticket.startDate);
        const end = new Date(ticket.dueDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          newItem.durationWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)));
        }
      }
      newRoadmapItems.push(newItem);
    }

    updateCampaignState(prev => ({
      ...prev,
      roadmapItems: newRoadmapItems,
      projects: prev.projects.map(p => p.id === projectId ? {
        ...p,
        tickets: [...(p.tickets || []), finalTicket]
      } : p)
    }));
  };

  const updateProjectTicket = (projectId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;

    setCampaignState(prev => {
      if (!prev) return null;

      let newRoadmapItems = [...(prev.roadmapItems || [])];
      const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);

      if (rItemIndex !== -1) {
        const rItem = newRoadmapItems[rItemIndex];
        let updatedRItem = { ...rItem };
        let changed = false;

        if (updates.status) {
          if (updates.status === TicketStatus.Done) {
            updatedRItem.status = Status.Completed;
            changed = true;
          } else if (rItem.status === Status.Completed) {
            updatedRItem.status = Status.Active;
            changed = true;
          }
        }
        if (updates.title) {
          updatedRItem.title = updates.title;
          changed = true;
        }
        if (updates.assigneeId) {
          updatedRItem.ownerIds = [updates.assigneeId];
          changed = true;
        }

        // Sync Dates
        if (Object.prototype.hasOwnProperty.call(updates, 'startDate')) {
          updatedRItem.startDate = updates.startDate;
          if (updates.startDate && prev.startDate) {
            const start = new Date(updates.startDate);
            const campStart = new Date(prev.startDate);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(campStart.getTime())) {
              updatedRItem.weekIndex = Math.floor((start.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
            }
          } else if (!updates.startDate) {
            updatedRItem.weekIndex = -1;
          }
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
          updatedRItem.endDate = updates.dueDate;
          if (updatedRItem.startDate && updates.dueDate) {
            const start = new Date(updatedRItem.startDate);
            const end = new Date(updates.dueDate);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
              updatedRItem.durationWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)));
            }
          }
          changed = true;
        }

        if (changed) newRoadmapItems[rItemIndex] = updatedRItem;
      }

      return {
        ...prev,
        roadmapItems: newRoadmapItems,
        projects: prev.projects.map(p => p.id === projectId ? {
          ...p,
          tickets: p.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
        } : p)
      };
    });
  };

  const deleteProjectTicket = (projectId: string, ticketId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      canvasScene: prev.canvasScene
        ? removeTicketLinksFromScene(prev.canvasScene, ticketId)
        : prev.canvasScene,
      roadmapItems: prev.roadmapItems.filter(i => i.ticketId !== ticketId),
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

    let newRoadmapItems = [...(campaign.roadmapItems || [])];

    if (!finalTicket.roadmapItemId) {
      const newItemId = generateId();
      finalTicket.roadmapItemId = newItemId;

      const newItem: RoadmapItem = {
        id: newItemId,
        channelId: channelId,
        weekIndex: -1, // Unscheduled by default
        durationWeeks: 1,
        title: ticket.title,
        description: ticket.description,
        type: 'CONTENT',
        ticketId: finalTicket.id,
        projectId: ticket.projectId,
        status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
        ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
        priority: ticket.priority,
        label: 'Task',
        startDate: ticket.startDate,
        endDate: ticket.dueDate
      };
      if (ticket.startDate && campaign.startDate) {
        const start = new Date(ticket.startDate);
        const campStart = new Date(campaign.startDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(campStart.getTime())) {
          newItem.weekIndex = Math.floor((start.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
        }
      }
      if (ticket.startDate && ticket.dueDate) {
        const start = new Date(ticket.startDate);
        const end = new Date(ticket.dueDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          newItem.durationWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)));
        }
      }
      newRoadmapItems.push(newItem);
    }

    updateCampaignState(prev => ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c =>
        c.id === channelId ? { ...c, tickets: [...c.tickets, finalTicket] } : c
      )
    }));
  };

  const updateTicket = (channelId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;

    setCampaignState(prev => {
      if (!prev) return null;

      let newRoadmapItems = [...(prev.roadmapItems || [])];
      const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);

      if (rItemIndex !== -1) {
        const rItem = newRoadmapItems[rItemIndex];
        let updatedRItem = { ...rItem };
        let changed = false;

        if (updates.status) {
          if (updates.status === TicketStatus.Done) {
            updatedRItem.status = Status.Completed;
            changed = true;
          } else if (rItem.status === Status.Completed) {
            updatedRItem.status = Status.Active;
            changed = true;
          }
        }
        if (updates.title) {
          updatedRItem.title = updates.title;
          changed = true;
        }
        if (updates.assigneeId) {
          updatedRItem.ownerIds = [updates.assigneeId];
          changed = true;
        }

        // Sync Dates
        if (Object.prototype.hasOwnProperty.call(updates, 'startDate')) {
          updatedRItem.startDate = updates.startDate;
          if (updates.startDate && prev.startDate) {
            const start = new Date(updates.startDate);
            const campStart = new Date(prev.startDate);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(campStart.getTime())) {
              updatedRItem.weekIndex = Math.floor((start.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
            }
          } else if (!updates.startDate) {
            updatedRItem.weekIndex = -1;
          }
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
          updatedRItem.endDate = updates.dueDate;
          if (updatedRItem.startDate && updates.dueDate) {
            const start = new Date(updatedRItem.startDate);
            const end = new Date(updates.dueDate);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
              updatedRItem.durationWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)));
            }
          }
          changed = true;
        }

        if (changed) newRoadmapItems[rItemIndex] = updatedRItem;
      }

      return {
        ...prev,
        roadmapItems: newRoadmapItems,
        channels: prev.channels.map(c =>
          c.id === channelId ? {
            ...c,
            tickets: c.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
          } : c
        )
      };
    });
  };

  const deleteTicket = (channelId: string, ticketId: string) => {
    if (!campaign) return;
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.ticketId !== ticketId);

    updateCampaignState(prev => ({
      ...prev,
      canvasScene: prev.canvasScene
        ? removeTicketLinksFromScene(prev.canvasScene, ticketId)
        : prev.canvasScene,
      roadmapItems: newRoadmapItems,
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
      // - Rebuild with validated element ids only.
      const allowedElementIds = new Set(campaign.canvasScene.elements.map(element => element.id));
      const nextElementIds = updates.canvasItemIds.filter(id => allowedElementIds.has(id));
      const nonTicketRelations = campaign.canvasScene.relations.filter(
        relation => !(relation.type === 'TICKET_LINK' && relation.toId === ticketId)
      );
      const nextLinks = nextElementIds.map(elementId => ({
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

  // --- Ticket Linking ---

  const linkDocToTicket = (docId: string, ticketId: string, channelId?: string, projectId?: string) => {
    if (channelId) {
      const channel = campaign?.channels.find(c => c.id === channelId);
      const ticket = channel?.tickets.find(t => t.id === ticketId);
      if (ticket) {
        const currentDocs = ticket.linkedDocIds || [];
        if (!currentDocs.includes(docId)) {
          updateTicket(channelId, ticketId, { linkedDocIds: [...currentDocs, docId] });
        }
      }
    } else if (projectId) {
      const project = campaign?.projects.find(p => p.id === projectId);
      const ticket = project?.tickets.find(t => t.id === ticketId);
      if (ticket) {
        const currentDocs = ticket.linkedDocIds || [];
        if (!currentDocs.includes(docId)) {
          updateProjectTicket(projectId, ticketId, { linkedDocIds: [...currentDocs, docId] });
        }
      }
    }
  };

  // --- Roadmap Actions ---

  const addRoadmapItem = (item: RoadmapItem) => {
    if (!campaign) return;
    let newItem = { ...item };

    // Direct Channel Link (Create Ticket)
    if (newItem.channelId && !newItem.ticketId) {
      const ticketId = generateId();
      const ticket: Ticket = {
        id: ticketId,
        shortId: `T-${Math.floor(Math.random() * 10000)}`,
        title: newItem.title,
        description: newItem.description,
        rowType: 'TASK',
        status: TicketStatus.Todo,
        channelId: newItem.channelId,
        projectId: newItem.projectId,
        roadmapItemId: newItem.id,
        assigneeId: newItem.ownerIds?.[0],
        priority: newItem.priority || 'Medium',
        createdAt: new Date().toISOString(),
        canvasItemIds: []
      };

      newItem.ticketId = ticketId;

      setCampaignState(prev => {
        if (!prev) return null;
        const newChannels = prev.channels.map(c =>
          c.id === newItem.channelId ? { ...c, tickets: [...c.tickets, ticket] } : c
        );
        return {
          ...prev,
          channels: newChannels,
          roadmapItems: [...(prev.roadmapItems || []), newItem]
        };
      });
      return;
    }
    // Direct Project Link (Create Project Ticket)
    else if (newItem.projectId && !newItem.channelId && !newItem.ticketId) {
      const ticketId = generateId();
      const ticket: Ticket = {
        id: ticketId,
        shortId: `T-${Math.floor(Math.random() * 10000)}`,
        title: newItem.title,
        description: newItem.description,
        rowType: 'TASK',
        status: TicketStatus.Todo,
        projectId: newItem.projectId,
        roadmapItemId: newItem.id,
        assigneeId: newItem.ownerIds?.[0],
        priority: newItem.priority || 'Medium',
        createdAt: new Date().toISOString(),
        canvasItemIds: []
      };
      newItem.ticketId = ticketId;

      updateCampaignState(prev => ({
        ...prev,
        roadmapItems: [...(prev.roadmapItems || []), newItem],
        projects: prev.projects.map(p => p.id === newItem.projectId ? {
          ...p,
          tickets: [...(p.tickets || []), ticket]
        } : p)
      }));
      return;
    }

    updateCampaignState(prev => ({
      ...prev,
      roadmapItems: [...(prev.roadmapItems || []), newItem]
    }));
  };

  const updateRoadmapItem = (itemId: string, updates: Partial<RoadmapItem>) => {
    if (!campaign) return;
    setCampaignState(prev => {
      if (!prev) return null;

      const item = prev.roadmapItems.find(i => i.id === itemId);
      if (!item) return prev;

      let finalUpdates = { ...updates };

      // If dates changed, update grid logic
      if (updates.startDate || updates.endDate) {
        const start = updates.startDate || item.startDate;
        const end = updates.endDate || item.endDate;

        if (start && prev.startDate) {
          const sDate = new Date(start);
          const campStart = new Date(prev.startDate);
          finalUpdates.weekIndex = Math.floor((sDate.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
        }
        if (start && end) {
          const sDate = new Date(start);
          const eDate = new Date(end);
          finalUpdates.durationWeeks = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
        }
      } else if (updates.weekIndex !== undefined && updates.weekIndex >= 0 && updates.weekIndex !== item.weekIndex && prev.startDate) {
        // If weekIndex changed (dragging)
        const campStart = new Date(prev.startDate);

        if (item.startDate) {
          const oldStart = new Date(item.startDate);
          // Calculate the day of the week offset within the week
          const daysIntoWeek = Math.floor((oldStart.getTime() - campStart.getTime()) / (24 * 60 * 60 * 1000)) % 7;

          const newStart = new Date(campStart);
          newStart.setDate(newStart.getDate() + (updates.weekIndex * 7) + daysIntoWeek);
          finalUpdates.startDate = newStart.toISOString();

          if (item.endDate) {
            const oldEnd = new Date(item.endDate);
            const duration = oldEnd.getTime() - oldStart.getTime();
            const newEnd = new Date(newStart.getTime() + duration);
            finalUpdates.endDate = newEnd.toISOString();
          }
        } else {
          // First time scheduling: start on Monday of that week
          const newStart = new Date(campStart);
          newStart.setDate(newStart.getDate() + (updates.weekIndex * 7));
          finalUpdates.startDate = newStart.toISOString();

          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + ((item.durationWeeks || 1) * 7));
          finalUpdates.endDate = newEnd.toISOString();
        }
      }

      // Keep Ticket in sync
      const newChannels = prev.channels.map(c => ({
        ...c,
        tickets: c.tickets.map(t => {
          if (t.roadmapItemId !== itemId) return t;
          const ticketUpdates: any = {};
          if (finalUpdates.title) ticketUpdates.title = finalUpdates.title;
          if (finalUpdates.startDate) ticketUpdates.startDate = finalUpdates.startDate;
          if (finalUpdates.endDate) ticketUpdates.dueDate = finalUpdates.endDate;
          if (finalUpdates.ownerIds) ticketUpdates.assigneeId = finalUpdates.ownerIds[0];
          return { ...t, ...ticketUpdates };
        })
      }));

      const newProjects = prev.projects.map(p => ({
        ...p,
        tickets: p.tickets.map(t => {
          if (t.roadmapItemId !== itemId) return t;
          const ticketUpdates: any = {};
          if (finalUpdates.title) ticketUpdates.title = finalUpdates.title;
          if (finalUpdates.startDate) ticketUpdates.startDate = finalUpdates.startDate;
          if (finalUpdates.endDate) ticketUpdates.dueDate = finalUpdates.endDate;
          if (finalUpdates.ownerIds) ticketUpdates.assigneeId = finalUpdates.ownerIds[0];
          return { ...t, ...ticketUpdates };
        })
      }));

      return {
        ...prev,
        channels: newChannels,
        projects: newProjects,
        roadmapItems: prev.roadmapItems.map(i => i.id === itemId ? { ...i, ...finalUpdates } : i)
      };
    });
  };

  const moveRoadmapItem = (itemId: string, newChannelId: string, newWeekIndex: number) => {
    updateRoadmapItem(itemId, { channelId: newChannelId, weekIndex: newWeekIndex });
  };

  const deleteRoadmapItem = (itemId: string) => {
    if (!campaign) return;
    const item = campaign.roadmapItems.find(i => i.id === itemId);
    let newChannels = [...campaign.channels];
    let newProjects = [...campaign.projects];

    if (item && item.ticketId) {
      if (item.channelId) {
        newChannels = newChannels.map(c => ({
          ...c,
          tickets: c.tickets.filter(t => t.id !== item.ticketId)
        }));
      } else if (item.projectId) {
        newProjects = newProjects.map(p => ({
          ...p,
          tickets: p.tickets.filter(t => t.id !== item.ticketId)
        }));
      }
    }

    updateCampaignState(prev => ({
      ...prev,
      channels: newChannels,
      projects: newProjects,
      roadmapItems: (prev.roadmapItems || []).filter(i => i.id !== itemId)
    }));
  };

  // --- Timeline Actions ---

  const addTimelineTag = (tag: TimelineTag) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      timelineTags: [...(prev.timelineTags || []), tag]
    }));
  };

  const deleteTimelineTag = (tagId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      timelineTags: (prev.timelineTags || []).filter(t => t.id !== tagId)
    }));
  };

  // --- Docs & Folder Helpers ---

  const sortByOrder = <T extends { order?: number; createdAt?: string; lastUpdated?: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const at = new Date(a.createdAt || a.lastUpdated || 0).getTime();
      const bt = new Date(b.createdAt || b.lastUpdated || 0).getTime();
      return at - bt;
    });
  };

  const getNextOrder = <T extends { order?: number }>(items: T[]): number => {
    const maxOrder = items.reduce((max, item) => Math.max(max, item.order ?? 0), 0);
    return maxOrder + ORDER_STEP;
  };

  const getSiblingFolders = (allFolders: DocFolder[], parentId: string | undefined, excludeId?: string) => {
    const siblings = allFolders.filter(f => f.parentId === parentId && !f.isArchived && f.id !== excludeId);
    return sortByOrder(siblings);
  };

  const getSiblingDocs = (allDocs: ContextDoc[], folderId: string | undefined, excludeId?: string) => {
    const siblings = allDocs.filter(d => d.folderId === folderId && !d.isArchived && d.id !== excludeId);
    return sortByOrder(siblings);
  };

  const isFolderDescendant = (folders: DocFolder[], startId: string | undefined, searchId: string): boolean => {
    if (!startId) return false;
    let current = folders.find(f => f.id === startId);
    while (current?.parentId) {
      if (current.parentId === searchId) return true;
      current = folders.find(f => f.id === current?.parentId);
    }
    return false;
  };

  // --- Docs & Folder Actions ---

  const addDocFolder = (name: string, icon: string = DEFAULT_FOLDER_ICON, parentId?: string, order?: number) => {
    if (!campaign) return;
    const now = new Date().toISOString();

    updateCampaignState(prev => {
      const siblings = getSiblingFolders(prev.docFolders, parentId);
      const resolvedOrder = order ?? getNextOrder(siblings);

      const folder: DocFolder = {
        id: generateId(),
        name,
        icon,
        parentId,
        order: resolvedOrder,
        isArchived: false,
        isFavorite: false,
        createdAt: now
      };

      return {
        ...prev,
        docFolders: [...prev.docFolders, folder]
      };
    });
  };

  const moveDocFolder = (folderId: string, parentId: string | undefined, order?: number) => {
    if (!campaign) return;

    updateCampaignState(prev => {
      if (parentId === folderId || isFolderDescendant(prev.docFolders, parentId, folderId)) {
        console.error('Cannot move a folder into itself or its descendants.');
        return prev;
      }

      const siblings = getSiblingFolders(prev.docFolders, parentId, folderId);
      const resolvedOrder = order ?? getNextOrder(siblings);

      return {
        ...prev,
        docFolders: prev.docFolders.map(f =>
          f.id === folderId ? { ...f, parentId, order: resolvedOrder } : f
        )
      };
    });
  };

  const updateDocFolder = (folderId: string, updates: Partial<DocFolder>) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      docFolders: updateById(prev.docFolders, folderId, updates)
    }));
  };

  const deleteDocFolder = (folderId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => {
      const folder = prev.docFolders.find(f => f.id === folderId);
      const parentId = folder?.parentId;

      return {
        ...prev,
        docFolders: prev.docFolders.filter(f => f.id !== folderId).map(f =>
          f.parentId === folderId ? { ...f, parentId } : f
        ),
        docs: prev.docs.map(d => d.folderId === folderId ? { ...d, folderId: parentId } : d)
      };
    });
  };

  const toggleRagIndexing = (type: 'DOC' | 'FOLDER', id: string, isIndexed: boolean) => {
    if (!campaign) return;
    if (type === 'DOC') {
      updateDoc(id, { isRagIndexed: isIndexed });
    } else {
      updateDocFolder(id, { isRagIndexed: isIndexed });
    }
  };

  const toggleDocFavorite = (docId: string, value?: boolean) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      docs: prev.docs.map(d => d.id === docId ? { ...d, isFavorite: value ?? !d.isFavorite } : d)
    }));
  };

  const toggleFolderFavorite = (folderId: string, value?: boolean) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      docFolders: prev.docFolders.map(f => f.id === folderId ? { ...f, isFavorite: value ?? !f.isFavorite } : f)
    }));
  };

  const recordRecentDoc = (docId: string) => {
    if (!campaign) return;
    setCampaignState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        recentDocIds: updateRecentDocs(docId, prev.recentDocIds)
      };
    });
  };

  // --- Doc Actions ---

  const addDoc = (doc: ContextDoc) => {
    if (!campaign) return;

    updateCampaignState(prev => {
      const now = new Date().toISOString();
      const folderId = doc.folderId;
      const siblings = getSiblingDocs(prev.docs, folderId);
      const resolvedOrder = doc.order ?? getNextOrder(siblings);
      const existingShortIds = new Set(prev.docs.map(d => d.shortId).filter((id): id is string => !!id));
      let shortId = doc.shortId;
      if (!shortId || existingShortIds.has(shortId)) {
        shortId = generateDocShortId(existingShortIds);
      }

      const docWithMeta: ContextDoc = {
        ...doc,
        shortId,
        order: resolvedOrder,
        isArchived: doc.isArchived ?? false,
        isFavorite: doc.isFavorite ?? false,
        createdBy: doc.createdBy || currentUser.id,
        createdAt: doc.createdAt || now,
        lastEditedBy: currentUser.id,
        lastUpdated: doc.lastUpdated || now
      };

      return {
        ...prev,
        docs: [...prev.docs, docWithMeta],
        recentDocIds: updateRecentDocs(docWithMeta.id, prev.recentDocIds)
      };
    });
  };

  const updateDoc = (docId: string, updates: Partial<ContextDoc>) => {
    if (!campaign) return;

    updateCampaignState(prev => {
      const currentDoc = prev.docs.find(d => d.id === docId);
      if (!currentDoc) return prev;

      const now = new Date().toISOString();
      const nextFolderId = updates.folderId !== undefined ? updates.folderId : currentDoc.folderId;
      const folderChanged = updates.folderId !== undefined && updates.folderId !== currentDoc.folderId;

      let nextOrder = updates.order;
      if ((folderChanged && nextOrder === undefined) || (nextOrder === undefined && currentDoc.order === undefined)) {
        const siblings = getSiblingDocs(prev.docs, nextFolderId, docId);
        nextOrder = getNextOrder(siblings);
      }

      const updatesWithMeta: Partial<ContextDoc> = {
        ...updates,
        lastUpdated: now,
        lastEditedBy: currentUser.id
      };
      if (nextOrder !== undefined) {
        updatesWithMeta.order = nextOrder;
      }

      return {
        ...prev,
        docs: prev.docs.map(d => d.id === docId ? { ...d, ...updatesWithMeta, folderId: nextFolderId } : d)
      };
    });
  };

  const deleteDoc = (docId: string) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      docs: removeById(prev.docs || [], docId),
      recentDocIds: (prev.recentDocIds || []).filter(id => id !== docId)
    }));
  };

  const moveDoc = (docId: string, folderId: string | undefined, order?: number) => {
    if (!campaign) return;

    updateCampaignState(prev => {
      const currentDoc = prev.docs.find(d => d.id === docId);
      if (!currentDoc) return prev;

      const siblings = getSiblingDocs(prev.docs, folderId, docId);
      const resolvedOrder = order ?? getNextOrder(siblings);
      const now = new Date().toISOString();

      return {
        ...prev,
        docs: prev.docs.map(d =>
          d.id === docId
            ? { ...d, folderId, order: resolvedOrder, lastUpdated: now, lastEditedBy: currentUser.id }
            : d
        ),
        recentDocIds: updateRecentDocs(docId, prev.recentDocIds)
      };
    });
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
    return campaign.canvasScene.relations
      .filter(relation => relation.type === 'TICKET_LINK' && relation.fromId === elementId)
      .map(relation => relation.toId);
  };

  const getCanvasElementsLinkedToTicket = (ticketId: string): string[] => {
    if (!campaign?.canvasScene) return [];
    return campaign.canvasScene.relations
      .filter(relation => relation.type === 'TICKET_LINK' && relation.toId === ticketId)
      .map(relation => relation.fromId);
  };

  // --- Campaign Tags ---

  const addCampaignTag = (tag: string) => {
    if (!campaign || (campaign.availableTags || []).includes(tag)) return;
    updateCampaignState(prev => ({
      ...prev,
      availableTags: [...(prev.availableTags || []), tag]
    }));
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

        const roadmapPaid1Id = generateId();
        const roadmapPaid2Id = generateId();
        const roadmapLifecycleId = generateId();
        const roadmapProjectId = generateId();

        const timelineTag1Id = generateId();
        const timelineTag2Id = generateId();

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
            createdAt: now.toISOString(),
            roadmapItemId: roadmapPaid1Id
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
            createdAt: now.toISOString(),
            roadmapItemId: roadmapPaid2Id
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
            createdAt: now.toISOString(),
            roadmapItemId: roadmapLifecycleId
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
            createdAt: now.toISOString(),
            roadmapItemId: roadmapProjectId
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

        const roadmapItems: RoadmapItem[] = [
          {
            id: roadmapPaid1Id,
            channelId: channelPaidId,
            weekIndex: 0,
            durationWeeks: 1,
            title: 'Prospecting Phase 1',
            description: 'Initial ad launch and testing.',
            ownerIds: [currentUser.id],
            type: 'CONTENT',
            priority: 'High',
            ticketId: ticketPaid1Id
          },
          {
            id: roadmapPaid2Id,
            channelId: channelPaidId,
            weekIndex: 1,
            durationWeeks: 1,
            title: 'Creative Iteration',
            description: 'Refresh performance creatives.',
            ownerIds: [currentUser.id],
            type: 'CONTENT',
            priority: 'Medium',
            ticketId: ticketPaid2Id
          },
          {
            id: roadmapLifecycleId,
            channelId: channelLifecycleId,
            weekIndex: 0,
            durationWeeks: 2,
            title: 'Onboarding Drip',
            description: 'Welcome and activation emails.',
            ownerIds: [currentUser.id],
            type: 'CONTENT',
            priority: 'Medium',
            ticketId: ticketLifecycleId
          },
          {
            id: roadmapProjectId,
            projectId,
            weekIndex: 1,
            durationWeeks: 2,
            title: 'Hero Section Overhaul',
            description: 'Main landing page restructure.',
            ownerIds: [currentUser.id],
            type: 'LAUNCH',
            priority: 'Urgent',
            ticketId: ticketProject1Id
          }
        ];

        const timelineTags: TimelineTag[] = [
          {
            id: timelineTag1Id,
            weekIndex: 0,
            label: 'LAUNCH',
            title: 'Campaign Kickoff',
            color: 'bg-emerald-500'
          },
          {
            id: timelineTag2Id,
            weekIndex: 2,
            label: 'EVENT',
            title: 'Milestone Review',
            color: 'bg-indigo-500'
          }
        ];

        return {
          ...prev,
          channels: [...prev.channels, ...channels],
          projects: [...prev.projects, ...projects],
          roadmapItems: [...(prev.roadmapItems || []), ...roadmapItems],
          timelineTags: [...(prev.timelineTags || []), ...timelineTags],
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
            ],
            roadmapItemIds: [
              roadmapPaid1Id,
              roadmapPaid2Id,
              roadmapLifecycleId,
              roadmapProjectId
            ],
            timelineTagIds: [timelineTag1Id, timelineTag2Id]
          }
        };
      }

      const removeChannelIds = new Set(sample.channelIds);
      const removeProjectIds = new Set(sample.projectIds);
      const removeTicketIds = new Set(sample.ticketIds);
      const removeRoadmapItemIds = new Set(sample.roadmapItemIds);
      const removeTimelineTagIds = new Set(sample.timelineTagIds);

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

      const roadmapItems = (prev.roadmapItems || []).filter(item => {
        if (removeRoadmapItemIds.has(item.id)) return false;
        if (item.channelId && removeChannelIds.has(item.channelId)) return false;
        if (item.projectId && removeProjectIds.has(item.projectId)) return false;
        return true;
      });

      const timelineTags = (prev.timelineTags || []).filter(tag => !removeTimelineTagIds.has(tag.id));

      return {
        ...prev,
        channels,
        projects,
        roadmapItems,
        timelineTags,
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

  // --- Agent & Review Actions ---

  const updateChatHistory = (mode: 'DAILY' | 'WEEKLY', messages: ChatMessage[]) => {
    if (!campaign) return;
    updateCampaignState(prev => ({
      ...prev,
      dailyChatHistory: mode === 'DAILY' ? messages : prev.dailyChatHistory,
      weeklyChatHistory: mode === 'WEEKLY' ? messages : prev.weeklyChatHistory
    }));
  };

  const completeReviewSession = (mode: 'DAILY' | 'WEEKLY') => {
    if (!campaign) return;
    const now = new Date().toISOString();
    updateCampaignState(prev => ({
      ...prev,
      lastDailyStandup: mode === 'DAILY' ? now : prev.lastDailyStandup,
      lastWeeklyReview: mode === 'WEEKLY' ? now : prev.lastWeeklyReview
    }));
  };

  const initiateDocCreationForTicket = (ticketId: string) => {
    setPendingTicketLink(ticketId);
    setCurrentView('DOCS');
  };

  const clearPendingTicketLink = () => {
    setPendingTicketLink(null);
  };

  return (
    <StoreContext.Provider value={{
      currentView,
      setCurrentView,
      pendingTicketLink,
      initiateDocCreationForTicket,
      clearPendingTicketLink,
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
      linkDocToTicket,
      addRoadmapItem,
      updateRoadmapItem,
      deleteRoadmapItem,
      moveRoadmapItem,
      addTimelineTag,
      deleteTimelineTag,
      addDocFolder,
      updateDocFolder,
      renameDocFolder: (id, name) => updateDocFolder(id, { name }), // Compatibility
      moveDocFolder,
      deleteDocFolder,
      toggleRagIndexing,
      toggleDocFavorite,
      toggleFolderFavorite,
      recordRecentDoc,
      addDoc,
      updateDoc,
      deleteDoc,
      moveDoc,
      updateCanvasScene,
      getCanvasChildren,
      getCanvasTicketLinks,
      getCanvasElementsLinkedToTicket,
      addCampaignTag,
      importAIPlan,
      switchUser,
      reset,
      toggleSampleData,
      updateChatHistory,
      completeReviewSession
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



