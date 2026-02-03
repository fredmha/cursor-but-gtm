
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { GoogleGenAI, Content } from "@google/genai";
import { 
    WEEKLY_TOOLS, DAILY_TOOLS, 
    WEEKLY_SYSTEM_INSTRUCTION, DAILY_SYSTEM_INSTRUCTION, 
    buildWeeklyContext, buildDailyContext 
} from '../services/reviewAgent';
import { TicketStatus, ChatMessage, Ticket, Priority, ContextDoc, DocFolder } from '../types';
import { AgentTicketCard } from './AgentTicketCard';
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

type PlanningHorizon = 'daily' | 'weekly' | 'quarterly' | 'sprint';

type PlanningStep = {
    key: string;
    prompt: string;
};

type PlanningDateRange = {
    start: string;
    end: string;
};

type PlanningGoal = {
    id: string;
    title: string;
    metric?: string;
    priority?: number;
};

type PlanningTask = {
    id: string;
    title: string;
    owner?: string;
    dueDate?: string;
    deps?: string[];
    sourceTicketId?: string;
};

type PlanningRisk = {
    id: string;
    title: string;
    mitigation?: string;
};

type PlanningStatusChange = {
    ticketId: string;
    status: TicketStatus;
    label: string;
};

type PlanningPayload = {
    horizon: PlanningHorizon;
    dateRange: PlanningDateRange;
    northStar?: string;
    goals: PlanningGoal[];
    tasks: PlanningTask[];
    risks: PlanningRisk[];
    assumptions: string[];
    notes: string;
    confirmedBy?: string;
    confirmedAt?: string;
};

type PlanningDraft = {
    title: string;
    summaryMarkdown: string;
    summaryHtml: string;
    payload: PlanningPayload;
    folderKey: 'Daily' | 'Weekly' | 'Quarterly' | 'Sprint';
    tags: string[];
    bulkTasks: BulkDraftTask[];
};

type PlanningSession = {
    id: string;
    horizon: PlanningHorizon;
    command: string;
    steps: PlanningStep[];
    answers: Record<string, string>;
    stepIndex: number;
    status: 'collecting' | 'awaiting_confirmation';
    startedAt: string;
    draft?: PlanningDraft;
};

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
const ORDER_STEP_VALUE = 1000;
const PRIORITY_RANK: Record<Priority, number> = {
    Urgent: 0,
    High: 1,
    Medium: 2,
    Low: 3,
    None: 4
};

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isoDate = (date: Date) => date.toISOString().split('T')[0];

const getWeekRange = (now: Date) => {
    const day = now.getDay(); // 0 = Sun, 1 = Mon
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
};

const getIsoWeek = (now: Date) => {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week };
};

const getQuarterRange = (now: Date) => {
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
    const end = new Date(now.getFullYear(), quarter * 3, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { quarter, start, end };
};

const getPlanningDateRange = (horizon: PlanningHorizon, now: Date): PlanningDateRange => {
    if (horizon === 'daily') {
        const today = isoDate(now);
        return { start: today, end: today };
    }
    if (horizon === 'weekly') {
        const { weekStart, weekEnd } = getWeekRange(now);
        return { start: isoDate(weekStart), end: isoDate(weekEnd) };
    }
    if (horizon === 'quarterly') {
        const { start, end } = getQuarterRange(now);
        return { start: isoDate(start), end: isoDate(end) };
    }
    const today = isoDate(now);
    return { start: today, end: today };
};

const getHorizonLabel = (horizon: PlanningHorizon) => {
    if (horizon === 'daily') return 'Daily';
    if (horizon === 'weekly') return 'Weekly';
    if (horizon === 'quarterly') return 'Quarterly';
    return 'Sprint';
};

const getFolderKeyForHorizon = (horizon: PlanningHorizon): PlanningDraft['folderKey'] => {
    if (horizon === 'daily') return 'Daily';
    if (horizon === 'weekly') return 'Weekly';
    if (horizon === 'quarterly') return 'Quarterly';
    return 'Sprint';
};

const getNextFolderOrder = (folders: DocFolder[], parentId: string | undefined) => {
    const siblings = folders.filter(folder => folder.parentId === parentId && !folder.isArchived);
    const maxOrder = siblings.reduce((max, folder) => Math.max(max, folder.order ?? 0), 0);
    return maxOrder + ORDER_STEP_VALUE;
};

const isActiveTicket = (ticket: Ticket) => ticket.status !== TicketStatus.Done && ticket.status !== TicketStatus.Canceled;
const isValidDate = (value?: string) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
};
const hasDateRange = (ticket: Ticket) => isValidDate(ticket.startDate) && isValidDate(ticket.dueDate);
const overlapsRange = (ticket: Ticket, start: Date, end: Date) => {
    if (!hasDateRange(ticket)) return false;
    const tStart = new Date(ticket.startDate!);
    const tEnd = new Date(ticket.dueDate!);
    return tStart <= end && tEnd >= start;
};

