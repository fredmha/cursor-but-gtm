import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Content } from "@google/genai";
import { useStore, generateId } from '../store';
import { CORE_SYSTEM_INSTRUCTION, CORE_TOOLS, buildCoreContext } from '../services/reviewAgent';
import { ChatMessage, Priority, Ticket, TicketStatus } from '../types';
import { ChatKanbanCallout } from './ChatKanbanCallout';

type TicketTarget = {
    ticket: Ticket;
    parentId: string;
    type: 'CHANNEL' | 'PROJECT';
};

type TaskModalDraft = {
    id?: string;
    title?: string;
    description?: string;
    priority?: Priority;
    assigneeId?: string;
    channelId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    linkedDocIds?: string[];
};

type TaskModalState = {
    mode: 'create' | 'update';
    draft: TaskModalDraft;
    target?: TicketTarget;
    pendingStatus?: TicketStatus;
};

const formatError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
};

const parseToolArgs = (rawArgs: unknown): Record<string, unknown> => {
    if (!rawArgs) return {};
    if (typeof rawArgs === 'string') {
        try {
            const parsed = JSON.parse(rawArgs);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
        } catch {
            return {};
        }
    }
    if (typeof rawArgs === 'object') {
        return rawArgs as Record<string, unknown>;
    }
    return {};
};

const normalizeDateInput = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const dateOnly = new Date(`${trimmed}T00:00:00.000Z`);
        return Number.isNaN(dateOnly.getTime()) ? undefined : dateOnly.toISOString();
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
};

const toDateInputValue = (value?: string): string => {
    if (!value) return '';
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return dateOnlyMatch ? dateOnlyMatch[1] : '';
};

const normalizePriority = (value: unknown): Priority | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'urgent') return 'Urgent';
    if (normalized === 'high') return 'High';
    if (normalized === 'medium') return 'Medium';
    if (normalized === 'low') return 'Low';
    if (normalized === 'none') return 'None';
    return undefined;
};

const normalizeStatus = (value: unknown): TicketStatus | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toLowerCase();
    if (normalized.includes('todo')) return TicketStatus.Todo;
    if (normalized.includes('progress')) return TicketStatus.InProgress;
    if (normalized.includes('blocked')) return TicketStatus.Blocked;
    if (normalized.includes('done')) return TicketStatus.Done;
    return undefined;
};

const getDateArg = (args: Record<string, unknown>, key: 'startDate' | 'dueDate') => {
    if (key === 'dueDate') {
        return args.dueDate ?? args.endDate;
    }
    return args.startDate;
};

const tokenize = (value: string) =>
    value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 2);

const scoreSemanticMatch = (tokens: string[], targetText: string) => {
    if (tokens.length === 0) return 0;
    const haystack = targetText.toLowerCase();
    return tokens.reduce((score, token) => {
        if (!haystack.includes(token)) return score;
        return score + (token.length >= 6 ? 2 : 1);
    }, 0);
};

