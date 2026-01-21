
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