const PLANNING_QUESTIONS: Record<PlanningHorizon, PlanningStep[]> = {
    daily: [
        { 
            key: 'daily_intake', 
            prompt: 'Give me a quick update: changes since yesterday, today\'s top outcome, blockers, capacity, and any task moves/priorities. You can say "Move @T-123 to In Progress; Mark build retargeting list Done; Priorities: A, B, C; Capacity: focus."'
        }
    ],
    weekly: [
        { key: 'week_win', prompt: 'What must be true by Friday to call this week a win?' },
        { key: 'risks', prompt: 'Which tasks are at risk due to dependencies or staffing?' },
        { key: 'descopes', prompt: 'What should be de-scoped to protect focus?' },
        { key: 'capacity', prompt: 'What is team capacity/availability this week?' },
        { key: 'task_list', prompt: 'List the key tasks for the week (one per line, include @owner if known).' }
    ],
    quarterly: [
        { key: 'quarter_outcomes', prompt: 'What are the top 3 outcomes this quarter?' },
        { key: 'north_star_metric', prompt: 'Which metric is the single source of truth for success?' },
        { key: 'tradeoffs', prompt: 'What tradeoffs are we willing to make?' },
        { key: 'resourcing', prompt: 'Any resourcing gaps or hiring needs?' },
        { key: 'task_list', prompt: 'List the key initiatives for the quarter (one per line, include @owner if known).' }
    ],
    sprint: [
        { key: 'launch_definition', prompt: 'What is the launch date and definition of done?' },
        { key: 'dependencies', prompt: 'Which dependencies could slip the launch?' },
        { key: 'milestone_owners', prompt: 'Who owns each milestone?' },
        { key: 'scope_freeze', prompt: 'What scope is frozen for this sprint?' },
        { key: 'task_list', prompt: 'List the sprint backlog items (one per line, include @owner if known).' }
    ]
};

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

const formatError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
};

const splitList = (value: string) => value
    .split(/[;,]/g)
    .map(item => item.trim())
    .filter(Boolean);