export const ReviewMode: React.FC = () => {
    const {
        campaign,
        currentUser,
        users,
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
    const [taskModalState, setTaskModalState] = useState<TaskModalState | null>(null);
    const [taskDraftError, setTaskDraftError] = useState<string | null>(null);

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

    const guessSemanticScope = (title: string, notes: string) => {
        if (!campaign) return { channelId: undefined as string | undefined, projectId: undefined as string | undefined };
        const channels = campaign.channels || [];
        const projects = campaign.projects || [];
        const queryTokens = tokenize(`${title} ${notes}`);
        if (queryTokens.length === 0) {
            return { channelId: channels[0]?.id, projectId: undefined };
        }

        const bestChannel = channels.reduce<{ id?: string; score: number }>(
            (best, channel) => {
                const targetText = `${channel.name} ${(channel.tags || []).join(' ')}`;
                const score = scoreSemanticMatch(queryTokens, targetText);
                if (score > best.score) return { id: channel.id, score };
                return best;
            },
            { score: 0 }
        );

        const bestProject = projects.reduce<{ id?: string; score: number }>(
            (best, project) => {
                const targetText = `${project.name} ${project.description || ''}`;
                const score = scoreSemanticMatch(queryTokens, targetText);
                if (score > best.score) return { id: project.id, score };
                return best;
            },
            { score: 0 }
        );

        if (bestProject.score > bestChannel.score && bestProject.id) {
            return { channelId: undefined, projectId: bestProject.id };
        }
        if (bestChannel.id) {
            return { channelId: bestChannel.id, projectId: undefined };
        }
        return { channelId: channels[0]?.id, projectId: undefined };
    };

    const buildDraftFromTicket = (ticket: Ticket, target?: TicketTarget): TaskModalDraft => ({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description || '',
        priority: ticket.priority,
        assigneeId: ticket.assigneeId || currentUser.id,
        channelId: target?.type === 'CHANNEL' ? target.parentId : ticket.channelId,
        projectId: target?.type === 'PROJECT' ? target.parentId : ticket.projectId,
        startDate: toDateInputValue(ticket.startDate),
        endDate: toDateInputValue(ticket.dueDate),
        linkedDocIds: ticket.linkedDocIds || []
    });

    const buildCreateDraftFromArgs = (args: Record<string, unknown>): TaskModalDraft => {
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        const notes = typeof args.notes === 'string' ? args.notes : '';
        const explicitChannelId = typeof args.channelId === 'string' ? args.channelId : undefined;
        const explicitProjectId = typeof args.projectId === 'string' ? args.projectId : undefined;

        const validChannelId = explicitChannelId && (campaign?.channels || []).some(c => c.id === explicitChannelId)
            ? explicitChannelId
            : undefined;
        const validProjectId = explicitProjectId && (campaign?.projects || []).some(p => p.id === explicitProjectId)
            ? explicitProjectId
            : undefined;

        const semantic = !validChannelId && !validProjectId
            ? guessSemanticScope(title, notes)
            : { channelId: undefined as string | undefined, projectId: undefined as string | undefined };

        return {
            title,
            description: notes,
            priority: normalizePriority(args.priority) || 'Medium',
            assigneeId: undefined,
            channelId: validChannelId || semantic.channelId,
            projectId: validProjectId || semantic.projectId,
            startDate: toDateInputValue(normalizeDateInput(getDateArg(args, 'startDate'))),
            endDate: toDateInputValue(normalizeDateInput(getDateArg(args, 'dueDate'))),
            linkedDocIds: []
        };
    };

    const buildUpdateDraftFromArgs = (target: TicketTarget, args: Record<string, unknown>): TaskModalDraft => {
        const ticket = target.ticket;
        const titleArg = typeof args.title === 'string' ? args.title.trim() : '';
        const hasNotes = Object.prototype.hasOwnProperty.call(args, 'notes');
        const notesArg = hasNotes && typeof args.notes === 'string' ? args.notes : undefined;
        const startArg = normalizeDateInput(getDateArg(args, 'startDate'));
        const dueArg = normalizeDateInput(getDateArg(args, 'dueDate'));
        const priorityArg = normalizePriority(args.priority);

        return {
            id: ticket.id,
            title: titleArg || ticket.title,
            description: notesArg !== undefined ? notesArg : (ticket.description || ''),
            priority: priorityArg || ticket.priority,
            assigneeId: ticket.assigneeId || currentUser.id,
            channelId: target.type === 'CHANNEL' ? target.parentId : ticket.channelId,
            projectId: target.type === 'PROJECT' ? target.parentId : ticket.projectId,
            startDate: toDateInputValue(startArg || ticket.startDate),
            endDate: toDateInputValue(dueArg || ticket.dueDate),
            linkedDocIds: ticket.linkedDocIds || []
        };
    };

    const handleTicketClick = (ticket: Ticket) => {
        const target = ticketIndex.get(ticket.id);
        if (!target) return;
        setTaskDraftError(null);
        setTaskModalState({
            mode: 'update',
            target,
            draft: buildDraftFromTicket(ticket, target)
        });
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

    const closeTaskModal = () => {
        setTaskDraftError(null);
        setTaskModalState(null);
    };

    const updateTaskDraftField = <K extends keyof TaskModalDraft>(key: K, value: TaskModalDraft[K]) => {
        setTaskDraftError(null);
        setTaskModalState(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                draft: {
                    ...prev.draft,
                    [key]: value
                }
            };
        });
    };

    const handleSaveTaskModal = () => {
        if (!taskModalState || !campaign) {
            setTaskModalState(null);
            return;
        }

        const draft = taskModalState.draft;
        const title = (draft.title || '').trim();
        if (!title) {
            setTaskDraftError("Task title is required before approval.");
            return;
        }
        const description = draft.description || '';
        const priority = draft.priority || 'Medium';
        const assigneeId = (draft.assigneeId || '').trim();
        if (!assigneeId) {
            setTaskDraftError("Assign an owner before submitting.");
            return;
        }
        const startDate = normalizeDateInput(draft.startDate);
        const dueDate = normalizeDateInput(draft.endDate);
        const channelId = (draft.channelId || '').trim() || undefined;
        const projectId = (draft.projectId || '').trim() || undefined;
        const linkedDocIds = draft.linkedDocIds || [];

        if (taskModalState.mode === 'create') {
            if ((campaign.channels || []).length === 0) {
                setTaskDraftError("Create at least one channel before approving this task.");
                return;
            }
            if (!channelId) {
                setTaskDraftError("Select a channel before approving this task.");
                return;
            }
            const newTicket: Ticket = {
                id: generateId(),
                shortId: '',
                title,
                description,
                status: TicketStatus.Todo,
                priority,
                createdAt: new Date().toISOString(),
                assigneeId,
                channelId,
                projectId,
                startDate,
                dueDate,
                linkedDocIds
            };
            addTicket(channelId, newTicket);
            setTaskDraftError(null);
            setTaskModalState(null);
            return;
        }

        const target = taskModalState.target;
        if (!target) {
            setTaskModalState(null);
            return;
        }

        const updates: Partial<Ticket> = {};
        const current = target.ticket;
        if (title !== current.title) updates.title = title;
        if (description !== (current.description || '')) updates.description = description;
        if (priority !== current.priority) updates.priority = priority;
        if (assigneeId !== (current.assigneeId || '')) updates.assigneeId = assigneeId;
        if (startDate && startDate !== current.startDate) updates.startDate = startDate;
        if (dueDate && dueDate !== current.dueDate) updates.dueDate = dueDate;
        if (taskModalState.pendingStatus && taskModalState.pendingStatus !== current.status) {
            updates.status = taskModalState.pendingStatus;
        }
        if (linkedDocIds.length > 0 || (current.linkedDocIds || []).length > 0) {
            updates.linkedDocIds = linkedDocIds;
        }

        if (Object.keys(updates).length > 0) {
            if (target.type === 'CHANNEL') {
                updateTicket(target.parentId, current.id, updates);
            } else {
                updateProjectTicket(target.parentId, current.id, updates);
            }
        }
        setTaskDraftError(null);
        setTaskModalState(null);
    };

    const handleDeleteTaskFromModal = (ticketId: string) => {
        const target = taskModalState?.target || ticketIndex.get(ticketId);
        if (!target) return;
        if (target.type === 'CHANNEL') {
            deleteTicket(target.parentId, ticketId);
        } else {
            deleteProjectTicket(target.parentId, ticketId);
        }
        setTaskModalState(null);
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
        const args = parseToolArgs(call.functionCall?.args);
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
            if ((campaign.channels || []).length === 0) {
                appendModelMessage("No channels exist yet. Create a channel before creating tasks.");
                await sendToolResponse(call, { result: "No channel available." });
                return;
            }
            const title = typeof args.title === 'string' ? args.title.trim() : '';
            if (!title) {
                await sendToolResponse(call, { result: "Missing task title." });
                return;
            }
            const draft = buildCreateDraftFromArgs(args);
            setTaskDraftError(null);
            setTaskModalState({
                mode: 'create',
                draft
            });
            await sendToolResponse(call, { result: "Create task inline draft opened for approval." });
            return;
        }

        if (name === 'update_task') {
            const ticketId = typeof args.ticketId === 'string' ? args.ticketId : '';
            const target = ticketIndex.get(ticketId);
            if (!target) {
                await sendToolResponse(call, { result: "Task not found." });
                return;
            }
            setTaskDraftError(null);
            setTaskModalState({
                mode: 'update',
                target,
                draft: buildUpdateDraftFromArgs(target, args),
                pendingStatus: normalizeStatus(args.status)
            });
            await sendToolResponse(call, { result: "Update task inline draft opened for approval." });
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
                                                channels={campaign?.channels || []}
                                                users={users}
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

                    {taskModalState && (
                        <div className="mb-6 flex justify-start">
                            <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        {taskModalState.mode === 'create' ? 'Create Task Draft' : 'Update Task Draft'}
                                    </span>
                                    {taskModalState.pendingStatus && (
                                        <span className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600">
                                            Status: {taskModalState.pendingStatus}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <input
                                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                                        value={taskModalState.draft.title || ''}
                                        placeholder="Task title"
                                        onChange={(e) => updateTaskDraftField('title', e.target.value)}
                                    />
                                    <textarea
                                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-indigo-500 focus:outline-none"
                                        value={taskModalState.draft.description || ''}
                                        placeholder="Description"
                                        rows={3}
                                        onChange={(e) => updateTaskDraftField('description', e.target.value)}
                                    />

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Owner *</label>
                                            <select
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none"
                                                value={taskModalState.draft.assigneeId || ''}
                                                onChange={(e) => updateTaskDraftField('assigneeId', e.target.value || undefined)}
                                            >
                                                <option value="">Select owner</option>
                                                {users.map(user => (
                                                    <option key={user.id} value={user.id}>{user.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Priority</label>
                                            <select
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none"
                                                value={taskModalState.draft.priority || 'Medium'}
                                                onChange={(e) => updateTaskDraftField('priority', normalizePriority(e.target.value) || 'Medium')}
                                            >
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Start Date</label>
                                            <input
                                                type="date"
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none"
                                                value={taskModalState.draft.startDate || ''}
                                                onChange={(e) => updateTaskDraftField('startDate', e.target.value || undefined)}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">End Date</label>
                                            <input
                                                type="date"
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none"
                                                value={taskModalState.draft.endDate || ''}
                                                onChange={(e) => updateTaskDraftField('endDate', e.target.value || undefined)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Channel</label>
                                            <select
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none disabled:bg-zinc-100"
                                                value={taskModalState.draft.channelId || ''}
                                                disabled={taskModalState.mode === 'update'}
                                                onChange={(e) => updateTaskDraftField('channelId', e.target.value || undefined)}
                                            >
                                                <option value="">Select channel</option>
                                                {(campaign?.channels || []).map(channel => (
                                                    <option key={channel.id} value={channel.id}>{channel.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Project</label>
                                            <select
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none disabled:bg-zinc-100"
                                                value={taskModalState.draft.projectId || ''}
                                                disabled={taskModalState.mode === 'update'}
                                                onChange={(e) => updateTaskDraftField('projectId', e.target.value || undefined)}
                                            >
                                                <option value="">No project</option>
                                                {(campaign?.projects || []).map(project => (
                                                    <option key={project.id} value={project.id}>{project.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {taskDraftError && (
                                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {taskDraftError}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        {taskModalState.mode === 'update' ? (
                                            <button
                                                onClick={() => taskModalState.draft.id && handleDeleteTaskFromModal(taskModalState.draft.id)}
                                                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                                Delete Task
                                            </button>
                                        ) : (
                                            <span />
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={closeTaskModal}
                                                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveTaskModal}
                                                className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                                            >
                                                Approve Draft
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                        {'->'}
                    </button>
                </div>
            </div>
        </div>
    );
};
