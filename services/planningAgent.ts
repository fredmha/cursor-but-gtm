import { Type, Tool } from "@google/genai";
import { Campaign } from "../types";

const LOAD_PLANS_TOOL = {
  name: "load_plans",
  description: "Load planning documents for a given horizon and date range.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      horizon: { type: Type.STRING, description: "daily | weekly | quarterly | sprint" },
      range: { type: Type.STRING, description: "Date range hint (e.g., last 3 days)." }
    },
    required: ["horizon"]
  }
};

const SAVE_PLAN_TOOL = {
  name: "save_plan",
  description: "Persist a planning artifact after user confirmation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      horizon: { type: Type.STRING, description: "daily | weekly | quarterly | sprint" },
      data: { type: Type.OBJECT, description: "Structured plan payload." }
    },
    required: ["horizon", "data"]
  }
};

const LIST_TASKS_TOOL = {
  name: "list_tasks",
  description: "List tasks for the current planning context.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filters: { type: Type.OBJECT, description: "Task filter object." }
    }
  }
};

const LIST_TEAM_TOOL = {
  name: "list_team",
  description: "List team members and availability.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const UPLOAD_CONTEXT_TOOL = {
  name: "upload_context",
  description: "Attach a context file to planning.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      file: { type: Type.STRING, description: "File identifier." }
    },
    required: ["file"]
  }
};

export const PLANNING_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      LOAD_PLANS_TOOL,
      SAVE_PLAN_TOOL,
      LIST_TASKS_TOOL,
      LIST_TEAM_TOOL,
      UPLOAD_CONTEXT_TOOL
    ]
  }
];

export const PLANNING_SYSTEM_INSTRUCTION = `
You are the Planning Agent.
Your role is to guide daily, weekly, quarterly, and sprint planning.

Rules:
- Always run a readiness gate before proposing a plan.
- Never write tasks or updates without explicit user confirmation.
- Persist plans only after confirmation.

SOP:
Follow the system rules and use the tools as instructed.
`;

export const buildPlanningContext = (campaign: Campaign) => {
  return `
    Objective: ${campaign.objective || "Not set"}
    Channels: ${(campaign.channels || []).map(c => c.name).join(", ") || "None"}
    Projects: ${(campaign.projects || []).map(p => p.name).join(", ") || "None"}
  `;
};
