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

  const prompt = `You are a GTM strategist. Given the objective: "${objective}", suggest 3 marketing channels and 2 specific "Bets" (experiments) per channel. 
  A Bet is a specific hypothesis-driven activity. 
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
            bets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Actionable bet description" },
                  hypothesis: { type: Type.STRING, description: "Why we think this will work" },
                },
                required: ["description", "hypothesis"],
              },
            },
          },
          required: ["name", "type", "bets"],
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
  const client = getClient();
  if (!client) return [];

  const prompt = `For the GTM experiment/bet: "${betDescription}", list 3-5 tactical execution tickets to complete this bet. Return a simple JSON array of strings.`;
  
   const responseSchema: Schema = {
    type: Type.ARRAY,
    items: { type: Type.STRING }
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
    console.error("Gemini Error:", error);
    return [];
  }
};