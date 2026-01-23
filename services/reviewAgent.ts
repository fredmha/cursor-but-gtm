import { Type, Tool } from "@google/genai";
import { Campaign, Ticket, TicketStatus, User } from "../types";
import REVIEW_AGENT_SOP from "../docs/review-agent-sop.md?raw";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const NOTE_SHOW_TASKS = "If the user asks to see tasks, you MUST call 'show_tasks' with the relevant ticketIds.";
const DONE_OR_CANCELED = new Set<TicketStatus>([TicketStatus.Done, TicketStatus.Canceled]);
const FORMAT_RULES = `
  Formatting:
  - Respond in Markdown with headings (##), bold labels, and short paragraphs.
  - Use 2-4 sections. Avoid single large paragraphs.
  - If you call 'show_tasks', follow with a "## Task Summary" section describing what the user should do next.
  - If no tasks exist, say: "There aren't any ongoing tasks."
  - Do not send unsolicited opening messages; only respond to the user's prompt. You may ask clarifying questions.
`;

// ------------------------------------------------------------
// Tool declarations (simple, explicit)
// ------------------------------------------------------------
const SHOW_TASKS_TOOL = {
  name: "show_tasks",
  description: "Display a set of tickets in the chat as cards.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      ticketIds: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["ticketIds"]
  }
};

const PROPOSE_RESCHEDULE_TOOL = {
  name: "propose_reschedule",
  description: "Propose moving an overdue or scheduled ticket to a new date.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: { type: Type.STRING },
      newDate: { type: Type.STRING, description: "ISO Date string (YYYY-MM-DD)." },
      reason: { type: Type.STRING }
    },
    required: ["ticketId", "newDate"]
  }
};

const PROPOSE_TICKET_TOOL = {
  name: "propose_ticket",
  description: "Propose creating a new execution ticket.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      channelId: { type: Type.STRING },
      projectId: { type: Type.STRING },
      description: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ["Urgent", "High", "Medium", "Low"] }
    },
    required: ["title"]
  }
};

const PROPOSE_STATUS_CHANGE_TOOL = {
  name: "propose_status_change",
  description: "Propose marking a ticket as Done, Canceled (Kill), or Backlog.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: { type: Type.STRING },
      status: { type: Type.STRING, enum: ["Done", "Canceled", "Backlog"] },
      reason: { type: Type.STRING }
    },
    required: ["ticketId", "status"]
  }
};

const CREATE_TASK_TOOL = {
  name: "create_task",
  description: "Quickly create a task for today or tomorrow.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ["Urgent", "High", "Medium"] }
    },
    required: ["title"]
  }
};

const UPDATE_STATUS_TOOL = {
  name: "update_status",
  description: "Mark a specific ticket as Done or In Progress.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: { type: Type.STRING },
      status: { type: Type.STRING, enum: ["Done", "In Progress"] }
    },
    required: ["ticketId", "status"]
  }
};

export const WEEKLY_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      SHOW_TASKS_TOOL,
      PROPOSE_RESCHEDULE_TOOL,
      PROPOSE_TICKET_TOOL,
      PROPOSE_STATUS_CHANGE_TOOL
    ]
  }
];

export const DAILY_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      SHOW_TASKS_TOOL,
      CREATE_TASK_TOOL,
      UPDATE_STATUS_TOOL
    ]
  }
];

// ------------------------------------------------------------
// Helpers (keep logic explicit and consistent)
// ------------------------------------------------------------
const isoDate = (date: Date) => date.toISOString().split("T")[0];

const getAllTickets = (campaign: Campaign) => [
  ...(campaign.channels || []).flatMap((c) => c.tickets),
  ...(campaign.projects || []).flatMap((p) => p.tickets),
];

const getWeeklyTicketsForUser = (campaign: Campaign, userId: string | null | undefined, now: Date) => {
  const { weekStart, weekEnd } = getWeekRange(now);
  const allTickets = getAllTickets(campaign);
  const byUser = userId ? allTickets.filter((t) => t.assigneeId === userId) : allTickets;
  return byUser.filter((t) => isDueBetween(t, weekStart, weekEnd));
};

const isActiveTicket = (t: Ticket) => !DONE_OR_CANCELED.has(t.status);

const getWeekRange = (now: Date) => {
  const day = now.getDay(); // 0 = Sun, 1 = Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

const isDueBetween = (t: Ticket, start: Date, end: Date) => {
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate);
  return due >= start && due <= end;
};

const formatTicketLine = (t: Ticket) => `- [ID: ${t.id} | ${t.shortId}] "${t.title}" (${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ""})`;

const formatTicketList = (label: string, items: Ticket[]) => {
  const lines = items.map(formatTicketLine).join("\n");
  return `${label}:\n${lines || "None."}`;
};

