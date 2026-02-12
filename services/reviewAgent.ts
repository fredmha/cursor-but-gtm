import { Type, Tool } from "@google/genai";
import { Campaign, Ticket, TicketStatus, User } from "../types";

const FORMAT_RULES = `
  Formatting:
  - Respond in Markdown with headings (##), bold labels, and short paragraphs.
  - Use 2-4 sections. Avoid single large paragraphs.
  - If you call 'show_tasks', follow with a "## Task Summary" section describing what the user should do next.
  - If no tasks exist, say: "There aren't any ongoing tasks."
  - Do not send unsolicited opening messages; only respond to the user's prompt. You may ask clarifying questions.
`;

const SHOW_TASKS_TOOL = {
  name: "show_tasks",
  description: "Display a set of tasks in the chat as cards.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      ticketIds: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["ticketIds"]
  }
};

const CREATE_TASK_TOOL = {
  name: "create_task",
  description: "Create a new task for the current user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      notes: { type: Type.STRING },
      startDate: { type: Type.STRING },
      dueDate: { type: Type.STRING },
      channelId: { type: Type.STRING },
      projectId: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
    },
    required: ["title"]
  }
};

const UPDATE_TASK_TOOL = {
  name: "update_task",
  description: "Update a task title, status, or notes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: { type: Type.STRING },
      title: { type: Type.STRING },
      status: { type: Type.STRING, enum: ["Todo", "In Progress", "Blocked", "Done"] },
      notes: { type: Type.STRING },
      startDate: { type: Type.STRING },
      dueDate: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
    },
    required: ["ticketId"]
  }
};

const DELETE_TASK_TOOL = {
  name: "delete_task",
  description: "Delete a task by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: { type: Type.STRING }
    },
    required: ["ticketId"]
  }
};

export const CORE_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      SHOW_TASKS_TOOL,
      CREATE_TASK_TOOL,
      UPDATE_TASK_TOOL,
      DELETE_TASK_TOOL
    ]
  }
];

const isoDate = (date: Date) => date.toISOString().split("T")[0];

const getUserTickets = (campaign: Campaign, user: User) =>
  [
    ...(campaign.channels || []).flatMap(c => c.tickets || []),
    ...(campaign.projects || []).flatMap(p => p.tickets || [])
  ].filter(t => t.assigneeId === user.id);

const formatTicketLine = (t: Ticket) => {
  const status = t.status || TicketStatus.Todo;
  return `- [ID: ${t.id} | ${t.shortId}] "${t.title}" (${status})`;
};

export const buildCoreContext = (campaign: Campaign, user: User) => {
  const today = isoDate(new Date());
  const tasks = getUserTickets(campaign, user);
  const byStatus = {
    todo: tasks.filter(t => t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog),
    doing: tasks.filter(t => t.status === TicketStatus.InProgress),
    blocked: tasks.filter(t => t.status === TicketStatus.Blocked),
    done: tasks.filter(t => t.status === TicketStatus.Done)
  };

  const list = tasks.map(formatTicketLine).join("\n");
  const counts = `Todo: ${byStatus.todo.length}, Doing: ${byStatus.doing.length}, Blocked: ${byStatus.blocked.length}, Done: ${byStatus.done.length}`;

  return `
    Today is: ${today}
    User: ${user.name}

    TASK COUNTS:
    ${counts}

    TASK LIST:
    ${list || "There aren't any ongoing tasks."}

    NOTE: If the user asks to see tasks, you MUST call 'show_tasks' with the relevant ticketIds.

    ${FORMAT_RULES}
  `;
};

export const CORE_SYSTEM_INSTRUCTION = `
  You are a personal task agent. You manage the user's tasks only.

  Capabilities:
  - Create a task (title, notes, optional start date, optional due date, optional context).
  - Update task title, status, notes, schedule, or priority.
  - Delete a task.
  - Show tasks when asked.
  - Summarize progress by status.

  Rules:
  - Never claim a task was updated unless you called a tool.
  - If the user asks to see tasks, call 'show_tasks' with matching IDs.
  - If details are missing or ambiguous, ask a follow-up question before calling create/update tools.
  - Use semantic best-guess context when channel/project is not explicit, but keep the user in control.
  - If the user mentions schedule details, pass them via startDate and dueDate in tool args.
  - Keep replies short and action-oriented.

  ${FORMAT_RULES}
`;
