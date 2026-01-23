
import React, { useState, useEffect, useRef } from 'react';
import { useStore, generateId } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { GoogleGenAI, Content, Part } from "@google/genai";
import { REVIEW_TOOLS, SYSTEM_INSTRUCTION, buildReviewContext } from '../services/reviewAgent';
import { TicketStatus } from '../types';
import { AgentTicketCard } from './AgentTicketCard';

interface Message {
    id: string;
    role: 'user' | 'model';
    parts: Part[];
    isToolResponse?: boolean; // If true, this is a synthetic message confirming tool execution
}

interface PendingAction {
    id: string; // UI ID
    callId?: string; // Gemini Tool Call ID
    name: string;
    args: any;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const WeeklyReviewAgent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { campaign, updateTicket, updateProjectTicket, deleteTicket, deleteProjectTicket, addTicket, addProjectTicket, currentUser, users } = useStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    
    const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chatRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- Init Session ---
    useEffect(() => {
        if (!campaign) return;

        const initChat = async () => {
            const history: Content[] = [
                { role: 'user', parts: [{ text: buildReviewContext(campaign) }] },
                { role: 'model', parts: [{ text: "Understood. I have the context. I'm ready to review." }] }
            ];

            const chat = client.chats.create({
                model: "gemini-3-flash-preview",
                config: { 
                    systemInstruction: SYSTEM_INSTRUCTION, 
                    tools: REVIEW_TOOLS,
                    temperature: 0.7 
                },
                history: history
            });
            chatRef.current = chat;

            // Start the conversation
            setIsTyping(true);
            try {
                const response = await chat.sendMessage({ message: "Let's start the review. Check the overdue tickets first." });
                
                // Process initial response
                if (response.candidates && response.candidates[0]) {
                    const content = response.candidates[0].content;
                    const parts = content.parts;
                    
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'model',
                        parts: parts
                    }]);

                    // Check for tool calls immediately
                    const toolCalls = parts.filter(p => p.functionCall);
                    if (toolCalls.length > 0) {
                        const newActions = toolCalls.map(tc => ({
                            id: generateId(), // UI ID
                            callId: tc.functionCall!.id,
                            name: tc.functionCall!.name,
                            args: tc.functionCall!.args,
                            status: 'PENDING' as const
                        }));
                        setPendingActions(prev => [...prev, ...newActions]);
                    }
                }
            } catch (e) {
                console.error("Agent Start Error:", e);
            } finally {
                setIsTyping(false);
            }
        };

        initChat();
    }, []);

    // --- Scroll to Bottom ---
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, pendingActions]);

    // --- Actions State Management ---
    const updateActionArgs = (id: string, updates: any) => {
        setPendingActions(prev => prev.map(a => 
            a.id === id ? { ...a, args: { ...a.args, ...updates } } : a
        ));
    };

    // --- Handle User Message ---
    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const text = input;
        setInput('');

        setMessages(prev => [...prev, { id: generateId(), role: 'user', parts: [{ text }] }]);
        setIsTyping(true);

        try {
            const response = await chatRef.current.sendMessage({ message: text });
            
            if (response.candidates && response.candidates[0]) {
                const parts = response.candidates[0].content.parts;
                
                // Add Model Response
                setMessages(prev => [...prev, { id: generateId(), role: 'model', parts }]);

                // Extract Tools
                const toolCalls = parts.filter((p: Part) => p.functionCall);
                if (toolCalls.length > 0) {
                    const newActions = toolCalls.map((tc: Part) => ({
                        id: generateId(),
                        callId: tc.functionCall!.id,
                        name: tc.functionCall!.name,
                        args: tc.functionCall!.args,
                        status: 'PENDING' as const
                    }));
                    setPendingActions(prev => [...prev, ...newActions]);
                }
            }
        } catch (e) {
            console.error("Chat Error:", e);
        } finally {
            setIsTyping(false);
        }
    };

    // --- Handle Action Approval ---
    const handleAction = async (action: PendingAction, approved: boolean) => {
        // 1. Update UI State
        setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, status: approved ? 'APPROVED' : 'REJECTED' } : a));

        // 2. Execute Store Logic (If Approved)
        if (approved) {
            const { name, args } = action;
            if (name === 'propose_reschedule') {
                const { ticketId, newDate } = args;
                // Find ticket parent
                const channelTicket = (campaign?.channels || []).flatMap(c => c.tickets).find(t => t.id === ticketId);
                const projectTicket = (campaign?.projects || []).flatMap(p => p.tickets).find(t => t.id === ticketId);
                
                if (channelTicket && channelTicket.channelId) {
                    updateTicket(channelTicket.channelId, ticketId, { dueDate: newDate });
                } else if (projectTicket && projectTicket.projectId) {
                    updateProjectTicket(projectTicket.projectId, ticketId, { dueDate: newDate });
                }
            }
            else if (name === 'propose_status_change') {
                const { ticketId, status } = args;
                const newStatus = status === 'Done' ? TicketStatus.Done : status === 'Canceled' ? TicketStatus.Canceled : TicketStatus.Backlog;
                
                const channelTicket = (campaign?.channels || []).flatMap(c => c.tickets).find(t => t.id === ticketId);
                const projectTicket = (campaign?.projects || []).flatMap(p => p.tickets).find(t => t.id === ticketId);

                if (channelTicket && channelTicket.channelId) {
                    if (status === 'Canceled') deleteTicket(channelTicket.channelId, ticketId);
                    else updateTicket(channelTicket.channelId, ticketId, { status: newStatus });
                } else if (projectTicket && projectTicket.projectId) {
                    if (status === 'Canceled') deleteProjectTicket(projectTicket.projectId, ticketId);
                    else updateProjectTicket(projectTicket.projectId, ticketId, { status: newStatus });
                }
            }
            else if (name === 'propose_ticket') {
                const { title, description, channelId, projectId, priority, assigneeId } = args;
                const newTicket = {
                    id: generateId(),
                    shortId: `T-${Math.floor(Math.random() * 1000)}`,
                    title,
                    description,
                    priority: priority || 'Medium',
                    status: TicketStatus.Todo,
                    assigneeId: assigneeId || currentUser.id,
                    createdAt: new Date().toISOString()
                };

                if (channelId) addTicket(channelId, { ...newTicket, channelId });
                else if (projectId) addProjectTicket(projectId, { ...newTicket, projectId });
            }
        }

        // 3. Inform Agent (Send Tool Response)
        const toolResponse = {
            functionResponse: {
                name: action.name,
                id: action.callId, // Echo back the call ID if present
                response: { result: approved ? "Action executed successfully." : "User rejected this proposal." }
            }
        };

        // We need to send this 'hidden' message to the model to advance the turn
        setIsTyping(true);
        try {
            // Note: In a real implementation with streaming, we'd append. 
            // Here we just send the tool response as a message part to the existing chat session.
            // The SDK handles the tool response turn.
            
            // Fix: Wrapped in { message: [...] } to match SDK signature
            const response = await chatRef.current.sendMessage({ message: [toolResponse] });
            
            if (response.candidates && response.candidates[0]) {
                setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'model',
                    parts: response.candidates[0].content.parts
                }]);
                
                // Recursively check for new tools (chained actions)
                const toolCalls = response.candidates[0].content.parts.filter((p: Part) => p.functionCall);
                if (toolCalls.length > 0) {
                    const newActions = toolCalls.map((tc: Part) => ({
                        id: generateId(),
                        callId: tc.functionCall!.id,
                        name: tc.functionCall!.name,
                        args: tc.functionCall!.args,
                        status: 'PENDING' as const
                    }));
                    setPendingActions(prev => [...prev, ...newActions]);
                }
            }
        } catch (e) {
            console.error("Tool Response Error:", e);
        } finally {
            setIsTyping(false);
        }
    };

    // --- Renderers ---

    const renderActionCard = (action: PendingAction) => {
        const { name, args, status } = action;
        const isPending = status === 'PENDING';
        
        // High-Fidelity Ticket Proposal
        if (name === 'propose_ticket') {
            return (
                <AgentTicketCard 
                    key={action.id}
                    actionId={action.id}
                    args={args}
                    status={status}
                    users={users}
                    channels={campaign?.channels || []}
                    projects={campaign?.projects || []}
                    onUpdate={(updates) => updateActionArgs(action.id, updates)}
                    onApprove={() => handleAction(action, true)}
                    onReject={() => handleAction(action, false)}
                />
            );
        }

        // Standard Actions (Reschedule / Status Change)
        let content = null;
        let icon = null;
        // Styles for the header stripe
        let stripeColor = "bg-zinc-100";
        let iconColor = "text-zinc-500";
        
        if (name === 'propose_reschedule') {
            icon = <Icons.Clock className="w-4 h-4" />;
            stripeColor = "bg-amber-50";
            iconColor = "text-amber-500";
            content = (
                <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Reschedule Proposal</div>
                    <div className="text-lg font-semibold text-zinc-900 mb-1">
                        Move to <span className="text-amber-600 bg-amber-50 px-2 rounded-md">{args.newDate}</span>
                    </div>
                    <div className="text-sm text-zinc-500 italic">"{args.reason}"</div>
                </div>
            );
        } 
        else if (name === 'propose_status_change') {
            icon = <Icons.CheckCircle className="w-4 h-4" />;
            stripeColor = "bg-emerald-50";
            iconColor = "text-emerald-500";
            content = (
                <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Status Update</div>
                    <div className="text-lg font-semibold text-zinc-900 mb-1">
                        Mark as <span className="font-bold text-emerald-600 bg-emerald-50 px-2 rounded-md">{args.status}</span>
                    </div>
                    <div className="text-sm text-zinc-500 italic">"{args.reason}"</div>
                </div>
            );
        }

        return (
            <div key={action.id} className={`w-full my-6 bg-white border border-zinc-100 shadow-xl shadow-zinc-200/50 rounded-2xl overflow-hidden relative group animate-in fade-in slide-in-from-bottom-2 duration-300 ${!isPending ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                <div className="flex">
                    {/* Left Stripe */}
                    <div className={`w-1.5 ${stripeColor.replace('/50', '-500')}`} />
                    
                    <div className="flex-1 p-5">
                         <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-zinc-100 shadow-sm ${stripeColor} ${iconColor}`}>
                                {icon}
                            </div>
                            <div className="flex-1">
                                {content}
                            </div>
                        </div>

                        {isPending ? (
                            <div className="flex justify-end gap-3 mt-6">
                                <button 
                                    onClick={() => handleAction(action, false)}
                                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-500 text-xs font-bold rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                                >
                                    Dismiss
                                </button>
                                <button 
                                    onClick={() => handleAction(action, true)}
                                    className="px-6 py-2 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200 hover:scale-105 active:scale-95"
                                >
                                    Confirm
                                </button>
                            </div>
                        ) : (
                            <div className="absolute top-5 right-5">
                                {status === 'APPROVED' ? (
                                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                        <Icons.CheckCircle className="w-3.5 h-3.5" /> Approved
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs bg-zinc-100 px-3 py-1.5 rounded-full border border-zinc-200">
                                        Dismissed
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col font-sans text-zinc-900">
            {/* Header */}
            <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-zinc-200">
                        <Icons.Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm text-zinc-900">Chief of Staff</h2>
                        <span className="text-[10px] text-zinc-500 font-medium">Weekly Review Agent</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors">
                    <Icons.XCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto bg-[#fafafa]">
                <div className="max-w-2xl mx-auto px-6 py-8">
                    {messages.map((msg, idx) => {
                        return (
                            <div key={msg.id} className={`mb-6 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {msg.parts.map((part, pIdx) => {
                                    if (part.text) {
                                        return (
                                            <div key={pIdx} className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[85%] ${
                                                msg.role === 'user' 
                                                ? 'bg-zinc-900 text-white rounded-br-sm' 
                                                : 'bg-white border border-zinc-100 text-zinc-700 rounded-bl-sm'
                                            }`}>
                                                {part.text}
                                            </div>
                                        );
                                    }
                                    if (part.functionCall) {
                                        return null; 
                                    }
                                    return null;
                                })}
                            </div>
                        );
                    })}
                    
                    {/* Render Action Cards */}
                    {pendingActions.map(action => renderActionCard(action))}

                    {isTyping && (
                        <div className="flex justify-start mb-6 animate-in fade-in duration-300">
                            <div className="bg-white border border-zinc-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1.5 items-center">
                                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-zinc-100 shrink-0">
                <div className="max-w-2xl mx-auto relative">
                    <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 pr-12 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder-zinc-400"
                        placeholder="Reply to the agent..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        autoFocus
                        disabled={isTyping || pendingActions.some(a => a.status === 'PENDING')} 
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-0 transition-all"
                    >
                        <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="max-w-2xl mx-auto mt-2 text-center">
                    <p className="text-[10px] text-zinc-400">AI executes actions only upon your approval.</p>
                </div>
            </div>
        </div>
    );
};
