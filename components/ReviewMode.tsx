
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { GoogleGenAI, Content } from "@google/genai";
import { 
    WEEKLY_TOOLS, DAILY_TOOLS, 
    WEEKLY_SYSTEM_INSTRUCTION, DAILY_SYSTEM_INSTRUCTION, 
    buildWeeklyContext, buildDailyContext 
} from '../services/reviewAgent';
import { TicketStatus, ChatMessage, Ticket, Priority, ContextDoc } from '../types';
import { AgentTicketCard } from './AgentTicketCard';
import { buildReviewAgentTestCampaign } from '../fixtures/reviewAgentFixture';
import { ChatKanbanCallout } from './ChatKanbanCallout';
import { TicketModal } from './TicketModal';
import { BulkTaskCallout, BulkDraftTask } from './BulkTaskCallout';

interface PendingAction {
    id: string; 
    callId?: string;
    name: string;
    args: any;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

type MentionCandidate =
    | { kind: 'ticket'; id: string; token: string; label: string }
    | { kind: 'doc'; id: string; token: string; label: string }
    | { kind: 'user'; id: string; token: string; label: string }
    | { kind: 'channel'; id: string; token: string; label: string }
    | { kind: 'project'; id: string; token: string; label: string };

type ReferenceType = 'ticket' | 'doc' | 'channel' | 'project' | 'user';

type ReferenceEntity = {
    type: ReferenceType;
    id: string;
    label: string;
    shortId?: string;
    token: string;
    aliasTokens: string[];
    labelNormalized: string;
};

type TicketModalInitialData = {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: Priority;
    assigneeId?: string;
    channelId?: string;
    projectId?: string;
    durationWeeks?: number;
    startDate?: string;
    endDate?: string;
    linkedDocIds?: string[];
};

type TicketTarget = {
    ticket: Ticket;
    parentId: string;
    type: 'CHANNEL' | 'PROJECT';
};

type InlineEditDraft = {
    target: TicketTarget;
    form: TicketModalInitialData;
};

type BulkDraft = {
    origin: string;
    tasks: BulkDraftTask[];
    callId?: string;
};

const normalizeMentionToken = (token: string) => token.replace(/^@/, '').trim().toLowerCase();
const cleanExtract = (value: string) => value.trim().replace(/[.!,]+$/g, '').trim();
const normalizeDateInput = (value?: string) => (value && value.trim() ? value : undefined);
const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const compactText = (value: string) => normalizeText(value).replace(/\s+/g, '');

const uniqueStrings = (values: string[]) => {
    const set = new Set<string>();
    values.forEach(value => {
        if (value) set.add(value);
    });
    return Array.from(set);
};

const extractMentionTokens = (text: string) => Array.from(text.matchAll(/@([A-Za-z0-9-_]+)/g)).map(m => m[1]);

const arraysEqual = (a?: string[], b?: string[]) => {
    const left = a || [];
    const right = b || [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return false;
    }
    return true;
};

const parsePriorityValue = (value: string): Priority | null => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'urgent') return 'Urgent';
    if (normalized === 'high') return 'High';
    if (normalized === 'medium') return 'Medium';
    if (normalized === 'low') return 'Low';
    if (normalized === 'none') return 'None';
    return null;
};

const parseStatusValue = (value: string): TicketStatus | null => {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes('in progress') || normalized.includes('in-progress')) return TicketStatus.InProgress;
    if (normalized.includes('todo')) return TicketStatus.Todo;
    if (normalized.includes('backlog')) return TicketStatus.Backlog;
    if (normalized.includes('blocked')) return TicketStatus.Backlog;
    if (normalized.includes('done')) return TicketStatus.Done;
    if (normalized.includes('canceled') || normalized.includes('cancelled') || normalized.includes('killed')) return TicketStatus.Canceled;
    return null;
};

const isTranscriptLike = (text: string) => {
    if (text.length <= 300) return false;
    const hasBullets = /\n\s*[-*]\s+/.test(text);
    const hasTimestamps = /\b\d{1,2}:\d{2}\b/.test(text);
    return hasBullets || hasTimestamps;
};

const isSemanticMatch = (labelNormalized: string, textNormalized: string) => {
    if (!labelNormalized || labelNormalized.length < 3) return false;
    if (textNormalized.includes(labelNormalized)) return true;
    const words = labelNormalized.split(' ').filter(word => word.length > 3);
    if (words.length >= 2 && words.every(word => textNormalized.includes(word))) return true;
    return false;
};


interface ReviewModeProps {
    initialMode?: 'DAILY' | 'WEEKLY';
}

