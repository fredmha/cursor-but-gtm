
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

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Ticket {
  id: string;
  shortId: string;
  title: string;
  description?: string;
  status: TicketStatus;
  betId: string; // STRICT PARENT LINK
  channelId: string; // STRICT GRANDPARENT LINK (Roadmap Row)
  projectId?: string; // Optional Context Link
  roadmapItemId?: string;
  assigneeId?: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
}

export interface Bet {
  id: string;
  description: string;
  hypothesis: string;
  successCriteria: string;
  status: Status;
  channelId: string; // STRICT PARENT LINK
  projectId?: string; // Optional Context Link
  tickets: Ticket[];
  ownerId?: string;
  timeboxWeeks?: number;
  startDate?: string;
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
}

export interface ChannelPrinciple {
  id: string;
  text: string;
}

export interface ChannelLink {
  id: string;
  title: string;
  url: string;
  icon?: string; // e.g., 'doc', 'sheet', 'video'
}

export interface ChannelNote {
  id: string;
  authorId: string;
  date: string;
  text: string;
  pinned?: boolean;
}

export type ChannelTag = 'Inbound' | 'Outbound';

export interface Channel {
  id: string;
  name: string;
  campaignId: string;
  bets: Bet[];
  principles: ChannelPrinciple[];
  tags: ChannelTag[];
  links?: ChannelLink[]; // SOPs, Docs
  notes?: ChannelNote[]; // Team remarks
}

export interface OperatingPrinciple {
  id: string;
  title: string;
  description: string;
  category: string;
}

// --- ROADMAP ARCHITECTURE ---

export type RoadmapItemType = 'CONTENT' | 'LAUNCH' | 'THEME' | 'NOTE' | 'BET';

export interface RoadmapItem {
  id: string;
  channelId: string; // The Row it belongs to
  weekIndex: number;
  durationWeeks: number;
  title: string;
  description?: string;
  ownerIds?: string[];
  type: RoadmapItemType;
  label?: string;
  
  // Extended Properties
  priority?: Priority;
  attachments?: string[];
  externalLinks?: { title: string; url: string }[];
  
  // Linkage
  linkedBetId?: string;
  ticketId?: string;
  projectId?: string; // Link to Project for color coding
  
  // Visuals
  color?: string;
  status?: Status;
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
}

export type ViewMode = 'ONBOARDING' | 'ROADMAP' | 'EXECUTION' | 'REVIEW';
