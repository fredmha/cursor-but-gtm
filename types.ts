
// --- Enums & Unions ---

export enum Status {
  Active = 'Active',
  Paused = 'Paused',
  Killed = 'Killed',
  Completed = 'Completed',
  Draft = 'Draft'
}

export enum TicketStatus {
  Backlog = 'Backlog',
  Todo = 'Todo',
  InProgress = 'In Progress',
  Done = 'Done',
  Canceled = 'Canceled'
}

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low' | 'None';
export type Role = 'Admin' | 'Member';
export type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track' | 'Completed';
export type ChannelTag = 'Inbound' | 'Outbound';
export type ChannelType = '' | 'PROJECT';
export type RoadmapItemType = 'CONTENT' | 'LAUNCH' | 'THEME' | 'NOTE';
export type DocType = 'STRATEGY' | 'PERSONA' | 'BRAND' | 'PROCESS';
export type DocFormat = 'TEXT' | 'CANVAS';
export type CanvasNodeType = 'RECT' | 'CIRCLE' | 'STICKY' | 'TEXT' | 'IMAGE';
export type ViewMode = 'ONBOARDING' | 'ROADMAP' | 'EXECUTION' | 'REVIEW' | 'CANVAS' | 'DOCS' | 'SETTINGS';
export type CanvasTool = 'SELECT' | 'HAND' | 'EMAIL_CARD' | 'CONTAINER';
export type CanvasElementKind = 'EMAIL_CARD' | 'CONTAINER';
export type CanvasRelationType = 'PARENT' | 'TICKET_LINK' | 'EDGE';
export type ExecutionRowType = 'TASK' | 'TEXT';

// --- Core Entities ---

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: Role;
}

export interface Ticket {
  id: string;
  shortId: string;
  title: string;
  description?: string;
  rowType?: ExecutionRowType;
  executionText?: string;
  status: TicketStatus;
  channelId?: string;
  projectId?: string;
  roadmapItemId?: string;
  assigneeId?: string;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  createdAt: string;
  linkedDocIds?: string[];
  canvasItemIds?: string[];
}

export interface ProjectUpdate {
  id: string;
  date: string;
  authorId: string;
  status: ProjectHealth;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectHealth;
  priority?: Priority;
  ownerId?: string;
  startDate?: string;
  targetDate?: string;
  updates: ProjectUpdate[];
  tickets: Ticket[];
}

export interface ChannelPrinciple {
  id: string;
  text: string;
}

export interface ChannelLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

export interface ChannelNote {
  id: string;
  authorId: string;
  date: string;
  text: string;
}

export interface ChannelPlan {
  id: string;
  contextDump?: string;
  audience: string;
  offer: string;
  mechanics: string;
  lastGeneratedAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  type?: ChannelType;
  campaignId: string;
  tickets: Ticket[];
  principles: ChannelPrinciple[];
  tags: ChannelTag[];
  links?: ChannelLink[];
  notes?: ChannelNote[];
  memberIds?: string[];
  plan?: ChannelPlan;
}

export interface OperatingPrinciple {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface RoadmapItem {
  id: string;
  channelId?: string;
  weekIndex: number;
  durationWeeks: number;
  title: string;
  description?: string;
  ownerIds?: string[];
  type: RoadmapItemType;
  label?: string;
  priority?: Priority;
  attachments?: string[];
  externalLinks?: { title: string; url: string }[];
  ticketId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  status?: Status;
}

export interface TimelineTag {
  id: string;
  weekIndex: number;
  label: string;
  title: string;
  color: string;
}

// --- Docs & Canvas ---

export interface DocFolder {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  order?: number;
  isRagIndexed?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  createdAt: string;
}

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  src?: string;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  color?: string;
}

export interface CanvasElementStyle {
  fill?: string;
  stroke?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface CanvasElement {
  id: string;
  kind: CanvasElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  text?: string;
  style?: CanvasElementStyle;
}

export interface CanvasRelation {
  id: string;
  type: CanvasRelationType;
  fromId: string;
  toId: string;
  meta?: Record<string, unknown>;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasDocumentV2 {
  version: 2;
  elements: CanvasElement[];
  relations: CanvasRelation[];
  viewport: CanvasViewport;
}

export type CanvasScene = CanvasDocumentV2;

export interface ContextDoc {
  id: string;
  shortId?: string;
  title: string;
  content: string;
  format?: DocFormat;
  type?: DocType;
  folderId?: string;
  order?: number;
  lastUpdated: string;
  isAiGenerated: boolean;
  tags?: string[];
  channelId?: string;
  icon?: string;
  isRagIndexed?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  lastEditedBy?: string;
  createdBy?: string;
  createdAt?: string;
}

// --- Chat ---

export interface ChatPart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: ChatPart[];
  timestamp: number;
}

// --- Campaign ---

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: 'Onboarding' | 'Planning' | 'Active' | 'Closed';
  channels: Channel[];
  projects: Project[];
  standaloneTickets?: Ticket[];
  principles: OperatingPrinciple[];
  roadmapItems: RoadmapItem[];
  timelineTags: TimelineTag[];
  docFolders: DocFolder[];
  docs: ContextDoc[];
  availableTags?: string[];
  recentDocIds?: string[];
  sampleData?: {
    enabled: boolean;
    channelIds: string[];
    projectIds: string[];
    ticketIds: string[];
    roadmapItemIds: string[];
    timelineTagIds: string[];
  };
  lastDailyStandup?: string;
  lastWeeklyReview?: string;
  dailyChatHistory?: ChatMessage[];
  weeklyChatHistory?: ChatMessage[];
  canvasScene?: CanvasScene;
}