// ------------------------------------------------------------
// Context builders
// ------------------------------------------------------------
export const buildWeeklyContext = (campaign: Campaign) => {
  const now = new Date();
  const { weekStart, weekEnd } = getWeekRange(now);
  const weekStartStr = isoDate(weekStart);
  const weekEndStr = isoDate(weekEnd);

  const allTickets = getWeeklyTicketsForUser(campaign, null, now);
  const hasAnyTickets = allTickets.length > 0;

  const overdue = allTickets.filter(t =>
    isActiveTicket(t) && t.dueDate && new Date(t.dueDate) < now
  );

  const inWeek = allTickets.filter(t =>
    isActiveTicket(t) && isDueBetween(t, weekStart, weekEnd)
  );

  const inWeekByStatus: Record<string, Ticket[]> = {
    [TicketStatus.Todo]: inWeek.filter(t => t.status === TicketStatus.Todo),
    [TicketStatus.InProgress]: inWeek.filter(t => t.status === TicketStatus.InProgress),
    [TicketStatus.Backlog]: inWeek.filter(t => t.status === TicketStatus.Backlog),
    [TicketStatus.Blocked]: inWeek.filter(t => t.status === TicketStatus.Blocked)
  };

  const activeProjects = (campaign.projects || []).filter(
    p => p.status === "On Track" || p.status === "At Risk"
  );

  const overdueList = overdue.map(t => `- [ID: ${t.id} | ${t.shortId}] "${t.title}" (Due: ${t.dueDate})`).join("\n");
  const projectList = activeProjects.map(
    p => `- [ID: ${p.id}] "${p.name}" (${p.description || "No description"})`
  ).join("\n");
  const channelList = (campaign.channels || []).map(
    c => `- [ID: ${c.id}] "${c.name}"`
  ).join("\n");

  return `
    Current Date: ${now.toLocaleDateString()}
    Current Week (strict Mon-Sun): ${weekStartStr} to ${weekEndStr}
    Stride Objective: ${campaign.objective || "Not set"}

    CRITICAL: Your goal is to help the user close the current week (this stride), resolve overdue tickets, and keep in-week work on track.

    OVERDUE TICKETS (Slippage):
    ${overdueList || (hasAnyTickets ? "None. Great job." : "There aren't any ongoing tasks.")}

    IN-WEEK WORK (Not Done/Canceled):
    ${hasAnyTickets ? formatTicketList("Todo", inWeekByStatus[TicketStatus.Todo]) : "There aren't any ongoing tasks."}
    ${hasAnyTickets ? formatTicketList("In Progress", inWeekByStatus[TicketStatus.InProgress]) : ""}
    ${hasAnyTickets ? formatTicketList("Backlog", inWeekByStatus[TicketStatus.Backlog]) : ""}
    ${hasAnyTickets ? formatTicketList("Blocked", inWeekByStatus[TicketStatus.Blocked]) : ""}

    ACTIVE PROJECTS:
    ${projectList}

    AVAILABLE CHANNELS:
    ${channelList}

    NOTE: ${NOTE_SHOW_TASKS}
  `;
};

export const buildDailyContext = (campaign: Campaign, user: User) => {
  const now = new Date();
  const todayStr = isoDate(now);

  const allTickets = getAllTickets(campaign).filter(t => t.assigneeId === user.id);

  const todaysWork = allTickets.filter(t =>
    isActiveTicket(t) && t.dueDate && t.dueDate <= todayStr
  );

  const todoList = todaysWork.map(t => `- [ID: ${t.id} | ${t.shortId}] "${t.title}" (${t.status})`).join("\n");

  return `
    Today is: ${now.toLocaleDateString()}
    User: ${user.name}
    Stride Objective: ${campaign.objective || "Not set"}

    GOAL: Run a quick daily standup.
    1. Ask what they achieved yesterday.
    2. Review today's plan based on the following assigned tickets.
    3. Identify blockers.

    ASSIGNED WORK (Due Today/Overdue):
    ${todoList || "There aren't any ongoing tasks."}

    NOTE: ${NOTE_SHOW_TASKS}
  `;
};

// ------------------------------------------------------------
// System instructions
// ------------------------------------------------------------
export const WEEKLY_SYSTEM_INSTRUCTION = `
  You are the GTM Chief of Staff.
  Your Persona: High-bandwidth, low-ego, execution-focused. You speak concisely. No fluff.

  Workflow:
  1. THE CLEANSE: Look at the Overdue Tickets. Ask the user what to do with them (Reschedule, Kill, or they are actually Done).
     - ALWAYS use 'propose_status_change' or 'propose_reschedule' when the user decides.
     - Do not move to planning until Overdue is empty.

  2. THE WEEK STRIDE: Review IN-WEEK WORK (strict Mon-Sun). For any items due this week, ask for status confirmation on multiple tasks.
     - If the user confirms a status change, immediately emit 'propose_status_change'.
     - If the user says a task is in progress, use 'propose_status_change' to set status to Backlog only if they request it; otherwise keep status.
     - If they want to move work out of the week, use 'propose_reschedule'.

  3. THE PLAN: Look at Active Projects and Channels. Ask if there are key actions for next week.
     - Suggest tasks based on the Project descriptions if the user is stuck.
     - Use 'propose_ticket' when the user wants to add a task.

  Rules:
  - NEVER say "I have updated the ticket". You cannot update the database. You MUST emit a Tool Call (proposal) and wait for the user to approve it.
  - If the user says "Move X to next week", calculate the date for next Friday and use 'propose_reschedule'.
  - If the user asks to see tasks, use 'show_tasks' with the relevant ticket IDs.

  SOP:
  ${REVIEW_AGENT_SOP}
  
  ${FORMAT_RULES}
`;

export const DAILY_SYSTEM_INSTRUCTION = `
  You are the Daily Standup Agent.
  Your goal is to unblock the user and ensure they know what to do today.

  Style: Short, punchy, like a Slack message from a good manager.

  Workflow:
  1. Provide a Daily Digest in a structured block with bullets under labeled headings:
     - Snapshot:
     - Priorities:
     - Risks/Blockers:
     - Ask:
  2. Ask if there are any blockers or new urgent items.
  3. If they say "I did X", ask if you should mark X as done (if X exists in context).
  4. If they confirm a ticket status change, immediately use 'update_status'.
  5. If they say "I need to do Y", use 'create_task'.
  6. If the user asks to see tasks, use 'show_tasks' with the relevant ticket IDs.

  SOP:
  ${REVIEW_AGENT_SOP}
  
  ${FORMAT_RULES}
`;
