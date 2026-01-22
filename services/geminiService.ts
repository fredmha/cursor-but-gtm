
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChannelPlan, Ticket, Campaign, ContextDoc, Channel } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Generates Tickets based on the structured Channel Plan
export const generateBetsFromPlan = async (channelName: string, plan: ChannelPlan): Promise<Partial<Ticket>[]> => {
  const client = getClient();
  if (!client) return [];

  const context = `
    Channel: ${channelName}
    Audience: ${plan.audience}
    Offer/Value Prop: ${plan.offer}
    Mechanics/Tactics: ${plan.mechanics}
    Context Dump: ${plan.contextDump || 'N/A'}
  `;

  const prompt = `
    You are a GTM Strategist. Based on the following strategic context for the channel "${channelName}", 
    generate 3 high-impact execution tasks (Tickets).
    
    Context:
    ${context}

    Return a JSON array of objects with 'title' (actionable task name) and 'description' (details).
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Actionable task title (e.g. 'Launch Cold Email Sequence')" },
        description: { type: Type.STRING, description: "Details on how to execute" },
      },
      required: ["title", "description"],
    },
  };

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error (generateBetsFromPlan):", error);
    return [];
  }
};

export const generateWeeklyActionItems = async (
  ethos: string, 
  slippageContext: string,
  availableContexts: { id: string; name: string; type: 'CHANNEL' | 'PROJECT' }[]
): Promise<any[]> => {
  const client = getClient();
  if (!client) return [];

  const contextList = availableContexts.map(c => `- ${c.name} (ID: ${c.id}, Type: ${c.type})`).join('\n');

  const prompt = `
    Context:
    The user is performing a weekly review for their GTM campaign.

    Available Execution Contexts (Channels/Projects):
    ${contextList}
    
    Past Week Slippage (Incomplete/Overdue tasks):
    ${slippageContext || "None."}

    Strategic Ethos for Next Week (User's Goal):
    "${ethos}"

    Task:
    Generate 5-7 high-impact execution tickets that align with the Ethos.
    IMPORTANT: You must categorize each ticket into one of the Available Execution Context IDs provided above based on its nature.
    If a ticket fits a specific Project, prefer the Project ID. If it fits a channel, use the Channel ID.
    
    Return a JSON array. Each item should have:
    - 'title'
    - 'description'
    - 'contextId' (The exact ID of the Channel or Project from the provided list)
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Actionable task title" },
        description: { type: Type.STRING, description: "Brief details" },
        contextId: { type: Type.STRING, description: "The ID of the target Channel or Project" },
      },
      required: ["title", "description", "contextId"],
    },
  };

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error (generateWeeklyActionItems):", error);
    return [];
  }
};

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const generateFullCampaignFromChat = async (transcript: ChatMessage[]): Promise<any> => {
    const client = getClient();
    if (!client) return null;

    const transcriptText = transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

    const prompt = `
        You are a GTM Strategist. You have just interviewed a user about their business.
        Based on the transcript below, generate a full GTM Strategy Structure.

        TRANSCRIPT:
        ${transcriptText}

        REQUIREMENTS:
        1. Extract the North Star Objective.
        2. Define 3-5 Operating Principles (Rules of Engagement).
        3. Define 3-4 Distribution Channels.
        4. For each channel, create 2-3 "Tickets" (Execution Tasks).
        5. Create 3 Context Documents (Markdown format) that summarize the strategy:
           - "ICP Definition" (Who they are targeting)
           - "Value Proposition" (Why they win)
           - "Strategy Memo" (Overview of the approach)

        OUTPUT JSON format only.
    `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            objective: { type: Type.STRING },
            principles: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        category: { type: Type.STRING }
                    },
                    required: ["title", "description", "category"]
                }
            },
            channels: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        tickets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["title", "description"]
                            }
                        }
                    },
                    required: ["name", "tags", "tickets"]
                }
            },
            docs: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING, description: "Markdown content" },
                        type: { type: Type.STRING, enum: ["STRATEGY", "PERSONA", "BRAND", "PROCESS"] }
                    },
                    required: ["title", "content", "type"]
                }
            }
        },
        required: ["objective", "principles", "channels", "docs"]
    };

    try {
        const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Error (generateFullCampaignFromChat):", error);
        return null;
    }
};

export const generateChannelsAndBets = async (objective: string): Promise<any> => {
  const client = getClient();
  if (!client) return null;

  const prompt = `You are a GTM strategist. Given the objective: "${objective}", suggest 3 marketing channels and 2 specific "Tickets" (tasks) per channel. 
  Return JSON only.`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      channels: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Channel name (e.g. SEO, Cold Email)" },
            type: { type: Type.STRING, description: "Category of channel" },
            tickets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Actionable task title" },
                  description: { type: Type.STRING, description: "Task description" },
                },
                required: ["title", "description"],
              },
            },
          },
          required: ["name", "type", "tickets"],
        },
      },
    },
    required: ["channels"],
  };

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
