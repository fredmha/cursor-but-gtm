import React, { useState, useEffect, useRef } from 'react';
import { useStore, generateId } from '../../store';
import { Icons } from '../../constants';
import { Campaign, Status, ContextDoc } from '../../types';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { generateFullCampaignFromChat } from '../../services/labService';

// --- CHAT LOGIC ---

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

  // Gemini Client
  const client = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Initialize Chat
  useEffect(() => {
      // Initial AI Message
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
      
      // Call Service
      const data = await generateFullCampaignFromChat(messages);
      
      if (data) {
          // Construct Campaign
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
                  campaignId: '', // Fix later
                  type: 'CHANNEL',
                  tags: c.tags || [],
                  bets: c.bets.map((b: any) => ({
                      id: generateId(),
                      description: b.description,
                      hypothesis: b.hypothesis,
                      successCriteria: 'TBD',
                      status: Status.Active,
                      channelId: '', // Fix later
                      tickets: [],
                      ownerId: currentUser.id,
                      timeboxWeeks: 2
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
              roadmapItems: [],
              timelineTags: [],
              docs: data.docs.map((d: any) => ({
                  id: generateId(),
                  title: d.title,
                  content: d.content,
                  type: d.type,
                  lastUpdated: new Date().toISOString(),
                  isAiGenerated: true
              }))
          };

          // Fix IDs
          newCampaign.channels.forEach(c => {
              c.campaignId = newCampaign.id;
              c.bets.forEach(b => b.channelId = c.id);
          });

          setCampaign(newCampaign);
      } else {
          alert("Failed to generate plan. Please try again.");
          setIsGenerating(false);
      }
  };

  return (
    <div className="h-screen w-full bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950">
            <div className="flex items-center gap-2 text-indigo-500">
                <Icons.Sparkles className="w-5 h-5" />
                <span className="font-bold tracking-wider">STRATEGY_LAB</span>
            </div>
            {isReady && !isGenerating && (
                <button 
                    onClick={handleGenerate}
                    className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded hover:bg-zinc-200 transition-colors flex items-center gap-2"
                >
                    <Icons.Play className="w-3 h-3" /> GENERATE GTM OS
                </button>
            )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-6 py-10">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-xl text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700' 
                            : 'bg-indigo-900/20 text-indigo-100 rounded-bl-none border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                        }`}>
                            {msg.role === 'model' && (
                                <div className="text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                    <Icons.Sparkles className="w-3 h-3" /> Architect
                                </div>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-indigo-900/10 text-indigo-400 p-4 rounded-xl rounded-bl-none border border-indigo-500/10 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-center">
            <div className="w-full max-w-2xl relative">
                {isGenerating ? (
                    <div className="absolute inset-0 bg-zinc-900/90 z-10 flex flex-col items-center justify-center rounded-lg text-center">
                        <Icons.Sparkles className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                        <span className="text-sm font-bold text-white">Synthesizing Strategy...</span>
                        <span className="text-xs text-zinc-500">Creating Docs, Channels, and Bets</span>
                    </div>
                ) : null}
                
                <input 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pr-12 text-sm text-white focus:border-indigo-500 focus:outline-none shadow-lg placeholder-zinc-600"
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
