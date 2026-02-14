
import React, { useState, useEffect, useRef } from 'react';
import { useStore, generateId } from '../../store';
import { Icons } from '../../constants';
import { Campaign, TicketStatus } from '../../types';
import { GoogleGenAI } from "@google/genai";
import { generateFullCampaignFromChat } from '../../services/labService';

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
}

const SYSTEM_INSTRUCTION = `
    You are a Senior GTM Strategist. Your goal is to interview the user to extract deep context about their business to build a Go-To-Market Operating System.
    
    You need to understand:
    1. What they sell (Product/Service).
    2. Who they sell to (Audience/ICP).
    3. Their specific revenue or growth goals for this cycle.
    4. Their current biggest bottleneck.

    Rules:
    - Ask ONE question at a time.
    - Be conversational and succinct.
    - Start by introducing yourself and asking the first question (Product & Audience).
    - If the user context dumps, acknowledge it and ask clarifying questions if anything is missing.
    - Once you have enough information (usually 4-6 turns), you will just output a special token: "[READY_TO_BUILD]". Do not output this token unless you are sure.
`;

export const LabOnboarding: React.FC = () => {
  const { setCampaign, currentUser } = useStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const client = new GoogleGenAI({ apiKey: process.env.API_KEY });

  useEffect(() => {
      const initId = generateId();
      setMessages([{
          id: initId,
          role: 'model',
          text: "Hi, I'm your GTM Architect. To build your strategy, I need to understand your business. What are you selling and who is it for?"
      }]);
  }, []);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
      if (!input.trim() || isProcessing) return;
      
      const userMsg: ChatMessage = { id: generateId(), role: 'user', text: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsProcessing(true);

      try {
          const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
          
          const chat = client.chats.create({
              model: "gemini-3-flash-preview",
              history: history,
              config: { systemInstruction: SYSTEM_INSTRUCTION }
          });

          const result = await chat.sendMessage({ message: input });
          const responseText = result.text || "";

          if (responseText.includes("[READY_TO_BUILD]")) {
              const cleanText = responseText.replace("[READY_TO_BUILD]", "").trim();
              if (cleanText) {
                  setMessages(prev => [...prev, { id: generateId(), role: 'model', text: cleanText }]);
              }
              setIsReady(true);
          } else {
              setMessages(prev => [...prev, { id: generateId(), role: 'model', text: responseText }]);
          }

      } catch (e) {
          console.error(e);
          setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "I'm having trouble connecting. Please try again." }]);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleGenerate = async () => {
      setIsGenerating(true);
      
      const data = await generateFullCampaignFromChat(messages);
      
      if (data) {
          const newCampaign: Campaign = {
              id: generateId(),
              name: "Conversational Plan",
              objective: data.objective,
              startDate: new Date().toISOString(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
              status: 'Active',
              channels: data.channels.map((c: any) => ({
                  id: generateId(),
                  name: c.name,
                  campaignId: '', 
                  type: 'CHANNEL',
                  tags: c.tags || [],
                  tickets: c.tickets.map((t: any) => ({
                      id: generateId(),
                      shortId: `T-${Math.floor(Math.random() * 1000)}`,
                      title: t.title,
                      description: t.description,
                      status: TicketStatus.Todo,
                      priority: 'Medium',
                      channelId: '', 
                      assigneeId: currentUser.id,
                      createdAt: new Date().toISOString()
                  })),
                  principles: [],
                  links: [],
                  notes: [],
                  memberIds: []
              })),
              projects: [],
              principles: data.principles.map((p: any) => ({
                  id: generateId(),
                  title: p.title,
                  description: p.description,
                  category: p.category
              })),
              docFolders: [
                  { id: 'f_strategy', name: 'Strategy', createdAt: new Date().toISOString() },
                  { id: 'f_personas', name: 'Personas', createdAt: new Date().toISOString() },
                  { id: 'f_brand', name: 'Brand', createdAt: new Date().toISOString() },
                  { id: 'f_process', name: 'Process', createdAt: new Date().toISOString() },
              ],
              docs: data.docs.map((d: any) => {
                  let folderId = undefined;
                  if (d.type === 'STRATEGY') folderId = 'f_strategy';
                  else if (d.type === 'PERSONA') folderId = 'f_personas';
                  else if (d.type === 'BRAND') folderId = 'f_brand';
                  else if (d.type === 'PROCESS') folderId = 'f_process';
                  
                  return {
                      id: generateId(),
                      title: d.title,
                      content: d.content,
                      type: d.type,
                      folderId: folderId,
                      lastUpdated: new Date().toISOString(),
                      isAiGenerated: true
                  };
              })
          };

          newCampaign.channels.forEach(c => {
              c.campaignId = newCampaign.id;
              c.tickets.forEach(t => t.channelId = c.id);
          });

          setCampaign(newCampaign);
      } else {
          alert("Failed to generate plan. Please try again.");
          setIsGenerating(false);
      }
  };

  return (
    <div className="h-screen w-full bg-white text-zinc-900 flex flex-col font-sans">
        <div className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0">
            <div className="flex items-center gap-2 text-indigo-600">
                <Icons.Sparkles className="w-5 h-5" />
                <span className="font-bold tracking-wider">STRATEGY_LAB</span>
            </div>
            {isReady && !isGenerating && (
                <button 
                    onClick={handleGenerate}
                    className="px-4 py-1.5 bg-zinc-900 text-white font-bold text-xs rounded hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-lg"
                >
                    <Icons.Play className="w-3 h-3" /> GENERATE GTM OS
                </button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center bg-zinc-50/50">
            <div className="w-full max-w-2xl space-y-6 py-10">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-xl text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-white text-zinc-900 rounded-br-none border border-zinc-200' 
                            : 'bg-zinc-100 text-zinc-700 rounded-bl-none'
                        }`}>
                            {msg.role === 'model' && (
                                <div className="text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wider flex items-center gap-1">
                                    <Icons.Sparkles className="w-3 h-3" /> Architect
                                </div>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-100 text-zinc-400 p-4 rounded-xl rounded-bl-none flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-white flex justify-center shrink-0">
            <div className="w-full max-w-2xl relative">
                {isGenerating ? (
                    <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center rounded-lg text-center backdrop-blur-sm">
                        <Icons.Sparkles className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                        <span className="text-sm font-bold text-zinc-900">Synthesizing Strategy...</span>
                        <span className="text-xs text-zinc-500">Creating Docs, Channels, and Tasks</span>
                    </div>
                ) : null}
                
                <input 
                    className="w-full bg-white border border-zinc-200 rounded-xl p-4 pr-12 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none shadow-lg shadow-zinc-100 placeholder-zinc-400"
                    placeholder="Type your answer..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    autoFocus
                    disabled={isGenerating || isProcessing}
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isGenerating || isProcessing}
                    className="absolute right-3 top-3 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-0 transition-all"
                >
                    <Icons.ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};