export const ReviewMode: React.FC<ReviewModeProps> = ({ initialMode = 'DAILY' }) => {
    const { 
        campaign, currentUser, setCampaign,
        updateTicket, updateProjectTicket, deleteTicket, deleteProjectTicket, addTicket, addProjectTicket,
        updateChatHistory, completeReviewSession, users
    } = useStore();

    const [mode, setMode] = useState<'DAILY' | 'WEEKLY'>(initialMode);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [clientError, setClientError] = useState<string | null>(null);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [inlineEditDraft, setInlineEditDraft] = useState<InlineEditDraft | null>(null);
    const [bulkDraft, setBulkDraft] = useState<BulkDraft | null>(null);
    const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    
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
    const chatRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDev = import.meta.env.DEV;

    const appendTextMessage = (role: 'user' | 'model', text: string) => {
        const message: ChatMessage = {
            id: generateId(),
            role,
            parts: [{ text }],
            timestamp: Date.now()
        };
        setMessages(prev => {
            const next = [...prev, message];
            updateChatHistory(mode, next);
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

    const ticketIndex = useMemo(() => {
        const map = new Map<string, TicketTarget>();
        (campaign?.channels || []).forEach(c => {
            c.tickets.forEach(t => map.set(t.id, { ticket: t, parentId: c.id, type: 'CHANNEL' }));
        });
        (campaign?.projects || []).forEach(p => {
            p.tickets.forEach(t => map.set(t.id, { ticket: t, parentId: p.id, type: 'PROJECT' }));
        });
        return map;
    }, [campaign]);

    const allTicketTargets = useMemo(() => {
        const targets: TicketTarget[] = [];
        (campaign?.channels || []).forEach(c => {
            c.tickets.forEach(t => targets.push({ ticket: t, parentId: c.id, type: 'CHANNEL' }));
        });
        (campaign?.projects || []).forEach(p => {
            p.tickets.forEach(t => targets.push({ ticket: t, parentId: p.id, type: 'PROJECT' }));
        });
        return targets;
    }, [campaign]);

    const allTickets = useMemo(() => allTicketTargets.map(t => t.ticket), [allTicketTargets]);

    const activeDocs = useMemo(() => (campaign?.docs || []).filter(d => !d.isArchived), [campaign]);

    const docById = useMemo(() => {
        return new Map(activeDocs.map(d => [d.id, d]));
    }, [activeDocs]);

    const recentDocsForMention = useMemo(() => {
        const recentIds = campaign?.recentDocIds || [];
        const recent = recentIds
            .map(id => docById.get(id))
            .filter((d): d is ContextDoc => !!d);

        const favorites = activeDocs
            .filter(d => d.isFavorite && !recentIds.includes(d.id))
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

        const remaining = activeDocs
            .filter(d => !recentIds.includes(d.id) && !d.isFavorite)
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

        return [...recent, ...favorites, ...remaining].slice(0, 20);
    }, [campaign?.recentDocIds, activeDocs, docById]);

    const docLookup = useMemo(() => {
        const byIdLower = new Map<string, ContextDoc>();
        const byShortIdLower = new Map<string, ContextDoc>();
        activeDocs.forEach(doc => {
            byIdLower.set(doc.id.toLowerCase(), doc);
            if (doc.shortId) {
                byShortIdLower.set(doc.shortId.toLowerCase(), doc);
            }
        });
        return { byIdLower, byShortIdLower };
    }, [activeDocs]);

    const ticketLookup = useMemo(() => {
        const byId = new Map<string, TicketTarget>();
        const byIdLower = new Map<string, TicketTarget>();
        const byShortIdLower = new Map<string, TicketTarget>();
        allTicketTargets.forEach(target => {
            byId.set(target.ticket.id, target);
            byIdLower.set(target.ticket.id.toLowerCase(), target);
            const shortId = target.ticket.shortId || target.ticket.id;
            byShortIdLower.set(shortId.toLowerCase(), target);
        });
        return { byId, byIdLower, byShortIdLower };
    }, [allTicketTargets]);

    const userNameById = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach(u => map.set(u.id, u.name));
        return map;
    }, [users]);

    const userById = useMemo(() => {
        return new Map(users.map(u => [u.id, u]));
    }, [users]);

    const channelById = useMemo(() => {
        return new Map((campaign?.channels || []).map(channel => [channel.id, channel]));
    }, [campaign?.channels]);

    const projectById = useMemo(() => {
        return new Map((campaign?.projects || []).map(project => [project.id, project]));
    }, [campaign?.projects]);

    const defaultBulkContext = useMemo<{ channelId?: string; projectId?: string }>(() => {
        const channels = campaign?.channels || [];
        const projects = campaign?.projects || [];
        if (channels.length === 1) return { channelId: channels[0].id };
        if (channels.length === 0 && projects.length === 1) return { projectId: projects[0].id };
        return {};
    }, [campaign?.channels, campaign?.projects]);

    const referenceIndex = useMemo(() => {
        const ticketRefs: ReferenceEntity[] = allTickets.map(ticket => {
            const token = ticket.shortId || ticket.id;
            const aliasTokens = uniqueStrings([ticket.id, ticket.shortId || '', token]);
            return {
                type: 'ticket',
                id: ticket.id,
                label: ticket.title,
                shortId: ticket.shortId,
                token,
                aliasTokens,
                labelNormalized: normalizeText(ticket.title || '')
            };
        });

        const docRefs: ReferenceEntity[] = activeDocs.map(doc => {
            const token = doc.shortId || slugify(doc.title) || doc.id;
            const aliasTokens = uniqueStrings([doc.id, doc.shortId || '', token, compactText(doc.title)]);
            return {
                type: 'doc',
                id: doc.id,
                label: doc.title,
                shortId: doc.shortId,
                token,
                aliasTokens,
                labelNormalized: normalizeText(doc.title || '')
            };
        });

        const channelRefs: ReferenceEntity[] = (campaign?.channels || []).map(channel => {
            const token = slugify(channel.name) || channel.id;
            const aliasTokens = uniqueStrings([channel.id, token, compactText(channel.name)]);
            return {
                type: 'channel',
                id: channel.id,
                label: channel.name,
                token,
                aliasTokens,
                labelNormalized: normalizeText(channel.name || '')
            };
        });

        const projectRefs: ReferenceEntity[] = (campaign?.projects || []).map(project => {
            const token = slugify(project.name) || project.id;
            const aliasTokens = uniqueStrings([project.id, token, compactText(project.name)]);
            return {
                type: 'project',
                id: project.id,
                label: project.name,
                token,
                aliasTokens,
                labelNormalized: normalizeText(project.name || '')
            };
        });

        const userRefs: ReferenceEntity[] = users.map(user => {
            const token = slugify(user.name) || user.id;
            const aliasTokens = uniqueStrings([user.id, token, user.initials || '', compactText(user.name)]);
            return {
                type: 'user',
                id: user.id,
                label: user.name,
                token,
                aliasTokens,
                labelNormalized: normalizeText(user.name || '')
            };
        });

        return {
            tickets: ticketRefs,
            docs: docRefs,
            channels: channelRefs,
            projects: projectRefs,
            users: userRefs
        };
    }, [allTickets, activeDocs, campaign?.channels, campaign?.projects, users]);

    const referenceAliasMap = useMemo(() => {
        const map = new Map<string, ReferenceEntity[]>();
        const addAliases = (entity: ReferenceEntity) => {
            entity.aliasTokens.forEach(alias => {
                const key = alias.toLowerCase();
                if (!map.has(key)) map.set(key, []);
                map.get(key)?.push(entity);
            });
        };
        [
            ...referenceIndex.tickets,
            ...referenceIndex.docs,
            ...referenceIndex.channels,
            ...referenceIndex.projects,
            ...referenceIndex.users
        ].forEach(addAliases);
        return map;
    }, [referenceIndex]);

    const mentionTokenIndex = useMemo(() => {
        const map = new Map<string, ReferenceEntity>();
        const addToken = (entity: ReferenceEntity) => {
            const key = entity.token.toLowerCase();
            if (!key || map.has(key)) return;
            map.set(key, entity);
        };
        [
            ...referenceIndex.tickets,
            ...referenceIndex.docs,
            ...referenceIndex.channels,
            ...referenceIndex.projects,
            ...referenceIndex.users
        ].forEach(addToken);
        return map;
    }, [referenceIndex]);

    const resolveReferenceEntity = (token: string) => {
        const key = normalizeMentionToken(token);
        const direct = mentionTokenIndex.get(key);
        if (direct) return direct;
        const aliasMatches = referenceAliasMap.get(key) || [];
        if (aliasMatches.length === 1) return aliasMatches[0];
        return null;
    };

    const findTicketTargetById = (ticketId: string) => {
        const key = ticketId.toLowerCase();
        return ticketLookup.byId.get(ticketId)
            || ticketLookup.byIdLower.get(key)
            || ticketLookup.byShortIdLower.get(key)
            || null;
    };

    const calloutTickets = useMemo(() => {
        const ids = new Set<string>();
        messages.forEach(msg => {
            msg.parts.forEach(part => {
                const call = part.functionCall;
                if (call?.name === 'show_tasks') {
                    const ticketIds = Array.isArray(call.args?.ticketIds) ? call.args.ticketIds : [];
                    ticketIds.forEach((id: string) => ids.add(id));
                }
            });
        });
        return Array.from(ids).map(id => ticketIndex.get(id)?.ticket).filter(Boolean) as Ticket[];
    }, [messages, ticketIndex]);

    const mentionCandidates = useMemo<MentionCandidate[]>(() => {
        if (!mentionOpen) return [];
        const query = mentionQuery.trim().toLowerCase();

        const ticketSource = !query ? calloutTickets : allTickets.filter(t => {
            const title = t.title?.toLowerCase() || '';
            const shortId = t.shortId?.toLowerCase() || '';
            const id = t.id?.toLowerCase() || '';
            return title.includes(query) || shortId.includes(query) || id.includes(query);
        });

        const ticketCandidates: MentionCandidate[] = ticketSource.map(t => ({
            kind: 'ticket',
            id: t.id,
            token: t.shortId || t.id,
            label: t.title
        }));

        const recentIds = campaign?.recentDocIds || [];
        const recentRank = new Map<string, number>(recentIds.map((id, idx) => [id, idx] as const));

        const docSource = !query ? recentDocsForMention : activeDocs
            .filter(d => {
                const title = d.title?.toLowerCase() || '';
                const shortId = d.shortId?.toLowerCase() || '';
                const id = d.id?.toLowerCase() || '';
                return title.includes(query) || shortId.includes(query) || id.includes(query);
            })
            .sort((a, b) => {
                const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
                if (favDiff !== 0) return favDiff;
                const aRank = recentRank.get(a.id) ?? Number.POSITIVE_INFINITY;
                const bRank = recentRank.get(b.id) ?? Number.POSITIVE_INFINITY;
                if (aRank !== bRank) return aRank - bRank;
                return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
            });

        const docCandidates: MentionCandidate[] = docSource.map(d => ({
            kind: 'doc',
            id: d.id,
            token: d.shortId || slugify(d.title) || d.id,
            label: d.title
        }));

        const userSource = !query ? users : users.filter(u => {
            const name = u.name?.toLowerCase() || '';
            const id = u.id?.toLowerCase() || '';
            return name.includes(query) || id.includes(query);
        });

        const userCandidates: MentionCandidate[] = userSource.map(u => ({
            kind: 'user',
            id: u.id,
            token: slugify(u.name) || u.id,
            label: u.name
        }));

        const channelSource = !query ? (campaign?.channels || []) : (campaign?.channels || []).filter(c => {
            const name = c.name?.toLowerCase() || '';
            const id = c.id?.toLowerCase() || '';
            return name.includes(query) || id.includes(query);
        });

        const channelCandidates: MentionCandidate[] = channelSource.map(c => ({
            kind: 'channel',
            id: c.id,
            token: slugify(c.name) || c.id,
            label: c.name
        }));

        const projectSource = !query ? (campaign?.projects || []) : (campaign?.projects || []).filter(p => {
            const name = p.name?.toLowerCase() || '';
            const id = p.id?.toLowerCase() || '';
            return name.includes(query) || id.includes(query);
        });

        const projectCandidates: MentionCandidate[] = projectSource.map(p => ({
            kind: 'project',
            id: p.id,
            token: slugify(p.name) || p.id,
            label: p.name
        }));

        return [
            ...ticketCandidates,
            ...docCandidates,
            ...userCandidates,
            ...channelCandidates,
            ...projectCandidates
        ].slice(0, 30);
    }, [
        mentionOpen,
        mentionQuery,
        calloutTickets,
        allTickets,
        campaign?.recentDocIds,
        recentDocsForMention,
        activeDocs,
        campaign?.channels,
        campaign?.projects,
        users
    ]);

    useEffect(() => {
        if (mentionIndex >= mentionCandidates.length) {
            setMentionIndex(0);
        }
    }, [mentionCandidates, mentionIndex]);

    useEffect(() => {
        if (!apiKey) {
            setClientError(null);
            return;
        }
        setClientError(client ? null : "Failed to initialize AI client. Check your API key.");
    }, [apiKey, client]);

    const clearChatState = () => {
        setMessages([]);
        setPendingActions([]);
        setInlineEditDraft(null);
        setShowTicketModal(false);
        setEditingTicket(null);
        setBulkDraft(null);
        setIsProcessingTranscript(false);
    };

    const closeTicketModal = () => {
        setShowTicketModal(false);
        setEditingTicket(null);
    };

    const getMentionContext = (value: string, cursor: number) => {
        const text = value.slice(0, cursor);
        const match = text.match(/(^|\s)@([A-Za-z0-9-_]*)$/);
        if (!match) return null;
        const query = match[2] || '';
        const start = cursor - query.length - 1;
        return { start, query };
    };

    const updateMentionState = (value: string, cursor: number) => {
        const ctx = getMentionContext(value, cursor);
        if (!ctx) {
            setMentionOpen(false);
            setMentionQuery('');
            setMentionStart(null);
            return;
        }
        setMentionOpen(true);
        setMentionQuery(ctx.query);
        setMentionStart(ctx.start);
        setMentionIndex(0);
    };

    const insertMention = (candidate: MentionCandidate) => {
        if (mentionStart === null) return;
        const cursor = inputRef.current?.selectionStart ?? input.length;
        const before = input.slice(0, mentionStart);
        const after = input.slice(cursor);
        const mentionText = `@${candidate.token}`;
        const spacer = after.startsWith(' ') || after.length === 0 ? '' : ' ';
        const nextValue = `${before}${mentionText}${spacer}${after}`;
        setInput(nextValue);
        setMentionOpen(false);
        setMentionQuery('');
        setMentionStart(null);
        requestAnimationFrame(() => {
            const pos = (before + mentionText + spacer).length;
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(pos, pos);
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        setInput(nextValue);
        const cursor = e.target.selectionStart ?? nextValue.length;
        updateMentionState(nextValue, cursor);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mentionOpen && mentionCandidates.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => Math.min(prev + 1, mentionCandidates.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const selected = mentionCandidates[mentionIndex];
                if (selected) insertMention(selected);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMentionOpen(false);
                return;
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    const resolveMentionToTarget = (token: string) => {
        const key = normalizeMentionToken(token);
        return ticketLookup.byShortIdLower.get(key) || ticketLookup.byIdLower.get(key) || null;
    };

    const resolveDocMention = (token: string) => {
        const key = normalizeMentionToken(token);
        return docLookup.byShortIdLower.get(key) || docLookup.byIdLower.get(key) || null;
    };

    const resolveMentionsForAI = (text: string) => {
        return text.replace(/@([A-Za-z0-9-_]+)/g, (match, token) => {
            const key = normalizeMentionToken(token);
            const aliasMatches = referenceAliasMap.get(key) || [];
            const entity = mentionTokenIndex.get(key) || (aliasMatches.length === 1 ? aliasMatches[0] : null);
            if (!entity) return match;
            const typeLabel = entity.type === 'ticket'
                ? 'Ticket'
                : entity.type === 'doc'
                    ? 'Doc'
                    : entity.type === 'user'
                        ? 'User'
                        : entity.type === 'channel'
                            ? 'Channel'
                            : 'Project';
            const stableToken = entity.shortId || entity.token || token;
            return `@${stableToken} (${typeLabel}: ${entity.label})`;
        });
    };

    const buildReferenceResolution = (text: string, mentionTokens: string[]) => {
        const resolved = {
            tickets: [] as string[],
            docs: [] as string[],
            channels: [] as string[],
            projects: [] as string[],
            users: [] as string[],
            ambiguous: [] as Array<{ token: string; candidates: Array<{ type: ReferenceType; id: string; label: string }> }>,
            unresolved: [] as string[]
        };

        const seen = new Set<string>();
        const addResolved = (entity: ReferenceEntity) => {
            const key = `${entity.type}:${entity.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (entity.type === 'ticket') resolved.tickets.push(entity.id);
            else if (entity.type === 'doc') resolved.docs.push(entity.id);
            else if (entity.type === 'channel') resolved.channels.push(entity.id);
            else if (entity.type === 'project') resolved.projects.push(entity.id);
            else if (entity.type === 'user') resolved.users.push(entity.id);
        };

        const tokens = uniqueStrings([...mentionTokens, ...extractMentionTokens(text)].map(token => token.trim()));
        tokens.forEach(token => {
            const key = normalizeMentionToken(token);
            const matches = referenceAliasMap.get(key) || [];
            if (matches.length === 1) {
                addResolved(matches[0]);
                return;
            }
            if (matches.length > 1) {
                resolved.ambiguous.push({
                    token,
                    candidates: matches.map(match => ({ type: match.type, id: match.id, label: match.label }))
                });
                return;
            }
            if (token) resolved.unresolved.push(token);
        });

        const normalizedText = normalizeText(text || '');
        if (normalizedText) {
            const allEntities = [
                ...referenceIndex.tickets,
                ...referenceIndex.docs,
                ...referenceIndex.channels,
                ...referenceIndex.projects,
                ...referenceIndex.users
            ];
            allEntities.forEach(entity => {
                if (isSemanticMatch(entity.labelNormalized, normalizedText)) {
                    addResolved(entity);
                }
            });
        }

        return resolved;
    };

    const buildDocExcerpt = (doc: ContextDoc) => {
        if (!doc) return '';
        if (doc.format === 'CANVAS') return 'Canvas document';
        const content = typeof doc.content === 'string' ? doc.content : '';
        const stripped = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped.slice(0, 280);
    };

    const buildBulkDraftTasks = (rawTasks: any[]) => {
        if (!Array.isArray(rawTasks)) return [];
        return rawTasks.map((task) => {
            const title = typeof task?.title === 'string' ? task.title.trim() : '';
            if (!title) return null;

            const description = typeof task?.description === 'string' ? task.description.trim() : '';
            const priorityRaw = typeof task?.priority === 'string' ? task.priority : '';
            const priority = priorityRaw ? parsePriorityValue(priorityRaw) : null;
            const assigneeRaw = typeof task?.assigneeId === 'string' ? task.assigneeId : '';
            const assigneeId = assigneeRaw && userById.has(assigneeRaw) ? assigneeRaw : undefined;
            const channelId = typeof task?.channelId === 'string' ? task.channelId : undefined;
            const projectId = typeof task?.projectId === 'string' ? task.projectId : undefined;

            const base: BulkDraftTask = {
                id: generateId(),
                title,
                description: description || undefined,
                assigneeId,
                priority: priority || 'Medium'
            };

            if (channelId) return { ...base, channelId };
            if (projectId) return { ...base, projectId };
            if (defaultBulkContext.channelId) return { ...base, channelId: defaultBulkContext.channelId };
            if (defaultBulkContext.projectId) return { ...base, projectId: defaultBulkContext.projectId };
            return base;
        }).filter(Boolean) as BulkDraftTask[];
    };

    const parseInlineUpdates = (text: string) => {
        const updates: Partial<Ticket> = {};
        const lower = text.toLowerCase();

        const titleMatch = text.match(/(?:change|update)\s+(?:the\s+)?(?:name|title)\s+to\s+["“']?([^"”'\n]+)["”']?/i)
            || text.match(/rename\s+(?:it\s+)?to\s+["“']?([^"”'\n]+)["”']?/i);
        if (titleMatch) {
            const extracted = cleanExtract(titleMatch[titleMatch.length - 1].split(/\s+and\s+/i)[0]);
            if (extracted) updates.title = extracted;
        }

        const descriptionMatch = text.match(/(?:change|update|set)\s+(?:the\s+)?description\s+to\s+["“']?([^"”']+)["”']?/i);
        if (descriptionMatch) {
            const extracted = cleanExtract(descriptionMatch[1].split(/\s+and\s+/i)[0]);
            if (extracted) updates.description = extracted;
        }

        const priorityMatch = lower.match(/priority\s+(?:to\s+)?(urgent|high|medium|low|none)/i);
        if (priorityMatch) {
            const parsed = parsePriorityValue(priorityMatch[1]);
            if (parsed) updates.priority = parsed;
        }

        return Object.keys(updates).length > 0 ? updates : null;
    };

    const parseInlineTicketEditRequest = (text: string) => {
        const mentionTokens = Array.from(text.matchAll(/@([A-Za-z0-9-_]+)/g)).map(m => m[1]);
        if (mentionTokens.length === 0) return null;

        const hasEditKeyword = /\b(change|update|edit|rename|set|please)\b/i.test(text);
        const hasEditField = /\b(name|title|description|priority)\b/i.test(text);
        const hasRenamePattern = /\brename\b/i.test(text);
        if (!hasEditKeyword) return null;
        if (!hasEditField && !hasRenamePattern) return null;

        const updates = parseInlineUpdates(text);
        if (!updates) return null;

        for (const token of mentionTokens) {
            const target = resolveMentionToTarget(token);
            if (target) {
                return { target, updates };
            }
        }

        return null;
    };

    const buildTicketModalInitialData = (ticket: Ticket, overrides?: Partial<Ticket>): TicketModalInitialData => ({
        id: ticket.id,
        title: overrides?.title ?? ticket.title,
        description: overrides?.description ?? ticket.description,
        priority: overrides?.priority ?? ticket.priority,
        assigneeId: overrides?.assigneeId ?? ticket.assigneeId,
        channelId: ticket.channelId,
        projectId: ticket.projectId,
        linkedDocIds: overrides?.linkedDocIds ?? ticket.linkedDocIds,
        startDate: overrides?.startDate ?? ticket.startDate,
        endDate: overrides?.dueDate ?? ticket.dueDate
    });

    const buildUpdatesFromModalData = (ticket: Ticket, data: any) => {
        const updates: Partial<Ticket> = {};
        const nextStartDate = normalizeDateInput(data.startDate);
        const nextDueDate = normalizeDateInput(data.endDate);

        if (data.title !== ticket.title) updates.title = data.title;
        if ((data.description ?? '') !== (ticket.description ?? '')) updates.description = data.description;
        if (data.priority !== ticket.priority) updates.priority = data.priority;
        if ((data.assigneeId ?? '') !== (ticket.assigneeId ?? '')) updates.assigneeId = data.assigneeId;
        if (!arraysEqual(data.linkedDocIds, ticket.linkedDocIds)) updates.linkedDocIds = data.linkedDocIds;
        if ((nextStartDate ?? '') !== (ticket.startDate ?? '')) updates.startDate = nextStartDate;
        if ((nextDueDate ?? '') !== (ticket.dueDate ?? '')) updates.dueDate = nextDueDate;

        return updates;
    };

    const summarizeTicketUpdates = (ticket: Ticket, updates: Partial<Ticket>) => {
        const lines: string[] = [];
        if (updates.title && updates.title !== ticket.title) {
            lines.push(`Title -> ${updates.title}`);
        }
        if (typeof updates.description === 'string' && updates.description !== (ticket.description || '')) {
            lines.push('Description updated');
        }
        if (updates.priority && updates.priority !== ticket.priority) {
            lines.push(`Priority -> ${updates.priority}`);
        }
        if (typeof updates.assigneeId !== 'undefined' && updates.assigneeId !== ticket.assigneeId) {
            const label = updates.assigneeId ? (userNameById.get(updates.assigneeId) || updates.assigneeId) : 'Unassigned';
            lines.push(`Assignee -> ${label}`);
        }
        if (typeof updates.startDate !== 'undefined' && updates.startDate !== ticket.startDate) {
            lines.push(`Start Date -> ${updates.startDate || 'None'}`);
        }
        if (typeof updates.dueDate !== 'undefined' && updates.dueDate !== ticket.dueDate) {
            lines.push(`Due Date -> ${updates.dueDate || 'None'}`);
        }
        if (typeof updates.linkedDocIds !== 'undefined' && !arraysEqual(updates.linkedDocIds, ticket.linkedDocIds)) {
            lines.push('Linked documents updated');
        }
        return lines.length > 0 ? lines : ['Changes captured'];
    };

    const formatSummaryBlock = (lines: string[]) => lines.map(line => `- ${line}`).join('\n');

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

    const handleSaveEditedTicket = (data: any) => {
        if (!editingTicket) return;
        const target = findTicketTargetById(editingTicket.id);
        if (!target) return;
        const updates = buildUpdatesFromModalData(editingTicket, data);
        const hasUpdates = Object.keys(updates).length > 0;

        closeTicketModal();

        if (!hasUpdates) return;

        if (target.type === 'CHANNEL') {
            updateTicket(target.parentId, editingTicket.id, updates);
        } else {
            updateProjectTicket(target.parentId, editingTicket.id, updates);
        }
    };

    const handleDeleteEditedTicket = (ticketId: string) => {
        const target = findTicketTargetById(ticketId);
        if (!target) return;
        if (target.type === 'CHANNEL') {
            deleteTicket(target.parentId, ticketId);
        } else {
            deleteProjectTicket(target.parentId, ticketId);
        }
        closeTicketModal();
    };

    const handleInlineDraftChange = (updates: Partial<TicketModalInitialData>) => {
        setInlineEditDraft(prev => {
            if (!prev) return prev;
            return { ...prev, form: { ...prev.form, ...updates } };
        });
    };

    const handleInlineDraftCancel = () => {
        if (!inlineEditDraft) return;
        appendModelMessage(`Canceled inline edit for @${inlineEditDraft.target.ticket.shortId}.`);
        setInlineEditDraft(null);
    };

    const handleInlineDraftApprove = () => {
        if (!inlineEditDraft) return;
        const { target, form } = inlineEditDraft;
        const updates = buildUpdatesFromModalData(target.ticket, form);
        const hasUpdates = Object.keys(updates).length > 0;

        if (!hasUpdates) {
            appendModelMessage(`No changes detected for @${target.ticket.shortId}.`);
            setInlineEditDraft(null);
            return;
        }

        if (target.type === 'CHANNEL') {
            updateTicket(target.parentId, target.ticket.id, updates);
        } else {
            updateProjectTicket(target.parentId, target.ticket.id, updates);
        }

        const summaryLines = summarizeTicketUpdates(target.ticket, updates);
        appendModelMessage(
            `Approved changes for @${target.ticket.shortId}.\n${formatSummaryBlock(summaryLines)}`
        );
        setInlineEditDraft(null);
    };

    const buildQueryTitle = (entity: ReferenceEntity | null, status: TicketStatus | null) => {
        const parts: string[] = [];
        if (entity) parts.push(entity.label);
        if (status) parts.push(status);
        return parts.length > 0 ? parts.join(' - ') : 'Filtered Tasks';
    };

    const handleQueryCommand = (args: string) => {
        const tokens = extractMentionTokens(args);
        const entity = tokens.length > 0 ? resolveReferenceEntity(tokens[0]) : null;
        const status = parseStatusValue(args);

        if (entity?.type === 'doc') {
            appendModelMessage('Query by doc is not supported yet.');
            return;
        }

        let filtered = allTicketTargets;
        if (entity) {
            if (entity.type === 'ticket') {
                filtered = filtered.filter(t => t.ticket.id === entity.id);
            } else if (entity.type === 'user') {
                filtered = filtered.filter(t => t.ticket.assigneeId === entity.id);
            } else if (entity.type === 'channel') {
                filtered = filtered.filter(t => t.ticket.channelId === entity.id);
            } else if (entity.type === 'project') {
                filtered = filtered.filter(t => t.ticket.projectId === entity.id);
            }
        }
        if (status) {
            filtered = filtered.filter(t => t.ticket.status === status);
        }

        const ticketIds = filtered.map(t => t.ticket.id);
        if (ticketIds.length === 0) {
            appendModelMessage('No matching tasks found for that query.');
            return;
        }

        const title = buildQueryTitle(entity, status);
        const message: ChatMessage = {
            id: generateId(),
            role: 'model',
            parts: [{
                functionCall: {
                    name: 'show_tasks',
                    args: { title, ticketIds }
                }
            }],
            timestamp: Date.now()
        };

        setMessages(prev => {
            const next = [...prev, message];
            updateChatHistory(mode, next);
            return next;
        });
    };

    const handleTranscriptSynthesis = async (notes: string) => {
        if (!notes.trim()) {
            appendModelMessage('Paste your notes after /plan to extract tasks.');
            return;
        }
        if (!campaign) return;
        setBulkDraft(null);
        setIsProcessingTranscript(true);

        if (!chatRef.current) {
            await ensureChat();
        }
        if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') {
            setClientError("Chat is not ready. Please try again.");
            setIsProcessingTranscript(false);
            return;
        }

        setIsTyping(true);
        try {
            const resolvedNotes = resolveMentionsForAI(notes);
            const synthesisPrompt = [
                "SYNTHESIS MODE: Extract actionable tasks from the notes below.",
                "Return ONLY a propose_bulk_tasks tool call with 5-20 tasks.",
                "Each task should include a short title, optional description, assigneeId if clear, and a priority.",
                "Notes:",
                resolvedNotes
            ].join("\n");
            const response = await chatRef.current.sendMessage({ message: synthesisPrompt });
            processResponse(response);
        } catch (e) {
            console.error("Transcript synthesis error:", e);
            setClientError("Transcript synthesis failed. Check console for details.");
            setIsProcessingTranscript(false);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSlashCommand = async (rawText: string) => {
        const trimmed = rawText.trim();
        const match = trimmed.match(/^\/([a-zA-Z]+)\b([\s\S]*)$/);
        if (!match) return false;
        const command = match[1].toLowerCase();
        const args = match[2]?.trim() || '';

        appendUserMessage(rawText);

        if (command === 'help') {
            appendModelMessage([
                "## Command Cheat Sheet",
                "- /task <title> [priority]",
                "- /query [@mention] [status]",
                "- /edit @T-123",
                "- /plan <paste notes>",
                "- /help"
            ].join('\n'));
            return true;
        }

        if (command === 'task') {
            if (!args) {
                appendModelMessage('Usage: /task <title> [priority]');
                return true;
            }
            const parts = args.split(/\s+/).filter(Boolean);
            let priority: Priority | null = null;
            if (parts.length > 1) {
                const maybePriority = parsePriorityValue(parts[parts.length - 1]);
                if (maybePriority) {
                    priority = maybePriority;
                    parts.pop();
                }
            }
            const title = parts.join(' ').trim();
            if (!title) {
                appendModelMessage('Usage: /task <title> [priority]');
                return true;
            }
            const mockCallId = generateId();
            setPendingActions(prev => [...prev, {
                id: generateId(),
                callId: mockCallId,
                name: 'propose_ticket',
                args: { title, priority: priority || 'Medium' },
                status: 'PENDING'
            }]);
            appendModelMessage('Draft ticket created. Fill in details and approve.');
            return true;
        }

        if (command === 'query') {
            handleQueryCommand(args);
            return true;
        }

        if (command === 'edit') {
            const tokens = extractMentionTokens(args);
            if (tokens.length === 0) {
                appendModelMessage('Usage: /edit @T-123');
                return true;
            }
            const target = resolveMentionToTarget(tokens[0]);
            if (!target) {
                appendModelMessage('No ticket found for that reference.');
                return true;
            }
            setInlineEditDraft({
                target,
                form: buildTicketModalInitialData(target.ticket)
            });
            appendModelMessage(`Review edits for @${target.ticket.shortId} below, then approve.`);
            return true;
        }

        if (command === 'plan') {
            const notes = rawText.replace(/^\/plan\s*/i, '').trim();
            await handleTranscriptSynthesis(notes);
            return true;
        }

        appendModelMessage(`Unknown command: /${command}. Try /help for options.`);
        return true;
    };

    const handleBulkApprove = async (tasks: BulkDraftTask[]) => {
        if (!campaign) return;
        const fallbackChannelId = campaign.channels[0]?.id;
        const fallbackProjectId = campaign.projects[0]?.id;
        const createdAt = new Date().toISOString();

        let createdCount = 0;
        let skippedCount = 0;

        tasks.forEach(task => {
            const title = task.title?.trim();
            if (!title) {
                skippedCount += 1;
                return;
            }

            const assigneeId = task.assigneeId && userById.has(task.assigneeId) ? task.assigneeId : undefined;
            const baseTicket = {
                id: generateId(),
                shortId: `T-${Math.floor(Math.random() * 1000)}`,
                title,
                description: task.description || '',
                priority: task.priority || 'Medium',
                status: TicketStatus.Todo,
                assigneeId,
                createdAt
            };

            const channelId = task.channelId || defaultBulkContext.channelId || fallbackChannelId;
            const projectId = !channelId ? (task.projectId || defaultBulkContext.projectId || fallbackProjectId) : undefined;

            if (channelId) {
                addTicket(channelId, { ...baseTicket, channelId });
                createdCount += 1;
            } else if (projectId) {
                addProjectTicket(projectId, { ...baseTicket, projectId });
                createdCount += 1;
            } else {
                skippedCount += 1;
            }
        });

        const callId = bulkDraft?.callId;
        setBulkDraft(null);
        setIsProcessingTranscript(false);

        if (!chatRef.current || !callId) {
            appendModelMessage(`Created ${createdCount} tasks. ${skippedCount ? `Skipped ${skippedCount} missing context.` : ''}`.trim());
            return;
        }

        setIsTyping(true);
        try {
            const toolResponse = {
                functionResponse: {
                    name: 'propose_bulk_tasks',
                    id: callId,
                    response: {
                        result: 'Approved',
                        createdCount,
                        skippedCount
                    }
                }
            };
            const response = await chatRef.current.sendMessage({ message: [toolResponse] });
            processResponse(response);
        } catch (e) {
            console.error("Bulk approve tool error:", e);
        } finally {
            setIsTyping(false);
        }
    };

    const handleBulkDiscard = async () => {
        const callId = bulkDraft?.callId;
        setBulkDraft(null);
        setIsProcessingTranscript(false);

        if (!chatRef.current || !callId) {
            appendModelMessage('Bulk draft discarded.');
            return;
        }

        setIsTyping(true);
        try {
            const toolResponse = {
                functionResponse: {
                    name: 'propose_bulk_tasks',
                    id: callId,
                    response: { result: 'User discarded draft.' }
                }
            };
            const response = await chatRef.current.sendMessage({ message: [toolResponse] });
            processResponse(response);
        } catch (e) {
            console.error("Bulk discard tool error:", e);
        } finally {
            setIsTyping(false);
        }
    };

    // --- Load History / Init Session ---
    useEffect(() => {
        if (!campaign || !client) return;
        
        // Load existing history or start fresh
        const history = mode === 'DAILY' ? campaign.dailyChatHistory : campaign.weeklyChatHistory;
        
        if (history && history.length > 0) {
            setMessages(history);
            // Re-initialize the chat session with this history
            initChat(history);
        } else {
            setMessages([]);
            initChat([]); 
        }
    }, [mode, campaign?.id, client]); // Re-run when mode changes or client becomes ready

    const initChat = async (existingMessages: ChatMessage[], suppressAutoStart: boolean = false) => {
        if (!campaign || !client) return;
        try {
            const systemInstruction = mode === 'DAILY' ? DAILY_SYSTEM_INSTRUCTION : WEEKLY_SYSTEM_INSTRUCTION;
            const tools = mode === 'DAILY' ? DAILY_TOOLS : WEEKLY_TOOLS;
            const context = mode === 'DAILY' ? buildDailyContext(campaign, currentUser) : buildWeeklyContext(campaign);

            // Convert stored ChatMessage to SDK Content
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
                    systemInstruction, 
                    tools,
                    temperature: 0.7 
                },
                history: historyContent
            });
            chatRef.current = chat;
            if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') {
                setClientError("Chat client failed to initialize. Check the model name and API key.");
                return;
            }

            // No auto-start; user initiates the conversation.
        } catch (e) {
            console.error("Chat Init Error:", e);
            setClientError("Chat failed to initialize. Check console for details.");
            setIsTyping(false);
        }
    };

    const ensureChat = async () => {
        if (chatRef.current || !client || !campaign) return;
        await initChat(messages, true);
    };

    const handleResetChat = () => {
        clearChatState();
        updateChatHistory(mode, []);
        if (campaign && client) {
            initChat([]);
        }
    };

    const handleLoadTestData = () => {
        const testCampaign = buildReviewAgentTestCampaign();
        setCampaign(testCampaign);
        clearChatState();
    };

    const handleShowTasksCalls = async (calls: PendingAction[]) => {
        if (!chatRef.current) return;
        setIsTyping(true);
        for (const call of calls) {
            try {
                const toolResponse = {
                    functionResponse: {
                        name: call.name,
                        id: call.callId || call.id,
                        response: { result: "Displayed tasks in chat." }
                    }
                };
                const response = await chatRef.current.sendMessage({ message: [toolResponse] });
                processResponse(response);
            } catch (e) {
                console.error("Show tasks tool error:", e);
            }
        }
        setIsTyping(false);
    };

    const handleResolveReferencesCalls = async (calls: PendingAction[]) => {
        if (!chatRef.current) return;
        setIsTyping(true);
        for (const call of calls) {
            try {
                const args = call.args || {};
                const text = typeof args.text === 'string' ? args.text : '';
                const mentionTokens = Array.isArray(args.mentionTokens)
                    ? args.mentionTokens.filter((token: unknown) => typeof token === 'string') as string[]
                    : [];
                const resolution = buildReferenceResolution(text, mentionTokens);
                const toolResponse = {
                    functionResponse: {
                        name: call.name,
                        id: call.callId || call.id,
                        response: resolution
                    }
                };
                const response = await chatRef.current.sendMessage({ message: [toolResponse] });
                processResponse(response);
            } catch (e) {
                console.error("Resolve references tool error:", e);
            }
        }
        setIsTyping(false);
    };

    const handleFetchReferenceContextCalls = async (calls: PendingAction[]) => {
        if (!chatRef.current) return;
        setIsTyping(true);
        for (const call of calls) {
            try {
                const args = call.args || {};
                const ticketIds = Array.isArray(args.tickets) ? args.tickets.filter((id: unknown) => typeof id === 'string') as string[] : [];
                const docIds = Array.isArray(args.docs) ? args.docs.filter((id: unknown) => typeof id === 'string') as string[] : [];
                const channelIds = Array.isArray(args.channels) ? args.channels.filter((id: unknown) => typeof id === 'string') as string[] : [];
                const projectIds = Array.isArray(args.projects) ? args.projects.filter((id: unknown) => typeof id === 'string') as string[] : [];
                const userIds = Array.isArray(args.users) ? args.users.filter((id: unknown) => typeof id === 'string') as string[] : [];

                const tickets = ticketIds.map(id => {
                    const target = findTicketTargetById(id);
                    const ticket = target?.ticket;
                    if (!ticket) return null;
                    const assigneeName = ticket.assigneeId ? userNameById.get(ticket.assigneeId) : undefined;
                    const channelId = target?.type === 'CHANNEL' ? target.parentId : ticket.channelId;
                    const projectId = target?.type === 'PROJECT' ? target.parentId : ticket.projectId;
                    const channelName = channelId ? channelById.get(channelId)?.name : undefined;
                    const projectName = projectId ? projectById.get(projectId)?.name : undefined;
                    return {
                        id: ticket.id,
                        shortId: ticket.shortId,
                        title: ticket.title,
                        status: ticket.status,
                        priority: ticket.priority,
                        assigneeId: ticket.assigneeId,
                        assigneeName,
                        startDate: ticket.startDate,
                        dueDate: ticket.dueDate,
                        channelId,
                        channelName,
                        projectId,
                        projectName
                    };
                }).filter(Boolean);

                const docs = docIds.map(id => {
                    const doc = docById.get(id);
                    if (!doc) return null;
                    const channelName = doc.channelId ? channelById.get(doc.channelId)?.name : undefined;
                    return {
                        id: doc.id,
                        shortId: doc.shortId,
                        title: doc.title,
                        lastUpdated: doc.lastUpdated,
                        channelId: doc.channelId,
                        channelName,
                        excerpt: buildDocExcerpt(doc)
                    };
                }).filter(Boolean);

                const channels = channelIds.map(id => {
                    const channel = channelById.get(id);
                    if (!channel) return null;
                    return {
                        id: channel.id,
                        name: channel.name,
                        ticketCount: channel.tickets?.length || 0,
                        memberCount: channel.memberIds?.length || 0,
                        tags: channel.tags
                    };
                }).filter(Boolean);

                const projects = projectIds.map(id => {
                    const project = projectById.get(id);
                    if (!project) return null;
                    const ownerName = project.ownerId ? userNameById.get(project.ownerId) : undefined;
                    return {
                        id: project.id,
                        name: project.name,
                        status: project.status,
                        description: project.description,
                        ownerId: project.ownerId,
                        ownerName,
                        ticketCount: project.tickets?.length || 0
                    };
                }).filter(Boolean);

                const resolvedUsers = userIds.map(id => {
                    const user = userById.get(id);
                    if (!user) return null;
                    return {
                        id: user.id,
                        name: user.name,
                        role: user.role
                    };
                }).filter(Boolean);

                const toolResponse = {
                    functionResponse: {
                        name: call.name,
                        id: call.callId || call.id,
                        response: {
                            tickets,
                            docs,
                            channels,
                            projects,
                            users: resolvedUsers
                        }
                    }
                };
                const response = await chatRef.current.sendMessage({ message: [toolResponse] });
                processResponse(response);
            } catch (e) {
                console.error("Fetch reference context tool error:", e);
            }
        }
        setIsTyping(false);
    };

    const handleBulkTasksCalls = (calls: PendingAction[]) => {
        if (calls.length === 0) return;
        const call = calls[calls.length - 1];
        const args = call.args || {};
        const origin = typeof args.origin === 'string' && args.origin.trim()
            ? args.origin.trim()
            : 'Transcript';
        const tasks = buildBulkDraftTasks(args.tasks);

        setIsProcessingTranscript(false);

        if (tasks.length === 0) {
            appendModelMessage('No actionable tasks were extracted from those notes.');
            return;
        }

        setBulkDraft({
            origin,
            tasks,
            callId: call.callId || call.id
        });
    };

    // --- Processing ---
    const processResponse = (response: any) => {
        if (response.candidates && response.candidates[0]) {
            const content = response.candidates[0].content;
            const parts = content.parts;
            
            const newMsg: ChatMessage = {
                id: generateId(),
                role: 'model',
                parts: parts,
                timestamp: Date.now()
            };

            setMessages(prev => {
                const next = [...prev, newMsg];
                updateChatHistory(mode, next); // Persist
                return next;
            });

            // Handle Tools
            const toolCalls = parts.filter((p: any) => p.functionCall);
            if (toolCalls.length > 0) {
                const newActions = toolCalls.map((tc: any) => ({
                    id: generateId(),
                    callId: tc.functionCall!.id,
                    name: tc.functionCall!.name,
                    args: tc.functionCall!.args,
                    status: 'PENDING' as const
                }));
                const autoHandled = new Set(['show_tasks', 'resolve_references', 'fetch_reference_context', 'propose_bulk_tasks']);
                setPendingActions(prev => [...prev, ...newActions.filter(a => !autoHandled.has(a.name))]);

                const showTaskCalls = newActions.filter(a => a.name === 'show_tasks');
                if (showTaskCalls.length > 0) {
                    void handleShowTasksCalls(showTaskCalls);
                }

                const resolveCalls = newActions.filter(a => a.name === 'resolve_references');
                if (resolveCalls.length > 0) {
                    void handleResolveReferencesCalls(resolveCalls);
                }

                const fetchCalls = newActions.filter(a => a.name === 'fetch_reference_context');
                if (fetchCalls.length > 0) {
                    void handleFetchReferenceContextCalls(fetchCalls);
                }

                const bulkCalls = newActions.filter(a => a.name === 'propose_bulk_tasks');
                if (bulkCalls.length > 0) {
                    handleBulkTasksCalls(bulkCalls);
                } else if (isProcessingTranscript) {
                    setIsProcessingTranscript(false);
                }
            } else if (isProcessingTranscript) {
                setIsProcessingTranscript(false);
            }
        }
    };

    // --- Interaction ---
    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        if (!campaign) return;

        const rawText = input;
        const trimmedText = rawText.trim();

        setInput('');
        setMentionOpen(false);
        setMentionQuery('');
        setMentionStart(null);

        const slashHandled = await handleSlashCommand(rawText);
        if (slashHandled) return;

        if (isTranscriptLike(rawText)) {
            appendUserMessage(rawText);
            await handleTranscriptSynthesis(rawText);
            return;
        }

        const inlineRequest = parseInlineTicketEditRequest(trimmedText);
        if (inlineRequest) {
            appendUserMessage(rawText);
            setInlineEditDraft({
                target: inlineRequest.target,
                form: buildTicketModalInitialData(inlineRequest.target.ticket, inlineRequest.updates)
            });
            appendModelMessage(`Review the proposed edits for @${inlineRequest.target.ticket.shortId} below, then approve.`);
            return;
        }

        if (!chatRef.current) {
            await ensureChat();
        }
        if (!chatRef.current || typeof chatRef.current.sendMessage !== 'function') {
            setClientError("Chat is not ready. Please try again.");
            return;
        }

        const userMsg: ChatMessage = { 
            id: generateId(), 
            role: 'user', 
            parts: [{ text: rawText }], 
            timestamp: Date.now() 
        };
        
        setMessages(prev => {
            const next = [...prev, userMsg];
            updateChatHistory(mode, next);
            return next;
        });

        const resolvedText = resolveMentionsForAI(rawText);

        setIsTyping(true);
        try {
            const response = await chatRef.current.sendMessage({ message: resolvedText });
            processResponse(response);
        } catch (e) {
            console.error("Chat Error:", e);
            setClientError("Chat send failed. Check console for details.");
        } finally {
            setIsTyping(false);
        }
    };

    const handleAction = async (action: PendingAction, approved: boolean) => {
        setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, status: approved ? 'APPROVED' : 'REJECTED' } : a));

        if (approved) {
            // Execute Logic
            const { name, args } = action;
            
            // --- WEEKLY ACTIONS ---
            if (name === 'propose_reschedule' || name === 'propose_status_change') {
                const { ticketId, newDate, status } = args;
                // Helper to find ticket across channels/projects
                const findTicket = (tid: string) => {
                    const cT = (campaign?.channels || []).flatMap(c => c.tickets).find(t => t.id === tid);
                    if (cT) return { ticket: cT, parentId: cT.channelId, type: 'CHANNEL' };
                    const pT = (campaign?.projects || []).flatMap(p => p.tickets).find(t => t.id === tid);
                    if (pT) return { ticket: pT, parentId: pT.projectId, type: 'PROJECT' };
                    return null;
                };

                const target = findTicket(ticketId);
                if (target) {
                    if (name === 'propose_reschedule') {
                        if (target.type === 'CHANNEL') updateTicket(target.parentId!, ticketId, { dueDate: newDate });
                        else updateProjectTicket(target.parentId!, ticketId, { dueDate: newDate });
                    } else {
                        // Status Change
                        const newStatus = status === 'Done' ? TicketStatus.Done : status === 'Canceled' ? TicketStatus.Canceled : TicketStatus.Backlog;
                        if (status === 'Canceled') {
                            if (target.type === 'CHANNEL') deleteTicket(target.parentId!, ticketId);
                            else deleteProjectTicket(target.parentId!, ticketId);
                        } else {
                            if (target.type === 'CHANNEL') updateTicket(target.parentId!, ticketId, { status: newStatus });
                            else updateProjectTicket(target.parentId!, ticketId, { status: newStatus });
                        }
                    }
                }
            } 
            else if (name === 'propose_ticket' || name === 'create_task') {
                const { title, description, channelId, projectId, priority } = args;
                const newTicket = {
                    id: generateId(),
                    shortId: `T-${Math.floor(Math.random() * 1000)}`,
                    title,
                    description: description || '',
                    priority: priority || 'Medium',
                    status: TicketStatus.Todo,
                    assigneeId: currentUser.id,
                    createdAt: new Date().toISOString()
                };

                // For 'create_task' (Daily), default to first available channel if not specified
                let targetChannel = channelId;
                if (!channelId && !projectId && campaign?.channels[0]) {
                    targetChannel = campaign.channels[0].id;
                }

                if (targetChannel) addTicket(targetChannel, { ...newTicket, channelId: targetChannel });
                else if (projectId) addProjectTicket(projectId, { ...newTicket, projectId });
            }
            
            // --- DAILY ACTIONS ---
            else if (name === 'update_status') {
                const { ticketId, status } = args;
                const cT = (campaign?.channels || []).flatMap(c => c.tickets).find(t => t.id === ticketId);
                if (cT && cT.channelId) {
                    updateTicket(cT.channelId, ticketId, { status: status === 'Done' ? TicketStatus.Done : TicketStatus.InProgress });
                } else {
                    const pT = (campaign?.projects || []).flatMap(p => p.tickets).find(t => t.id === ticketId);
                    if (pT && pT.projectId) {
                        updateProjectTicket(pT.projectId, ticketId, { status: status === 'Done' ? TicketStatus.Done : TicketStatus.InProgress });
                    }
                }
            }
        }

        // Send Tool Response
        setIsTyping(true);
        try {
            const toolResponse = {
                functionResponse: {
                    name: action.name,
                    id: action.callId,
                    response: { result: approved ? "Action executed." : "User rejected." }
                }
            };
            if (!chatRef.current) return;
            const response = await chatRef.current.sendMessage({ message: [toolResponse] });
            processResponse(response);
        } catch (e) {
            console.error(e);
        } finally {
            setIsTyping(false);
        }
    };

    // --- Render ---
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, pendingActions, isTyping, bulkDraft, isProcessingTranscript]);

    return (
        <div className="h-full flex flex-col bg-white">
            {!apiKey && (
                <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 text-amber-800 text-sm">
                    Gemini API key is missing. Set `GEMINI_API_KEY` in your environment to enable the Review Agent.
                </div>
            )}
            {clientError && (
                <div className="px-6 py-4 bg-red-50 border-b border-red-100 text-red-700 text-sm">
                    {clientError}
                </div>
            )}
            
            {/* Top Bar: Mode Switcher */}
            <div className="shrink-0 h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-zinc-200">
                        <Icons.Sparkles className="w-4 h-4" />
                    </div>
                    <div className="h-6 w-px bg-zinc-200"></div>
                    <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setMode('DAILY')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'DAILY' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Daily Standup
                        </button>
                        <button 
                            onClick={() => setMode('WEEKLY')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'WEEKLY' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Weekly Review
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-400">
                        LAST SESSION: {mode === 'DAILY' ? (campaign?.lastDailyStandup ? new Date(campaign.lastDailyStandup).toLocaleDateString() : 'NEVER') : (campaign?.lastWeeklyReview ? new Date(campaign.lastWeeklyReview).toLocaleDateString() : 'NEVER')}
                    </span>
                    {isDev && (
                        <button
                            onClick={handleLoadTestData}
                            className="px-2 py-1 text-[10px] font-bold text-zinc-600 bg-zinc-100 rounded-md hover:bg-zinc-200 transition-colors"
                            title="Load test data"
                        >
                            Load Test Data
                        </button>
                    )}
                    <button
                        onClick={handleResetChat}
                        className="px-2 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-100 rounded-md transition-colors"
                        title="Reset chat"
                    >
                        Reset Chat
                    </button>
                    <button 
                        onClick={() => completeReviewSession(mode)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                        title="Mark session complete"
                    >
                        <Icons.CheckCircle className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto bg-[#fafafa]">
                <div className="max-w-2xl mx-auto px-6 py-8">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`mb-6 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.parts.map((part, pIdx) => {
                                if (part.functionCall?.name === 'show_tasks') {
                                    const ticketIds = Array.isArray(part.functionCall?.args?.ticketIds) ? part.functionCall.args.ticketIds : [];
                                    const tickets = ticketIds.map((id: string) => ticketIndex.get(id)?.ticket).filter(Boolean) as Ticket[];
                                    return (
                                        <div key={pIdx} className="w-full">
                                            <ChatKanbanCallout
                                                title={part.functionCall?.args?.title}
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

                    {isProcessingTranscript && !bulkDraft && (
                        <BulkTaskCallout
                            origin="Parsing notes..."
                            initialTasks={[]}
                            users={users}
                            channels={campaign?.channels || []}
                            projects={campaign?.projects || []}
                            onApprove={() => {}}
                            onDiscard={handleBulkDiscard}
                            isLoading
                        />
                    )}

                    {bulkDraft && (
                        <BulkTaskCallout
                            origin={bulkDraft.origin}
                            initialTasks={bulkDraft.tasks}
                            users={users}
                            channels={campaign?.channels || []}
                            projects={campaign?.projects || []}
                            onApprove={handleBulkApprove}
                            onDiscard={handleBulkDiscard}
                        />
                    )}

                    {/* Pending Actions (Widgets) */}
                    {pendingActions.map(action => (
                        <div key={action.id}>
                            {(action.name === 'propose_ticket' || action.name === 'create_task') ? (
                                <AgentTicketCard 
                                    actionId={action.id}
                                    args={action.args}
                                    status={action.status}
                                    users={users}
                                    channels={campaign?.channels || []}
                                    projects={campaign?.projects || []}
                                    onUpdate={(updates) => {
                                        setPendingActions(prev => prev.map(a => a.id === action.id ? {...a, args: {...a.args, ...updates}} : a))
                                    }}
                                    onApprove={() => handleAction(action, true)}
                                    onReject={() => handleAction(action, false)}
                                />
                            ) : (
                                // Simplified Card for non-ticket actions
                                <div className={`w-full my-6 bg-white border border-zinc-100 shadow-lg rounded-xl p-4 flex items-center justify-between ${action.status !== 'PENDING' ? 'opacity-50' : ''}`}>
                                    <div>
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{action.name.replace('propose_', '').replace('_', ' ')}</div>
                                        <div className="text-sm font-semibold text-zinc-900">
                                            {action.name.includes('reschedule') && `Move to ${action.args.newDate}`}
                                            {action.name.includes('status') && `Mark as ${action.args.status}`}
                                            {action.name.includes('update') && `Mark as ${action.args.status}`}
                                        </div>
                                    </div>
                                    {action.status === 'PENDING' ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleAction(action, false)} className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded">Dismiss</button>
                                            <button onClick={() => handleAction(action, true)} className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded shadow-sm hover:bg-zinc-800">Confirm</button>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-bold text-zinc-400">{action.status}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {inlineEditDraft && (
                        <div className="w-full my-6 bg-white border border-zinc-100 shadow-lg rounded-xl p-5 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Inline Task Edit</div>
                                    <div className="text-sm font-semibold text-zinc-900">
                                        @{inlineEditDraft.target.ticket.shortId} · {inlineEditDraft.target.ticket.title}
                                    </div>
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400">
                                    {inlineEditDraft.target.type}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Title</label>
                                    <input
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        value={inlineEditDraft.form.title || ''}
                                        onChange={(e) => handleInlineDraftChange({ title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Description</label>
                                    <textarea
                                        className="w-full h-24 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                        value={inlineEditDraft.form.description || ''}
                                        onChange={(e) => handleInlineDraftChange({ description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                                        <select
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={inlineEditDraft.form.priority || inlineEditDraft.target.ticket.priority}
                                            onChange={(e) => handleInlineDraftChange({ priority: e.target.value as Priority })}
                                        >
                                            <option value="Urgent">Urgent</option>
                                            <option value="High">High</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Low">Low</option>
                                            <option value="None">None</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Assignee</label>
                                        <select
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={inlineEditDraft.form.assigneeId || ''}
                                            onChange={(e) => handleInlineDraftChange({ assigneeId: e.target.value || undefined })}
                                        >
                                            <option value="">Unassigned</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 md:col-span-1">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Start</label>
                                            <input
                                                type="date"
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                value={inlineEditDraft.form.startDate || ''}
                                                onChange={(e) => handleInlineDraftChange({ startDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Due</label>
                                            <input
                                                type="date"
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                value={inlineEditDraft.form.endDate || ''}
                                                onChange={(e) => handleInlineDraftChange({ endDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    onClick={handleInlineDraftCancel}
                                    className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleInlineDraftApprove}
                                    className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded shadow-sm hover:bg-zinc-800"
                                >
                                    Approve Changes
                                </button>
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

            {/* Input */}
            <div className="p-6 bg-white border-t border-zinc-100 shrink-0">
                <div className="max-w-2xl mx-auto relative">
                    {mentionOpen && mentionCandidates.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-zinc-200 shadow-2xl rounded-none overflow-hidden z-30">
                            {mentionCandidates.slice(0, 6).map((candidate, idx) => (
                                <button
                                    key={`${candidate.kind}-${candidate.id}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        insertMention(candidate);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${idx === mentionIndex ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${idx === mentionIndex ? 'text-white/70' : 'text-zinc-400'}`}>
                                        @{candidate.token}
                                    </span>
                                    <span className={`text-xs font-medium truncate ${idx === mentionIndex ? 'text-white' : 'text-zinc-700'}`}>
                                        {candidate.label}
                                    </span>
                                    <span className={`ml-auto text-[9px] font-semibold uppercase tracking-wider ${idx === mentionIndex ? 'text-white/70' : 'text-zinc-400'}`}>
                                        {candidate.kind === 'ticket'
                                            ? 'Ticket'
                                            : candidate.kind === 'doc'
                                                ? 'Doc'
                                                : candidate.kind === 'user'
                                                    ? 'User'
                                                    : candidate.kind === 'channel'
                                                        ? 'Channel'
                                                        : 'Project'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 pr-12 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder-zinc-400"
                        placeholder={`Talk to your ${mode === 'DAILY' ? 'Standup' : 'Review'} agent...`}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        onClick={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                        autoFocus
                        disabled={isTyping}
                        ref={inputRef}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-0 transition-all"
                    >
                        <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {showTicketModal && editingTicket && (
                <TicketModal
                    initialData={{
                        id: editingTicket.id,
                        title: editingTicket.title,
                        description: editingTicket.description,
                        priority: editingTicket.priority,
                        assigneeId: editingTicket.assigneeId,
                        channelId: editingTicket.channelId,
                        projectId: editingTicket.projectId,
                        linkedDocIds: editingTicket.linkedDocIds,
                        startDate: editingTicket.startDate,
                        endDate: editingTicket.dueDate
                    }}
                    context={{
                        channels: campaign?.channels || [],
                        projects: campaign?.projects || [],
                        users,
                        docs: campaign?.docs || []
                    }}
                    onClose={closeTicketModal}
                    onSave={handleSaveEditedTicket}
                    onDelete={(id) => handleDeleteEditedTicket(id)}
                />
            )}
        </div>
    );
};
