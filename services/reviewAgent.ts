
import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { Campaign, Ticket, TicketStatus, User } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// --- WEEKLY TOOLS (Strategic) ---
export const WEEKLY_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
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
      },
      {
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
      },
      {
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
      }
    ]
  }
];

// --- DAILY TOOLS (Tactical) ---
export const DAILY_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
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
      },
      {
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
      }
    ]
  }
];

export const buildWeeklyContext = (campaign: Campaign) => {
    const now = new Date();
    
    // 1. Identify Overdue
    const allTickets = [
        ...(campaign.channels || []).flatMap(c => c.tickets),
        ...(campaign.projects || []).flatMap(p => p.tickets)
    ];
    
    const overdue = allTickets.filter(t => 
        t.status !== TicketStatus.Done && 
        t.status !== TicketStatus.Canceled &&
        t.dueDate && new Date(t.dueDate) < now
    );

    const activeProjects = (campaign.projects || []).filter(p => p.status === 'On Track' || p.status === 'At Risk');

    // 3. Format Lists
    const overdueList = overdue.map(t => 
        `- [ID: ${t.id}] "${t.title}" (Due: ${t.dueDate})`
    ).join('\n');

    const projectList = activeProjects.map(p => 
        `- [ID: ${p.id}] "${p.name}" (${p.description || 'No description'})`
    ).join('\n');

    const channelList = (campaign.channels || []).map(c => 
        `- [ID: ${c.id}] "${c.name}"`
    ).join('\n');

    return `
        Current Date: ${now.toLocaleDateString()}
        
        CRITICAL: Your goal is to help the user achieve "Inbox Zero" on their overdue tickets, and then plan next week.
        
        OVERDUE TICKETS (Slippage):
        ${overdueList || "None. Great job."}

        ACTIVE PROJECTS:
        ${projectList}

        AVAILABLE CHANNELS:
        ${channelList}
    `;
};

export const buildDailyContext = (campaign: Campaign, user: User) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const allTickets = [
        ...(campaign.channels || []).flatMap(c => c.tickets),
        ...(campaign.projects || []).flatMap(p => p.tickets)
    ].filter(t => t.assigneeId === user.id);

    // Tickets due today or overdue
    const todaysWork = allTickets.filter(t => 
        t.status !== TicketStatus.Done && 
        t.status !== TicketStatus.Canceled &&
        (t.dueDate && t.dueDate <= todayStr)
    );

    const recentWins = allTickets.filter(t => 
        t.status === TicketStatus.Done && 
        // Logic for "recently" could be improved, but let's say last updated check
        true 
    ).slice(0, 3); 

    const todoList = todaysWork.map(t => 
        `- [ID: ${t.id}] "${t.title}" (${t.status})`
    ).join('\n');

    return `
        Today is: ${now.toLocaleDateString()}
        User: ${user.name}

        GOAL: Run a quick daily standup.
        1. Ask what they achieved yesterday.
        2. Review today's plan based on the following assigned tickets.
        3. Identify blockers.

        ASSIGNED WORK (Due Today/Overdue):
        ${todoList || "No specific tasks due today."}
    `;
};

export const WEEKLY_SYSTEM_INSTRUCTION = `
    You are the GTM Chief of Staff.
    Your Persona: High-bandwidth, low-ego, execution-focused. You speak concisely. No fluff.
    
    Workflow:
    1. THE CLEANSE: Look at the Overdue Tickets. Ask the user what to do with them (Reschedule, Kill, or they are actually Done).
       - ALWAYS use 'propose_status_change' or 'propose_reschedule' when the user decides.
       - Do not move to planning until Overdue is empty.
    
    2. THE PLAN: Look at Active Projects and Channels. Ask if there are key actions for next week.
       - Suggest tasks based on the Project descriptions if the user is stuck.
       - Use 'propose_ticket' when the user wants to add a task.
    
    Rules:
    - NEVER say "I have updated the ticket". You cannot update the database. You MUST emit a Tool Call (proposal) and wait for the user to approve it.
    - If the user says "Move X to next week", calculate the date for next Friday and use 'propose_reschedule'.
`;

export const DAILY_SYSTEM_INSTRUCTION = `
    You are the Daily Standup Agent.
    Your goal is to unblock the user and ensure they know what to do today.
    
    Style: Short, punchy, like a Slack message from a good manager.
    
    Workflow:
    1. Acknowledge what's on their plate (from context).
    2. Ask if there are any blockers or new urgent items.
    3. If they say "I did X", ask if you should mark X as done (if X exists in context).
    4. If they say "I need to do Y", use 'create_task'.
`;
