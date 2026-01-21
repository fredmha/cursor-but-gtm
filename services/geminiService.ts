
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
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

export const generateTicketsForBet = async (betDescription: string): Promise<string[]> => {
    // This function is likely deprecated now that we don't have bets, but kept for interface compatibility if needed, 
    // or we could delete it. I will simplify it to return empty array or handle general task expansion if reused.
    return []; 
};