const parseStatusChangeLine = (line: string) => {
    const cleaned = line.replace(/['"]/g, '').trim();
    if (!cleaned) return null;
    const patterns: RegExp[] = [
        /^(?:move|mark|set)\s+(.+?)\s+(?:to\s+)?(done|in progress|in-progress|todo|backlog|blocked|canceled|cancelled|killed|kill)\s*$/i,
        /^(.+?)\s*(?:->|=>)\s*(done|in progress|in-progress|todo|backlog|blocked|canceled|cancelled|killed|kill)\s*$/i,
        /^(.+?)\s+(?:is now|is|now)\s+(done|in progress|in-progress|todo|backlog|blocked|canceled|cancelled|killed|kill)\s*$/i
    ];
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (!match) continue;
        const status = parseStatusValue(match[2]);
        const subject = cleanExtract(match[1]);
        if (status && subject) {
            return { subject, status };
        }
    }
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
        campaign, currentUser, updateCampaign, addDoc,
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
    const [planningSession, setPlanningSession] = useState<PlanningSession | null>(null);
    
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

    const findTicketTargetByText = (text: string) => {
        const trimmed = cleanExtract(text).replace(/['"]/g, '').trim();
        if (!trimmed) return null;

        const mentionTokens = extractMentionTokens(trimmed);
        for (const token of mentionTokens) {
            const entity = resolveReferenceEntity(token);
            if (entity?.type === 'ticket') {
                const direct = findTicketTargetById(entity.id);
                if (direct) return direct;
            }
        }

        const shortMatch = trimmed.match(/\bT-\d+\b/i);
        if (shortMatch) {
            const byShortId = findTicketTargetById(shortMatch[0]);
            if (byShortId) return byShortId;
        }

        const normalizedQuery = normalizeText(trimmed);
        if (!normalizedQuery || normalizedQuery.length < 3) return null;

        let best: { target: TicketTarget; score: number } | null = null;
        const queryTokens = normalizedQuery.split(' ').filter(Boolean);

        allTicketTargets.forEach(target => {
            const titleNormalized = normalizeText(target.ticket.title || '');
            if (!titleNormalized) return;
            let score = 0;
            if (titleNormalized === normalizedQuery) score = 1;
            else if (titleNormalized.includes(normalizedQuery)) {
                score = Math.min(0.95, normalizedQuery.length / Math.max(titleNormalized.length, 1) + 0.2);
            } else {
                const titleTokens = new Set(titleNormalized.split(' ').filter(Boolean));
                const matchCount = queryTokens.filter(token => titleTokens.has(token)).length;
                score = matchCount / Math.max(queryTokens.length, 1);
            }

            if (!best || score > best.score) {
                best = { target, score };
            }
        });

        if (best && best.score >= 0.55) return best.target;
        return null;
    };

    const parseDailyIntake = (text: string) => {
        const answers: Record<string, string> = { daily_intake: text.trim() };
        const priorities: string[] = [];
        const statusChanges: PlanningStatusChange[] = [];
        const unmatchedStatus: string[] = [];
        const changeLines: string[] = [];
        let activeSection: 'change_since_yesterday' | 'primary_outcome' | 'blockers' | 'capacity' | 'task_list' | null = null;

        const resolveSection = (label: string) => {
            const normalized = label.toLowerCase();
            if (normalized.includes('change') || normalized.includes('yesterday')) return 'change_since_yesterday';
            if (normalized.includes('outcome') || normalized.includes('goal') || normalized.includes('important')) return 'primary_outcome';
            if (normalized.includes('block') || normalized.includes('risk')) return 'blockers';
            if (normalized.includes('capacity') || normalized.includes('availability') || normalized.includes('meeting') || normalized.includes('ooo')) return 'capacity';
            if (normalized.includes('priority') || normalized.includes('priorities') || normalized.includes('focus') || normalized.includes('today')) return 'task_list';
            return null;
        };

        const addAnswerLine = (key: string, value: string) => {
            answers[key] = answers[key] ? `${answers[key]}\n${value}` : value;
        };

        text.split('\n').forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) return;

            const cleaned = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
            if (!cleaned) return;

            const statusMatch = parseStatusChangeLine(cleaned);
            if (statusMatch) {
                const target = findTicketTargetByText(statusMatch.subject);
                if (target) {
                    statusChanges.push({
                        ticketId: target.ticket.id,
                        status: statusMatch.status,
                        label: target.ticket.shortId || target.ticket.title
                    });
                } else {
                    unmatchedStatus.push(statusMatch.subject);
                }
                changeLines.push(cleaned);
                return;
            }

            const labelMatch = cleaned.match(/^([A-Za-z][A-Za-z\s]+):\s*(.*)$/);
            if (labelMatch) {
                const section = resolveSection(labelMatch[1]);
                if (section) {
                    activeSection = section;
                    const remainder = labelMatch[2].trim();
                    if (remainder) {
                        if (section === 'task_list') {
                            priorities.push(...splitList(remainder));
                        } else {
                            addAnswerLine(section, remainder);
                        }
                    }
                    return;
                }
            }

            if (activeSection === 'task_list') {
                priorities.push(cleaned);
                return;
            }

            if (activeSection) {
                addAnswerLine(activeSection, cleaned);
                return;
            }

            if (/^(create|add|new task|task)\b/i.test(cleaned)) {
                const stripped = cleaned.replace(/^(create|add|new task|task)\b[:\s-]*/i, '').trim();
                if (stripped) priorities.push(stripped);
                return;
            }

            if (/^\d+\./.test(rawLine) || rawLine.trim().startsWith('-')) {
                priorities.push(cleaned);
                return;
            }

            changeLines.push(cleaned);
        });

        if (!answers.change_since_yesterday && changeLines.length > 0) {
            answers.change_since_yesterday = changeLines.join('\n');
        }

        if (priorities.length > 0) {
            answers.task_list = priorities.join('\n');
        }

        return { answers, priorities, statusChanges, unmatchedStatus };
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
        setPlanningSession(null);
    };

    const closeTicketModal = () => {
        setShowTicketModal(false);
        setEditingTicket(null);
    };

    const isSuggestionRequest = (value: string) => {
        const normalized = value.toLowerCase();
        return [
            'tell me',
            'you decide',
            'suggest',
            'not sure',
            'no idea',
            'idk',
            'i have them already planned',
            'already planned'
        ].some(fragment => normalized.includes(fragment));
    };

    const isNoTasksResponse = (value: string) => {
        const normalized = value.toLowerCase().trim();
        return ['none', 'no', 'no tasks', 'nothing', 'n/a'].includes(normalized);
    };

    const detectPlanningIntent = (value: string) => {
        const normalized = value.toLowerCase().trim();
        if (!normalized) return null;
        if (isSuggestionRequest(normalized)) return 'show_tasks';
        if (/(show|list|see)\s+.*tasks?/.test(normalized) || normalized === 'tasks') return 'show_tasks';
        if (/(show|what(?:'s| is))\s+.*plan/.test(normalized) || normalized === 'plan') return 'show_plan';
        if (/(cancel|stop|nevermind|never mind|exit)/.test(normalized)) return 'cancel';
        if (/(skip|pass|next)/.test(normalized)) return 'skip';
        if (/(save|confirm|approve)/.test(normalized)) return 'confirm';
        if (/(not listening|this is terrible|what the fuck|wtf|you aren.t listening|losing your mind)/.test(normalized)) return 'meta';
        return null;
    };

    const getSuggestedTasksForHorizon = (horizon: PlanningHorizon) => {
        if (!campaign) return [];
        const now = new Date();
        const today = isoDate(now);
        const activeTickets = allTickets.filter(isActiveTicket);
        let candidates = activeTickets;

        if (horizon === 'daily') {
            candidates = activeTickets.filter(ticket =>
                (ticket.dueDate && ticket.dueDate <= today) || ticket.status === TicketStatus.InProgress
            );
            if (candidates.length === 0) {
                candidates = activeTickets.filter(ticket => ticket.status === TicketStatus.Todo);
            }
        } else if (horizon === 'weekly') {
            const { weekStart, weekEnd } = getWeekRange(now);
            const start = isoDate(weekStart);
            const end = isoDate(weekEnd);
            candidates = activeTickets.filter(ticket =>
                ticket.dueDate && ticket.dueDate >= start && ticket.dueDate <= end
            );
            if (candidates.length === 0) {
                candidates = activeTickets.filter(ticket => ticket.status === TicketStatus.InProgress);
            }
        } else if (horizon === 'quarterly') {
            const { start, end } = getQuarterRange(now);
            const rangeStart = isoDate(start);
            const rangeEnd = isoDate(end);
            candidates = activeTickets.filter(ticket =>
                ticket.dueDate && ticket.dueDate >= rangeStart && ticket.dueDate <= rangeEnd
            );
        } else {
            const sprintEnd = new Date(now);
            sprintEnd.setDate(sprintEnd.getDate() + 14);
            const end = isoDate(sprintEnd);
            candidates = activeTickets.filter(ticket =>
                (ticket.dueDate && ticket.dueDate >= today && ticket.dueDate <= end) || ticket.status === TicketStatus.InProgress
            );
        }

        const sorted = [...candidates].sort((a, b) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            if (aDue !== bDue) return aDue - bDue;
            const aPriority = a.priority ? PRIORITY_RANK[a.priority] : PRIORITY_RANK.None;
            const bPriority = b.priority ? PRIORITY_RANK[b.priority] : PRIORITY_RANK.None;
            return aPriority - bPriority;
        });

        const limit = horizon === 'daily' ? 5 : horizon === 'weekly' ? 8 : 10;
        return sorted.slice(0, limit).map(ticket => ({
            id: generateId(),
            title: ticket.title,
            description: ticket.description,
            assigneeId: ticket.assigneeId,
            priority: ticket.priority,
            channelId: ticket.channelId,
            projectId: ticket.projectId,
            sourceTicketId: ticket.id
        }));
    };

    const getPlanningTicketsForHorizon = (horizon: PlanningHorizon) => {
        if (!campaign) return [];
        const ownedTickets = allTickets.filter(ticket => ticket.assigneeId === currentUser.id);
        const activeTickets = ownedTickets.filter(isActiveTicket);
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        let rangeStart = today;
        let rangeEnd = today;

        if (horizon === 'weekly') {
            const { weekStart, weekEnd } = getWeekRange(now);
            rangeStart = weekStart;
            rangeEnd = weekEnd;
        } else if (horizon === 'quarterly') {
            const { start, end } = getQuarterRange(now);
            rangeStart = start;
            rangeEnd = end;
        } else if (horizon === 'sprint') {
            const { weekStart, weekEnd } = getWeekRange(now);
            rangeStart = weekStart;
            rangeEnd = weekEnd;
        }

        const matchesRange = activeTickets.filter(ticket => overlapsRange(ticket, rangeStart, rangeEnd));
        const backlog = activeTickets.filter(ticket => ticket.status === TicketStatus.Backlog && hasDateRange(ticket));
        const undated = activeTickets.filter(ticket => !hasDateRange(ticket));
        const merged = [...matchesRange, ...backlog, ...undated];
        const seen = new Set<string>();
        const unique = merged.filter(ticket => {
            if (seen.has(ticket.id)) return false;
            seen.add(ticket.id);
            return true;
        });
        const sorted = [...unique].sort((a, b) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            if (aDue !== bDue) return aDue - bDue;
            const aPriority = a.priority ? PRIORITY_RANK[a.priority] : PRIORITY_RANK.None;
            const bPriority = b.priority ? PRIORITY_RANK[b.priority] : PRIORITY_RANK.None;
            return aPriority - bPriority;
        });
        return sorted;
    };

    const showPlanningTasks = (horizon: PlanningHorizon) => {
        const tickets = getPlanningTicketsForHorizon(horizon);
        const ticketIds = tickets.map(ticket => ticket.id);
        if (ticketIds.length === 0) {
            appendModelMessage('No active tasks found for this horizon.');
            return;
        }
        const title = `${getHorizonLabel(horizon)} Planning Tasks`;
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

    const ensurePlanningFolders = () => {
        if (!campaign) return null;
        const now = new Date().toISOString();
        const existing = campaign.docFolders || [];
        const created: DocFolder[] = [];

        const findFolder = (name: string, parentId: string | undefined) => {
            return [...existing, ...created].find(folder =>
                folder.name === name && folder.parentId === parentId && !folder.isArchived
            );
        };

        const ensureFolder = (name: string, parentId: string | undefined, icon: string, isRagIndexed?: boolean) => {
            const existingFolder = findFolder(name, parentId);
            if (existingFolder) return existingFolder;
            const folder: DocFolder = {
                id: generateId(),
                name,
                icon,
                parentId,
                order: getNextFolderOrder([...existing, ...created], parentId),
                isArchived: false,
                isFavorite: false,
                isRagIndexed,
                createdAt: now
            };
            created.push(folder);
            return folder;
        };

        const root = ensureFolder('Planning', undefined, '🗂️', true);
        const daily = ensureFolder('Daily', root.id, '📅');
        const weekly = ensureFolder('Weekly', root.id, '🗓️');
        const quarterly = ensureFolder('Quarterly', root.id, '📌');
        const sprint = ensureFolder('Sprint', root.id, '🏁');
        const context = ensureFolder('Context', root.id, '🧭');
        const uploads = ensureFolder('Uploads', root.id, '📎');
        const index = ensureFolder('Index', root.id, '📍');

        if (created.length > 0) {
            updateCampaign({ docFolders: [...existing, ...created] });
        }

        return {
            rootId: root.id,
            Daily: daily.id,
            Weekly: weekly.id,
            Quarterly: quarterly.id,
            Sprint: sprint.id,
            Context: context.id,
            Uploads: uploads.id,
            Index: index.id
        };
    };

    const parsePlanningTasks = (value: string) => {
        const rawLines = value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        const planningTasks: PlanningTask[] = [];
        const bulkTasks: BulkDraftTask[] = [];

        rawLines.forEach((line) => {
            const cleaned = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
            if (!cleaned) return;

            const mentionMatches = Array.from(cleaned.matchAll(/@([A-Za-z0-9-_]+)/g)).map(match => match[1]);
            let assigneeId: string | undefined;
            let ownerLabel: string | undefined;

            for (const token of mentionMatches) {
                const entity = resolveReferenceEntity(token);
                if (entity?.type === 'user') {
                    assigneeId = entity.id;
                    ownerLabel = entity.label;
                    break;
                }
            }

            const dueMatch = cleaned.match(/\b\d{4}-\d{2}-\d{2}\b/);
            const dueDate = dueMatch ? dueMatch[0] : undefined;

            const title = cleaned
                .replace(/@([A-Za-z0-9-_]+)/g, '')
                .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            const finalTitle = title || cleaned;
            if (!finalTitle) return;

            const matchedTarget = findTicketTargetByText(cleaned);
            const matchedAssignee = matchedTarget?.ticket.assigneeId
                ? userNameById.get(matchedTarget.ticket.assigneeId)
                : undefined;

            planningTasks.push({
                id: generateId(),
                title: finalTitle,
                owner: ownerLabel || matchedAssignee,
                dueDate,
                sourceTicketId: matchedTarget?.ticket.id
            });

            if (!matchedTarget) {
                bulkTasks.push({
                    id: generateId(),
                    title: finalTitle,
                    assigneeId,
                    priority: 'Medium'
                });
            }
        });

        return { planningTasks, bulkTasks };
    };

    const buildPlanningDraft = (session: PlanningSession, now: Date): PlanningDraft => {
        const dateRange = getPlanningDateRange(session.horizon, now);
        const horizonLabel = getHorizonLabel(session.horizon);
        const folderKey = getFolderKeyForHorizon(session.horizon);

        const primaryGoalAnswer = session.answers.primary_outcome
            || session.answers.week_win
            || session.answers.quarter_outcomes
            || session.answers.scope_freeze
            || '';

        const goals: PlanningGoal[] = primaryGoalAnswer
            ? [{ id: 'g-1', title: primaryGoalAnswer, priority: 1 }]
            : [];

        const riskAnswer = session.answers.blockers
            || session.answers.risks
            || session.answers.dependencies
            || '';

        const risks: PlanningRisk[] = riskAnswer
            ? [{ id: 'r-1', title: riskAnswer }]
            : [];

        const assumptions = [
            session.answers.capacity,
            session.answers.tradeoffs,
            session.answers.resourcing,
            session.answers.descopes,
            session.answers.scope_freeze
        ].filter((value): value is string => !!value);

        const notes = session.horizon === 'daily' && session.answers.daily_intake
            ? [
                `change_since_yesterday: ${session.answers.change_since_yesterday || ''}`,
                `primary_outcome: ${session.answers.primary_outcome || ''}`,
                `blockers: ${session.answers.blockers || ''}`,
                `capacity: ${session.answers.capacity || ''}`,
                `task_list: ${session.answers.task_list || ''}`,
                `daily_intake: ${session.answers.daily_intake || ''}`
            ].join('\n')
            : session.steps
                .map(step => `${step.key}: ${session.answers[step.key] || ''}`)
                .join('\n');

        const taskInput = session.answers.task_list || '';
        const useAgenticTasks = taskInput === '__agentic__';
        const noTasks = taskInput === '__none__';
        const suggestedTasks = useAgenticTasks ? getSuggestedTasksForHorizon(session.horizon) : [];
        const { planningTasks: parsedTasks, bulkTasks } = parsePlanningTasks(taskInput);
        const planningTasks = useAgenticTasks
            ? suggestedTasks.map(task => ({
                id: generateId(),
                title: task.title,
                owner: task.assigneeId ? userNameById.get(task.assigneeId) : undefined,
                dueDate: undefined,
                sourceTicketId: task.sourceTicketId
            }))
            : noTasks
                ? []
                : parsedTasks;

        const payload: PlanningPayload = {
            horizon: session.horizon,
            dateRange,
            northStar: campaign?.objective,
            goals,
            tasks: planningTasks,
            risks,
            assumptions,
            notes
        };

        const questionMarkdown = session.horizon === 'daily' && session.answers.daily_intake
            ? [
                `- **What changed since yesterday?**\n  ${session.answers.change_since_yesterday || '—'}`,
                `- **What is the single most important outcome today?**\n  ${session.answers.primary_outcome || '—'}`,
                `- **What is blocked and who can unblock it?**\n  ${session.answers.blockers || '—'}`,
                `- **What is your capacity today (focus time, meetings, OOO)?**\n  ${session.answers.capacity || '—'}`
            ].join('\n')
            : session.steps.map(step => {
                const answer = session.answers[step.key] || '—';
                return `- **${step.prompt}**\n  ${answer}`;
            }).join('\n');

        const taskSummary = planningTasks.length > 0
            ? planningTasks.map(task => `- ${task.title}${task.owner ? ` (${task.owner})` : ''}`).join('\n')
            : '- No tasks selected.';

        const summaryMarkdown = [
            `## Draft ${horizonLabel} Plan`,
            `**Date Range:** ${dateRange.start} - ${dateRange.end}`,
            '',
            '### Inputs',
            questionMarkdown,
            '',
            '### Tasks',
            taskSummary
        ].join('\n');

        const questionHtml = session.horizon === 'daily' && session.answers.daily_intake
            ? [
                `<li><strong>What changed since yesterday?</strong><br/>${escapeHtml(session.answers.change_since_yesterday || '—')}</li>`,
                `<li><strong>What is the single most important outcome today?</strong><br/>${escapeHtml(session.answers.primary_outcome || '—')}</li>`,
                `<li><strong>What is blocked and who can unblock it?</strong><br/>${escapeHtml(session.answers.blockers || '—')}</li>`,
                `<li><strong>What is your capacity today (focus time, meetings, OOO)?</strong><br/>${escapeHtml(session.answers.capacity || '—')}</li>`
            ].join('')
            : session.steps.map(step => {
                const answer = session.answers[step.key] || '—';
                return `<li><strong>${escapeHtml(step.prompt)}</strong><br/>${escapeHtml(answer)}</li>`;
            }).join('');

        const tasksHtml = planningTasks.length > 0
            ? `<ul>${planningTasks.map(task => `<li>${escapeHtml(task.title)}${task.owner ? ` (${escapeHtml(task.owner)})` : ''}</li>`).join('')}</ul>`
            : '<p>No tasks selected.</p>';

        const summaryHtml = [
            `<h2>${escapeHtml(`${horizonLabel} Plan`)}</h2>`,
            `<p><strong>Date Range:</strong> ${escapeHtml(`${dateRange.start} - ${dateRange.end}`)}</p>`,
            '<h3>Inputs</h3>',
            `<ul>${questionHtml}</ul>`,
            '<h3>Tasks</h3>',
            tasksHtml
        ].join('');

        const titleBase = (() => {
            if (session.horizon === 'daily') return `${dateRange.start} - Daily Plan`;
            if (session.horizon === 'weekly') {
                const { year, week } = getIsoWeek(now);
                return `${year}-W${String(week).padStart(2, '0')} - Weekly Plan`;
            }
            if (session.horizon === 'quarterly') {
                const { quarter } = getQuarterRange(now);
                return `${now.getFullYear()}-Q${quarter} - Quarterly Plan`;
            }
            return `Sprint Plan - ${dateRange.start}`;
        })();

        const tags = ['Planning', horizonLabel, dateRange.start];

        return {
            title: titleBase,
            summaryMarkdown,
            summaryHtml,
            payload,
            folderKey,
            tags,
            bulkTasks: useAgenticTasks || noTasks ? [] : bulkTasks
        };
    };

    const buildDraftFromSession = (session: PlanningSession) => {
        const nextAnswers = { ...session.answers };
        if (!nextAnswers.task_list) {
            const suggestions = getSuggestedTasksForHorizon(session.horizon);
            if (suggestions.length > 0) {
                nextAnswers.task_list = '__agentic__';
            }
        }
        return buildPlanningDraft({ ...session, answers: nextAnswers }, new Date());
    };

    const savePlanningDraft = (draft: PlanningDraft) => {
        if (!campaign) return null;
        const folderIds = ensurePlanningFolders();
        const folderId = folderIds?.[draft.folderKey];
        if (!folderId) return null;

        const nowIso = new Date().toISOString();
        const payload: PlanningPayload = {
            ...draft.payload,
            confirmedBy: currentUser.id,
            confirmedAt: nowIso
        };

        const planJson = escapeHtml(JSON.stringify(payload, null, 2));
        const content = `${draft.summaryHtml}\n<pre data-plan-json>${planJson}</pre>`;

        const doc: ContextDoc = {
            id: generateId(),
            title: draft.title,
            content,
            format: 'TEXT',
            folderId,
            lastUpdated: nowIso,
            isAiGenerated: true,
            tags: draft.tags,
            isRagIndexed: true,
            createdAt: nowIso,
            createdBy: currentUser.id,
            lastEditedBy: currentUser.id
        };

        addDoc(doc);
        return doc.id;
    };

    const startPlanningSession = (horizon: PlanningHorizon, command: string) => {
        const steps = PLANNING_QUESTIONS[horizon];
        const now = new Date().toISOString();
        ensurePlanningFolders();
        const suggestions = getSuggestedTasksForHorizon(horizon);
        const stepList = suggestions.length > 0
            ? steps.filter(step => step.key !== 'task_list')
            : steps;
        const nextSession: PlanningSession = {
            id: generateId(),
            horizon,
            command,
            steps: stepList,
            answers: suggestions.length > 0 ? { task_list: '__agentic__' } : {},
            stepIndex: 0,
            status: 'collecting',
            startedAt: now
        };
        setPlanningSession(nextSession);
        const planningTickets = getPlanningTicketsForHorizon(horizon);
        const inProgress = planningTickets.filter(ticket => ticket.status === TicketStatus.InProgress).length;
        const todo = planningTickets.filter(ticket => ticket.status === TicketStatus.Todo || ticket.status === TicketStatus.Backlog).length;
        const overdue = planningTickets.filter(ticket => ticket.dueDate && ticket.dueDate < isoDate(new Date())).length;
        const firstPrompt = stepList[0]?.prompt || 'Share the key inputs to start the plan.';
        appendModelMessage(
            `Starting ${getHorizonLabel(horizon)} plan. Context loaded: ${inProgress} in progress, ${todo} todo, ${overdue} overdue. Say "show tasks" to see details. ${firstPrompt}`
        );
    };

    const handlePlanningInput = (text: string) => {
        if (!planningSession) return false;
        const trimmed = text.trim();
        if (!trimmed) return true;

        const intent = detectPlanningIntent(trimmed);
        if (intent === 'show_tasks') {
            showPlanningTasks(planningSession.horizon);
            const prompt = planningSession.steps[planningSession.stepIndex]?.prompt;
            if (prompt) {
                appendModelMessage(`Tasks shown. When you're ready, answer: "${prompt}" or say "skip".`);
            }
            return true;
        }
        if (intent === 'show_plan') {
            const draft = buildDraftFromSession(planningSession);
            appendModelMessage(draft.summaryMarkdown);
            return true;
        }
        if (intent === 'cancel') {
            appendModelMessage('Okay, ending this planning session.');
            setPlanningSession(null);
            return true;
        }
        if (intent === 'meta') {
            appendModelMessage('Got it. I can show tasks, propose priorities, or skip this question. What do you want?');
            return true;
        }

        if (planningSession.status === 'collecting') {
            if (intent === 'skip') {
                const step = planningSession.steps[planningSession.stepIndex];
                const answers = { ...planningSession.answers, [step.key]: '' };
                const nextIndex = planningSession.stepIndex + 1;
                if (nextIndex < planningSession.steps.length) {
                    setPlanningSession({
                        ...planningSession,
                        answers,
                        stepIndex: nextIndex
                    });
                    appendModelMessage(planningSession.steps[nextIndex].prompt);
                    return true;
                }
                const draft = buildPlanningDraft({ ...planningSession, answers, stepIndex: nextIndex }, new Date());
                setPlanningSession({
                    ...planningSession,
                    answers,
                    stepIndex: nextIndex,
                    status: 'awaiting_confirmation',
                    draft
                });
                appendModelMessage(`${draft.summaryMarkdown}\n\nConfirm to save this plan? (yes/no)`);
                return true;
            }

            const step = planningSession.steps[planningSession.stepIndex];
            if (step.key === 'daily_intake' && planningSession.horizon === 'daily') {
                const { answers: parsedAnswers, priorities, statusChanges, unmatchedStatus } = parseDailyIntake(trimmed);
                const nextAnswers = { ...planningSession.answers, ...parsedAnswers };

                if (!nextAnswers.task_list) {
                    if (isNoTasksResponse(trimmed)) {
                        nextAnswers.task_list = '__none__';
                    } else {
                        const suggestions = getSuggestedTasksForHorizon(planningSession.horizon);
                        if (suggestions.length > 0) {
                            nextAnswers.task_list = '__agentic__';
                        }
                    }
                }

                const statusSummaryLines = statusChanges.map(change => `- ${change.label} -> ${change.status}`);
                statusChanges.forEach(change => handleStatusChange(change.ticketId, change.status));

                const summaryParts: string[] = [];
                if (statusSummaryLines.length > 0) {
                    summaryParts.push(`Status updates:\n${statusSummaryLines.join('\n')}`);
                }
                if (priorities.length > 0) {
                    summaryParts.push(`Priorities captured:\n${priorities.map(item => `- ${item}`).join('\n')}`);
                }
                if (unmatchedStatus.length > 0) {
                    summaryParts.push(`Could not match these tasks:\n${unmatchedStatus.map(item => `- ${item}`).join('\n')}`);
                }

                if (summaryParts.length > 0) {
                    appendModelMessage(`Got it. Here's what I captured:\n${summaryParts.join('\n\n')}`);
                }

                if (statusChanges.length > 0 || priorities.length > 0) {
                    showPlanningTasks(planningSession.horizon);
                }

                const nextIndex = planningSession.steps.length;
                const draft = buildPlanningDraft({ ...planningSession, answers: nextAnswers, stepIndex: nextIndex }, new Date());
                setPlanningSession({
                    ...planningSession,
                    answers: nextAnswers,
                    stepIndex: nextIndex,
                    status: 'awaiting_confirmation',
                    draft
                });
                appendModelMessage(`${draft.summaryMarkdown}\n\nConfirm to save this plan? (yes/no)`);
                return true;
            }
            if (step.key === 'task_list') {
                if (isNoTasksResponse(trimmed)) {
                    const answers = { ...planningSession.answers, [step.key]: '__none__' };
                    const nextIndex = planningSession.stepIndex + 1;
                    const draft = buildPlanningDraft({ ...planningSession, answers, stepIndex: nextIndex }, new Date());
                    setPlanningSession({
                        ...planningSession,
                        answers,
                        stepIndex: nextIndex,
                        status: 'awaiting_confirmation',
                        draft
                    });
                    appendModelMessage(`${draft.summaryMarkdown}\n\nConfirm to save this plan? (yes/no)`);
                    return true;
                }

                if (isSuggestionRequest(trimmed)) {
                    const suggestions = getSuggestedTasksForHorizon(planningSession.horizon);
                    if (suggestions.length === 0) {
                        appendModelMessage('I could not find any existing tasks to suggest. Please list 1-3 priorities or say "no tasks".');
                        return true;
                    }
                    const answers = { ...planningSession.answers, [step.key]: '__agentic__' };
                    const nextIndex = planningSession.stepIndex + 1;
                    const draft = buildPlanningDraft({ ...planningSession, answers, stepIndex: nextIndex }, new Date());
                    setPlanningSession({
                        ...planningSession,
                        answers,
                        stepIndex: nextIndex,
                        status: 'awaiting_confirmation',
                        draft
                    });
                    appendModelMessage(`${draft.summaryMarkdown}\n\nConfirm to save this plan? (yes/no)`);
                    return true;
                }
            }

            const answers = { ...planningSession.answers, [step.key]: trimmed };
            const nextIndex = planningSession.stepIndex + 1;

            if (nextIndex < planningSession.steps.length) {
                setPlanningSession({
                    ...planningSession,
                    answers,
                    stepIndex: nextIndex
                });
                appendModelMessage(planningSession.steps[nextIndex].prompt);
                return true;
            }

            const draft = buildPlanningDraft({ ...planningSession, answers, stepIndex: nextIndex }, new Date());
            setPlanningSession({
                ...planningSession,
                answers,
                stepIndex: nextIndex,
                status: 'awaiting_confirmation',
                draft
            });
            appendModelMessage(`${draft.summaryMarkdown}\n\nConfirm to save this plan? (yes/no)`);
            return true;
        }

        if (planningSession.status === 'awaiting_confirmation') {
            const normalized = trimmed.toLowerCase();
            const isAffirmative = ['yes', 'y', 'confirm', 'approved', 'approve', 'save', 'ok', 'okay', 'sure'].includes(normalized);
            const isNegative = ['no', 'n', 'cancel', 'discard', 'stop', 'nevermind', 'never mind'].includes(normalized);

            if (isAffirmative) {
                if (!planningSession.draft) {
                    appendModelMessage('Missing draft details. Restart the plan with /start daily plan.');
                    setPlanningSession(null);
                    return true;
                }
                const docId = savePlanningDraft(planningSession.draft);
                if (docId) {
                    appendModelMessage(`Plan saved to Docs > Planning > ${planningSession.draft.folderKey}.`);
                } else {
                    appendModelMessage('Unable to save the plan. Please try again.');
                }
                if (planningSession.draft.bulkTasks.length > 0) {
                    setBulkDraft({
                        origin: `${getHorizonLabel(planningSession.horizon)} Plan` ,
                        tasks: planningSession.draft.bulkTasks
                    });
                    appendModelMessage('Review the drafted tasks below and approve to create them.');
                }
                setPlanningSession(null);
                return true;
            }

            if (isNegative) {
                const restartHint = planningSession.horizon === 'sprint'
                    ? '/set sprint plan'
                    : `/start ${planningSession.horizon} plan`;
                appendModelMessage(`Okay, I will not save this plan. If you want to restart, use ${restartHint}.`);
                setPlanningSession(null);
                return true;
            }

            if (intent === 'show_tasks') {
                showPlanningTasks(planningSession.horizon);
                return true;
            }

            if (planningSession.draft) {
                const nextDraft: PlanningDraft = {
                    ...planningSession.draft,
                    payload: {
                        ...planningSession.draft.payload,
                        notes: `${planningSession.draft.payload.notes}\nUser note: ${trimmed}`
                    }
                };
                setPlanningSession({ ...planningSession, draft: nextDraft });
            }
            appendModelMessage('Noted. Reply "yes" to save or "no" to discard.');
            return true;
        }

        return false;
    };

    const getMentionContext = (value: string, cursor: number) => {
        const text = value.slice(0, cursor);
        const match = text.match(/(^|\s)@([A-Za-z0-9-_]*)$/);
        if (!match) return null;
        const query = match[2] || '';
        const start = cursor - query.length - 1;
        return { start, query };
    };

    const closeMentionState = () => {
        setMentionOpen(false);
        setMentionQuery('');
        setMentionStart(null);
    };

    const updateAutocompleteState = (value: string, cursor: number) => {
        const mentionCtx = getMentionContext(value, cursor);
        if (!mentionCtx) {
            closeMentionState();
            return;
        }

        setMentionOpen(true);
        setMentionQuery(mentionCtx.query);
        setMentionStart(mentionCtx.start);
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
        updateAutocompleteState(nextValue, cursor);
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
                closeMentionState();
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
            setClientError(`Transcript synthesis failed: ${formatError(e)}`);
            setIsProcessingTranscript(false);
        } finally {
            setIsTyping(false);
        }
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
            const context = mode === 'DAILY' ? buildDailyContext(campaign, currentUser) : buildWeeklyContext(campaign, currentUser);

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
            setClientError(`Chat failed to initialize: ${formatError(e)}`);
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
        closeMentionState();
        if (planningSession && !trimmedText.startsWith('/')) {
            appendUserMessage(rawText);
            handlePlanningInput(rawText);
            return;
        }

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
            setClientError(`Chat send failed: ${formatError(e)}`);
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
                const { title, description, channelId, projectId, priority, startDate, endDate } = args;
                const newTicket = {
                    id: generateId(),
                    shortId: `T-${Math.floor(Math.random() * 1000)}`,
                    title,
                    description: description || '',
                    priority: priority || 'Medium',
                    status: TicketStatus.Todo,
                    assigneeId: currentUser.id,
                    startDate: startDate || undefined,
                    dueDate: endDate || undefined,
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
                        onClick={(e) => updateAutocompleteState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
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


