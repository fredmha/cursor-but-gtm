
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
  status: TicketStatus;
  channelId?: string; // Direct Parent
  projectId?: string; // Direct Parent
  roadmapItemId?: string;
  assigneeId?: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  linkedDocIds?: string[]; // IDs of ContextDocs linked to this ticket
}

export type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track' | 'Completed';

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

export type ChannelTag = 'Inbound' | 'Outbound';

export type ChannelType = '' | 'PROJECT';

export interface Channel {
  id: string;
  name: string;
  type?: ChannelType;
  campaignId: string;
  tickets: Ticket[]; // Tickets live directly on Channel
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

export type RoadmapItemType = 'CONTENT' | 'LAUNCH' | 'THEME' | 'NOTE';

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

// Deprecated conceptually, but kept for migration if needed, though mostly replaced by folders.
export type DocType = 'STRATEGY' | 'PERSONA' | 'BRAND' | 'PROCESS';

export interface DocFolder {
  id: string;
  name: string;
  icon?: string; // Emoji
  createdAt: string;
}

export type DocFormat = 'TEXT' | 'CANVAS';

export type CanvasNodeType = 'RECT' | 'CIRCLE' | 'STICKY' | 'TEXT' | 'IMAGE';

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  src?: string; // For Images (Base64)
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  color?: string;
}

export interface ContextDoc {
  id: string;
  title: string;
  content: string; // HTML Content OR JSON string for Canvas
  format?: DocFormat; // Defaults to TEXT
  type?: DocType; // Kept for legacy/compatibility
  folderId?: string; // The folder this doc belongs to
  lastUpdated: string;
  isAiGenerated: boolean;
  tags?: string[];
  channelId?: string;
  icon?: string; // Emoji customization for file
}

// Chat Types
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

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: 'Onboarding' | 'Planning' | 'Active' | 'Closed';
  channels: Channel[];
  projects: Project[];
  principles: OperatingPrinciple[];
  roadmapItems: RoadmapItem[];
  timelineTags: TimelineTag[];
  docFolders: DocFolder[]; // New Folders
  docs: ContextDoc[];
  availableTags?: string[]; // Global tags list
  
  // Agent / Review State
  lastDailyStandup?: string; // ISO Date
  lastWeeklyReview?: string; // ISO Date
  dailyChatHistory?: ChatMessage[]; 
  weeklyChatHistory?: ChatMessage[];
}

export type ViewMode = 'ONBOARDING' | 'ROADMAP' | 'EXECUTION' | 'REVIEW' | 'DOCS' | 'SETTINGS';
