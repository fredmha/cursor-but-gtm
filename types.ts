
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
export type ViewMode = 'EXECUTION' | 'CANVAS';
export type CanvasTool =
  | 'SELECT'
  | 'HAND'
  | 'EMAIL_CARD'
  | 'CONTAINER'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'DIAMOND'
  | 'TEXT'
  | 'PENCIL';
export type CanvasElementKind =
  | 'EMAIL_CARD'
  | 'CONTAINER'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'DIAMOND'
  | 'TEXT'
  | 'PENCIL';
export type CanvasRelationType = 'PARENT' | 'TICKET_LINK' | 'EDGE';
export type ExecutionRowType = 'TASK' | 'TEXT';
export type EmailBlockType = 'H1' | 'H2' | 'H3' | 'BODY' | 'IMAGE';
export type EmailBlockAlign = 'left' | 'center' | 'right';

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

// --- Canvas ---

export interface CanvasElementStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface CanvasStrokePoint {
  x: number;
  y: number;
}

export interface CanvasStrokeData {
  points: CanvasStrokePoint[];
}

export interface CanvasEmailBlock {
  id: string;
  order: number;
  type: EmailBlockType;
  align: EmailBlockAlign;
  text?: string;
  imageUrl?: string;
  heightPx?: number;
  fontSizePx?: number;
  paddingY?: number;
  paddingX?: number;
  marginBottomPx?: number;
}

export interface CanvasEmailTemplate {
  version: 1;
  blocks: CanvasEmailBlock[];
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
  emailTemplate?: CanvasEmailTemplate;
  stroke?: CanvasStrokeData;
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
  sampleData?: {
    enabled: boolean;
    channelIds: string[];
    projectIds: string[];
    ticketIds: string[];
  };
  canvasScene?: CanvasScene;
}
