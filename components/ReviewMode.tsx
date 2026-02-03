import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Content } from "@google/genai";
import { useStore, generateId } from '../store';
import { CORE_SYSTEM_INSTRUCTION, CORE_TOOLS, buildCoreContext } from '../services/reviewAgent';
import { ChatMessage, Ticket, TicketStatus } from '../types';
import { ChatKanbanCallout } from './ChatKanbanCallout';
import { TicketModal } from './TicketModal';

type TicketTarget = {
    ticket: Ticket;
    parentId: string;
    type: 'CHANNEL' | 'PROJECT';
};

const formatError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
};

export const ReviewMode: React.FC = () => {
    const {
        campaign,
        currentUser,
        updateChatHistory,
        updateTicket,
        updateProjectTicket,
        deleteTicket,
        deleteProjectTicket,
        addTicket
    } = useStore();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [clientError, setClientError] = useState<string | null>(null);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const chatRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const apiKey = "AIzaSyAvHokD5AdbLMPbKyFEgpTfq0HI7NTJ4cQ";
    const client = useMemo(() => {
        if (!apiKey) return null;
        try {
            return new GoogleGenAI({ apiKey });
        } catch (e) {
            console.error("Gemini Client Error:", e);
            return null;
        }
    }, [apiKey]);

    useEffect(() => {
        if (!campaign) {
            setMessages([]);
            return;
        }
        if (campaign.dailyChatHistory && campaign.dailyChatHistory.length > 0) {
            setMessages(campaign.dailyChatHistory);
        } else {
            setMessages([]);
        }
    }, [campaign]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const appendTextMessage = (role: 'user' | 'model', text: string) => {
        const message: ChatMessage = {
            id: generateId(),
            role,
            parts: [{ text }],
            timestamp: Date.now()
        };
        setMessages(prev => {
            const next = [...prev, message];
            updateChatHistory('DAILY', next);
            return next;
        });
        return message;
    };

    const appendUserMessage = (text: string) => appendTextMessage('user', text);
    const appendModelMessage = (text: string) => appendTextMessage('model', text);

    const renderInline = (text: string) => {
        const tokens = text.split(/(\*\*[^*]+\*\*)/g);
        return tokens.map((token, idx) => {
            if (token.startsWith('**') && token.endsWith('**')) {
                return <strong key={idx}>{token.slice(2, -2)}</strong>;
            }
            return <React.Fragment key={idx}>{token}</React.Fragment>;
        });
    };

    const renderFormattedMessage = (text: string) => {
        const blocks = text.split(/\n{2,}/);
        return blocks.map((block, idx) => {
            const trimmed = block.trim();
            if (!trimmed) return null;

            if (trimmed.startsWith('### ')) {
                return (
                    <h4 key={idx} className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        {renderInline(trimmed.replace(/^###\s+/, ''))}
                    </h4>
                );
            }
            if (trimmed.startsWith('## ')) {
                return (
                    <h3 key={idx} className="text-sm font-semibold text-zinc-900">
                        {renderInline(trimmed.replace(/^##\s+/, ''))}
                    </h3>
                );
            }
            if (trimmed.startsWith('# ')) {
                return (
                    <h2 key={idx} className="text-base font-bold text-zinc-900">
                        {renderInline(trimmed.replace(/^#\s+/, ''))}
                    </h2>
                );
            }

            const lines = trimmed.split('\n');
            const isList = lines.every(line => line.trim().startsWith('- '));
            if (isList) {
                return (
                    <ul key={idx} className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
                        {lines.map((line, lineIdx) => (
                            <li key={lineIdx}>{renderInline(line.replace(/^\s*-\s+/, ''))}</li>
                        ))}
                    </ul>
                );
            }

            return (
                <p key={idx} className="text-sm leading-relaxed text-zinc-700">
                    {lines.map((line, lineIdx) => (
                        <React.Fragment key={lineIdx}>
                            {renderInline(line)}
                            {lineIdx < lines.length - 1 ? <br /> : null}
                        </React.Fragment>
                    ))}
                </p>
            );
        });
    };

    const ticketTargets = useMemo(() => {
        const targets: TicketTarget[] = [];
        (campaign?.channels || []).forEach(channel => {
            channel.tickets.forEach(ticket => {
                if (ticket.assigneeId === currentUser.id) {
                    targets.push({ ticket, parentId: channel.id, type: 'CHANNEL' });
                }
            });
        });
        (campaign?.projects || []).forEach(project => {
            project.tickets.forEach(ticket => {
                if (ticket.assigneeId === currentUser.id) {
                    targets.push({ ticket, parentId: project.id, type: 'PROJECT' });
                }
            });
        });
        return targets;
    }, [campaign, currentUser.id]);

    const ticketIndex = useMemo(() => {
        const map = new Map<string, TicketTarget>();
        ticketTargets.forEach(target => map.set(target.ticket.id, target));
        return map;
    }, [ticketTargets]);

    const handleTicketClick = (ticket: Ticket) => {
        setEditingTicket(ticket);
        setShowTicketModal(true);
    };

    const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
        const target = ticketIndex.get(ticketId);
        if (!target) return;
        if (target.type === 'CHANNEL') {
            updateTicket(target.parentId, ticketId, { status: newStatus });
        } else {
            updateProjectTicket(target.parentId, ticketId, { status: newStatus });
        }
    };

    const closeTicketModal = () => {
        setEditingTicket(null);
        setShowTicketModal(false);
    };

    const handleSaveEditedTicket = (data: any) => {
        if (!editingTicket) return;
        const target = ticketIndex.get(editingTicket.id);
        if (!target) return;

        const updates: Partial<Ticket> = {};
        if (data.title !== editingTicket.title) updates.title = data.title;
        if ((data.description ?? '') !== (editingTicket.description ?? '')) updates.description = data.description;

        if (Object.keys(updates).length === 0) {
            closeTicketModal();
            return;
        }

        if (target.type === 'CHANNEL') {
            updateTicket(target.parentId, editingTicket.id, updates);
        } else {
            updateProjectTicket(target.parentId, editingTicket.id, updates);
        }
        closeTicketModal();
    };

    const handleDeleteEditedTicket = (ticketId: string) => {
        const target = ticketIndex.get(ticketId);
        if (!target) return;
        if (target.type === 'CHANNEL') {
            deleteTicket(target.parentId, ticketId);
        } else {
            deleteProjectTicket(target.parentId, ticketId);
        }
        closeTicketModal();
    };

    const initChat = async (existingMessages: ChatMessage[]) => {
        if (!campaign || !client) return;
        try {
            const context = buildCoreContext(campaign, currentUser);
            const historyContent: Content[] = [
                { role: 'user', parts: [{ text: context }] },
                { role: 'model', parts: [{ text: "Context received." }] },
                ...existingMessages.map(m => ({
                    role: m.role,
                    parts: m.parts
                }))
            ];

            const chat = await client.chats.create({
                model: "gemini-3-flash-preview",
                config: {
                    systemInstruction: CORE_SYSTEM_INSTRUCTION,
                    tools: CORE_TOOLS,
                    temperature: 0.7
                },
                history: historyContent
            });
            chatRef.current = chat;
            if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') {
                setClientError("Chat client failed to initialize. Check the model name and API key.");
            }
        } catch (e) {
            console.error("Chat Init Error:", e);
            setClientError(`Chat failed to initialize: ${formatError(e)}`);
            setIsTyping(false);
        }
    };

    const ensureChat = async () => {
        if (chatRef.current || !client || !campaign) return;
        await initChat(messages);
    };

    const sendToolResponse = async (call: any, response: Record<string, unknown>) => {
        if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') return;
        const toolResponse = {
            functionResponse: {
                name: call.functionCall?.name || call.name,
                id: call.functionCall?.id || call.callId || generateId(),
                response
            }
        };
        const reply = await chatRef.current.sendMessage({ message: [toolResponse] });
        await processResponse(reply);
    };

    const handleToolCall = async (call: any) => {
        const name = call.functionCall?.name;
        const args = call.functionCall?.args || {};
        if (!name) return;

        if (name === 'show_tasks') {
            await sendToolResponse(call, { result: "Displayed tasks in chat." });
            return;
        }

        if (name === 'create_task') {
            if (!campaign) {
                await sendToolResponse(call, { result: "No campaign available." });
                return;
            }
            const title = typeof args.title === 'string' ? args.title.trim() : '';
            const notes = typeof args.notes === 'string' ? args.notes.trim() : '';
            if (!title) {
                await sendToolResponse(call, { result: "Missing task title." });
                return;
            }
            const channelId = campaign.channels?.[0]?.id;
            if (!channelId) {
                appendModelMessage("No task log exists—create a channel first.");
                await sendToolResponse(call, { result: "No channel available." });
                return;
            }
            const newTicket: Ticket = {
                id: generateId(),
                shortId: '',
                title,
                description: notes,
                status: TicketStatus.Todo,
                priority: 'Medium',
                createdAt: new Date().toISOString(),
                assigneeId: currentUser.id,
                channelId,
                projectId: undefined,
                startDate: undefined,
                dueDate: undefined,
                linkedDocIds: []
            };
            addTicket(channelId, newTicket);
            await sendToolResponse(call, { result: "Task created." });
            return;
        }

        if (name === 'update_task') {
            const ticketId = typeof args.ticketId === 'string' ? args.ticketId : '';
            const target = ticketIndex.get(ticketId);
            if (!target) {
                await sendToolResponse(call, { result: "Task not found." });
                return;
            }
            const updates: Partial<Ticket> = {};
            if (typeof args.title === 'string' && args.title.trim()) updates.title = args.title.trim();
            if (typeof args.notes === 'string') updates.description = args.notes;
            if (typeof args.status === 'string') {
                const normalized = args.status.toLowerCase();
                if (normalized.includes('todo')) updates.status = TicketStatus.Todo;
                if (normalized.includes('progress')) updates.status = TicketStatus.InProgress;
                if (normalized.includes('blocked')) updates.status = TicketStatus.Blocked;
                if (normalized.includes('done')) updates.status = TicketStatus.Done;
            }
            if (Object.keys(updates).length === 0) {
                await sendToolResponse(call, { result: "No updates applied." });
                return;
            }
            if (target.type === 'CHANNEL') {
                updateTicket(target.parentId, ticketId, updates);
            } else {
                updateProjectTicket(target.parentId, ticketId, updates);
            }
            await sendToolResponse(call, { result: "Task updated." });
            return;
        }

        if (name === 'delete_task') {
            const ticketId = typeof args.ticketId === 'string' ? args.ticketId : '';
            const target = ticketIndex.get(ticketId);
            if (!target) {
                await sendToolResponse(call, { result: "Task not found." });
                return;
            }
            if (target.type === 'CHANNEL') {
                deleteTicket(target.parentId, ticketId);
            } else {
                deleteProjectTicket(target.parentId, ticketId);
            }
            await sendToolResponse(call, { result: "Task deleted." });
            return;
        }
    };

    const processResponse = async (response: any) => {
        if (response.candidates && response.candidates[0]) {
            const content = response.candidates[0].content;
            const parts = content.parts;

            const newMsg: ChatMessage = {
                id: generateId(),
                role: 'model',
                parts,
                timestamp: Date.now()
            };

            setMessages(prev => {
                const next = [...prev, newMsg];
                updateChatHistory('DAILY', next);
                return next;
            });

            const toolCalls = parts.filter((p: any) => p.functionCall);
            for (const call of toolCalls) {
                await handleToolCall(call);
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        if (!campaign) return;

        const rawText = input;
        setInput('');
        appendUserMessage(rawText);

        if (!chatRef.current) {
            await ensureChat();
        }
        if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') {
            setClientError("Chat is not ready. Please try again.");
            return;
        }

        setIsTyping(true);
        try {
            const response = await chatRef.current.sendMessage({ message: rawText });
            await processResponse(response);
        } catch (e) {
            console.error("Chat Send Error:", e);
            setClientError(`Chat failed to respond: ${formatError(e)}`);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto p-8">
                    {clientError && (
                        <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            {clientError}
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`mb-6 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.parts.map((part, pIdx) => {
                                if (part.functionCall?.name === 'show_tasks') {
                                    const ids = Array.isArray(part.functionCall?.args?.ticketIds)
                                        ? part.functionCall?.args?.ticketIds
                                        : [];
                                    const title = part.functionCall?.args?.title;
                                    const tickets = ids
                                        .map((id: string) => ticketIndex.get(id)?.ticket)
                                        .filter(Boolean) as Ticket[];
                                    return (
                                        <div key={pIdx} className="w-full">
                                            <ChatKanbanCallout
                                                title={title}
                                                tickets={tickets}
                                                channels={[]}
                                                users={[currentUser]}
                                                onTicketClick={handleTicketClick}
                                                onStatusChange={handleStatusChange}
                                            />
                                        </div>
                                    );
                                }
                                if (part.text) {
                                    const isUser = msg.role === 'user';
                                    return (
                                        <div key={pIdx} className={`px-5 py-3.5 rounded-2xl shadow-sm max-w-[85%] ${
                                            isUser
                                            ? 'bg-zinc-900 text-white rounded-br-sm text-sm leading-relaxed'
                                            : 'bg-white border border-zinc-100 rounded-bl-sm'
                                        }`}>
                                            {isUser ? part.text : (
                                                <div className="space-y-2">
                                                    {renderFormattedMessage(part.text)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start mb-6">
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

            <div className="p-6 bg-white border-t border-zinc-100 shrink-0">
                <div className="max-w-2xl mx-auto relative">
                    <input
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 pr-12 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder-zinc-400"
                        placeholder="Ask your task agent..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        autoFocus
                        disabled={isTyping}
                        ref={inputRef}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-0 transition-all"
                    >
                        <span className="sr-only">Send</span>
                        →
                    </button>
                </div>
            </div>

            {showTicketModal && editingTicket && (
                <TicketModal
                    variant="core"
                    initialData={{
                        id: editingTicket.id,
                        title: editingTicket.title,
                        description: editingTicket.description
                    }}
                    context={{
                        channels: [],
                        projects: [],
                        users: [currentUser],
                        docs: []
                    }}
                    onClose={closeTicketModal}
                    onSave={handleSaveEditedTicket}
                    onDelete={(id) => handleDeleteEditedTicket(id)}
                />
            )}
        </div>
    );
};
