import { GoogleGenAI } from "@google/genai";
import { Thread, Signal } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in process.env.API_KEY");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const findSemanticConnections = async (
  currentContent: string,
  existingThreads: Thread[],
  signals: Signal[]
): Promise<string[]> => {
  const client = getClient();
  if (!client) return [];

  // Prepare a context summary
  const context = `
    Current Thought: "${currentContent}"
    
    Existing Database:
    ${existingThreads.map(t => `- Thread: ${t.content} (Reason: ${t.reason})`).join('\n')}
    ${signals.filter(s => s.status === 'UNREVIEWED').map(s => `- Signal: ${s.content}`).join('\n')}
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a knowledge graph assistant. 
      Analyze the "Current Thought" against the "Existing Database".
      Identify up to 3 most relevant items from the database that strictly relate to the current thought.
      Return ONLY the exact text content of the related items in a simple list.
      If nothing is related, return "None".
      
      ${context}`
    });

    const text = response.text || "";
    if (text.includes("None")) return [];
    
    return text.split('\n')
      .map(line => line.replace(/^- /, '').trim())
      .filter(line => line.length > 0);
      
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};

export const suggestRefinement = async (signalContent: string): Promise<string> => {
    const client = getClient();
    if (!client) return "";
  
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `A user has captured this raw signal: "${signalContent}". 
        They want to turn it into a long-term thread.
        Suggest a concise, provocative question that explores *why* this matters. 
        Max 15 words.`,
      });
      return response.text || "";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "";
    }
  };
