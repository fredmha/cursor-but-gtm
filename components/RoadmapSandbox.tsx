
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { RoadmapItem, User, OperatingPrinciple, Priority, Status, TicketStatus, ChannelTag, Project, TimelineTag } from '../types';
import { ProjectDashboard } from './ProjectDashboard';
import { ChannelDashboard } from './ChannelDashboard';
import { TicketModal } from './TicketModal';

interface RoadmapSandboxProps {
    onNext?: () => void;
    onBack?: () => void;
}

const WEEK_WIDTH = 200;
const LEFT_PANEL_WIDTH = 280;
const ITEM_HEIGHT = 32;
const ITEM_GAP = 4;
const ROW_PADDING_TOP = 12;
const ROW_PADDING_BOTTOM = 12;
const MIN_ROW_HEIGHT = 120;

interface LayoutItem extends RoadmapItem {
    _layout: {
        top: number;
        height: number;
    };
}

const calculateLaneLayout = (items: RoadmapItem[], campaignStart?: Date): { layoutItems: LayoutItem[], rowHeight: number } => {
    // Only calculate layout for scheduled items
    const scheduledItems = items.filter(i => i.weekIndex >= 0 || i.startDate);

    const getNormalizedTime = (item: RoadmapItem) => {
        if (item.startDate && campaignStart) {
            const start = new Date(item.startDate);
            const diffTime = start.getTime() - campaignStart.getTime();
            const startWeek = diffTime / (1000 * 60 * 60 * 24 * 7);

            let endWeek = startWeek + (item.durationWeeks || 1);
            if (item.endDate) {
                const end = new Date(item.endDate);
                endWeek = (end.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24 * 7);
            }
            return { start: startWeek, end: endWeek };
        }
        return {
            start: item.weekIndex,
            end: item.weekIndex + (item.durationWeeks || 1)
        };
    };

    const sorted = [...scheduledItems].sort((a, b) => {
        const aTime = getNormalizedTime(a);
        const bTime = getNormalizedTime(b);
        if (aTime.start !== bTime.start) return aTime.start - bTime.start;
        return (bTime.end - bTime.start) - (aTime.end - aTime.start);
    });

    const layoutItems: LayoutItem[] = [];
    const slots: LayoutItem[][] = [];

    sorted.forEach(item => {
        let placed = false;
        let slotIndex = 0;
        const itemTime = getNormalizedTime(item);

        while (!placed) {
            if (!slots[slotIndex]) {
                slots[slotIndex] = [];
            }

            const hasCollision = slots[slotIndex].some(existing => {
                const existingTime = getNormalizedTime(existing);
                return itemTime.start < existingTime.end && itemTime.end > existingTime.start;
            });

            if (!hasCollision) {
                const layoutItem: LayoutItem = {
                    ...item,
                    _layout: {
                        top: ROW_PADDING_TOP + slotIndex * (ITEM_HEIGHT + ITEM_GAP),
                        height: ITEM_HEIGHT
                    }
                };
                slots[slotIndex].push(layoutItem);
                layoutItems.push(layoutItem);
                placed = true;
            } else {
                slotIndex++;
            }
        }
    });

    const maxSlot = slots.length;
    const contentHeight = ROW_PADDING_TOP + (maxSlot * (ITEM_HEIGHT + ITEM_GAP)) + ROW_PADDING_BOTTOM;
    const rowHeight = Math.max(MIN_ROW_HEIGHT, contentHeight);

    return { layoutItems, rowHeight };
};

// STRATEGY HORIZON COMPONENT
const StrategyHorizon: React.FC<{
    projects: Project[];
    users: User[];
    roadmapItems: RoadmapItem[];
    campaignStart: Date;
    onProjectClick: (projectId: string) => void;
    onCardClick: (item: RoadmapItem) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    handleDrop: (e: React.DragEvent, channelId: string | undefined, weekIndex: number, projectId?: string) => void;
    draggedItemId: string | null;
    weekCount: number;
    weeks: Date[];
}> = ({ projects, users, roadmapItems, campaignStart, onProjectClick, onCardClick, onDragStart, handleDrop, draggedItemId, weekCount, weeks }) => {

    return (
        <div className="min-w-max bg-white border-b border-zinc-100 relative z-30">
            <div className="flex flex-col">
                <div className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-4 py-2">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <Icons.Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Strategy Horizon</span>
                    </div>
                </div>

                {projects.map(project => {
                    if (!project.startDate || !project.targetDate) return null;

                    const startRaw = new Date(project.startDate);
                    const end = new Date(project.targetDate);
                    const campaignS = new Date(campaignStart);

                    if (end <= campaignS) return null;

                    const start = startRaw < campaignS ? campaignS : startRaw;

                    const diffTime = start.getTime() - campaignS.getTime();
                    const startOffsetPixels = (diffTime / (1000 * 60 * 60 * 24 * 7)) * WEEK_WIDTH;

                    const durationTime = end.getTime() - start.getTime();
                    const widthPixels = Math.max((durationTime / (1000 * 60 * 60 * 24 * 7)) * WEEK_WIDTH, 40);

                    const colorClass = project.status === 'On Track' ? 'bg-emerald-500' : project.status === 'At Risk' ? 'bg-amber-500' : project.status === 'Off Track' ? 'bg-red-500' : 'bg-zinc-500';

                    // EXECUTION LOGIC: Calculate layout for project-specific tasks
                    const projectItems = roadmapItems.filter(i => i.projectId === project.id && !i.channelId);
                    const { layoutItems, rowHeight } = calculateLaneLayout(projectItems, campaignS);
                    const unscheduledItems = projectItems.filter(i => i.weekIndex < 0);

                    return (
                        <div key={project.id} className="flex border-b border-zinc-100 group/row hover:bg-zinc-50 transition-colors" style={{ minHeight: Math.max(72, rowHeight) }}>
                            {/* Project Header (Left) */}
                            <div className="shrink-0 border-r border-zinc-100 bg-zinc-50 p-3 flex flex-col justify-center sticky left-0 z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" style={{ width: LEFT_PANEL_WIDTH }}>
                                <div
                                    onClick={() => onProjectClick(project.id)}
                                    className="flex items-center gap-2 cursor-pointer group mb-1"
                                >
                                    <div className={`w-2.5 h-2.5 rounded-full ${colorClass} shadow-sm ring-1 ring-white`}></div>
                                    <span className="text-sm font-semibold text-zinc-700 group-hover:text-zinc-900 truncate">{project.name}</span>
                                </div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 ml-4">Project Workspace</div>

                                {unscheduledItems.length > 0 && (
                                    <div className="mt-4 border-t border-zinc-200/50 pt-3">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-2 pl-1">Inbox</div>
                                        <div className="flex flex-col gap-2">
                                            {unscheduledItems.map(item => (
                                                <RoadmapCard
                                                    key={item.id}
                                                    item={item}
                                                    users={users}
                                                    projects={projects}
                                                    isDragging={draggedItemId === item.id}
                                                    onDragStart={onDragStart}
                                                    onClick={() => onCardClick(item)}
                                                    isBacklog={true}
                                                    campaignStart={campaignS}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Timeline & Execution (Right) */}
                            <div className="relative flex-1 bg-white overflow-visible">
                                {/* Vertical Grid Lines */}
                                <div className="absolute inset-0 flex pointer-events-none h-full">
                                    {Array.from({ length: weekCount }).map((_, i) => (
                                        <div key={i} className="border-r border-zinc-100 h-full" style={{ width: WEEK_WIDTH }}></div>
                                    ))}
                                </div>

                                {/* Background Target Bar (Strategy) */}
                                <div
                                    className={`absolute top-0 h-1.5 opacity-20 ${colorClass}`}
                                    style={{ left: startOffsetPixels, width: widthPixels }}
                                />

                                {/* Execution Grid (Cards & Dropzones) */}
                                <div className="flex relative h-full">
                                    {weeks.map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-full relative group/cell hover:bg-zinc-50 transition-colors"
                                            style={{ width: WEEK_WIDTH }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, undefined, i, project.id)}
                                            onClick={() => onCardClick({ projectId: project.id, weekIndex: i, title: '' } as RoadmapItem)}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 pointer-events-none">
                                                <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                    <Icons.Plus className="w-3 h-3" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Task Cards */}
                                    {layoutItems.map(item => (
                                        <RoadmapCard
                                            key={item.id}
                                            item={item}
                                            users={users}
                                            projects={projects}
                                            isDragging={draggedItemId === item.id}
                                            onDragStart={onDragStart}
                                            onClick={() => onCardClick(item)}
                                            campaignStart={campaignS}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RoadmapCard: React.FC<{
    item: RoadmapItem | LayoutItem;
    users: User[];
    projects: any[];
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onClick: () => void;
    isBacklog?: boolean;
    campaignStart?: Date;
}> = ({ item, users, projects, isDragging, onDragStart, onClick, isBacklog = false, campaignStart }) => {

    // Day precision calculation
    let left = (item.weekIndex * WEEK_WIDTH) + 4;
    let width = ((item.durationWeeks || 1) * WEEK_WIDTH) - 8;

    if (!isBacklog && campaignStart && item.startDate) {
        const startRaw = new Date(item.startDate);
        const campaignS = new Date(campaignStart);
        const end = item.endDate ? new Date(item.endDate) : null;

        if (end && end <= campaignS) return null;

        const start = startRaw < campaignS ? campaignS : startRaw;
        const diffTime = start.getTime() - campaignS.getTime();
        left = (diffTime / (1000 * 60 * 60 * 24 * 7)) * WEEK_WIDTH + 4;

        if (end) {
            const durationTime = end.getTime() - start.getTime();
            width = Math.max((durationTime / (1000 * 60 * 60 * 24 * 7)) * WEEK_WIDTH - 8, 40);
        }
    }

    const style: React.CSSProperties = isBacklog
        ? { position: 'relative', width: '100%' }
        : {
            position: 'absolute',
            left,
            width,
            top: (item as LayoutItem)._layout?.top ?? 8,
            height: (item as LayoutItem)._layout?.height ?? ITEM_HEIGHT
        };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item.id)}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`rounded-none bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-sm transition-all cursor-move flex items-center px-3 z-20 group overflow-hidden ${isDragging ? 'opacity-50 grayscale' : ''} ${isBacklog ? 'h-8 mb-0 shrink-0' : ''}`}
            style={style}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${item.type === 'NOTE' ? 'bg-zinc-300' : 'bg-zinc-900'} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
            <div className="flex items-center gap-2 w-full overflow-hidden pl-2">
                <span className="text-[10px] font-bold text-zinc-900 truncate flex-1 tracking-tight uppercase tracking-wider">{item.title}</span>

                <div className="flex items-center gap-2 shrink-0">
                    {(item.ownerIds && item.ownerIds.length > 0) && (
                        <div className="flex -space-x-1">
                            {item.ownerIds.slice(0, 2).map(uid => {
                                const u = users.find(user => user.id === uid);
                                if (!u) return null;
                                return (
                                    <div key={uid} className={`w-4 h-4 rounded-none ${u.color} border border-white flex items-center justify-center text-[7px] text-white font-bold grayscale shadow-sm`}>
                                        {u.initials}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChannelCreationModal: React.FC<{
    onClose: () => void;
    onSave: (name: string, tags: ChannelTag[]) => void;
}> = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [tags, setTags] = useState<ChannelTag[]>([]);

    const toggleTag = (tag: ChannelTag) => {
        setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[400px] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 p-6">
                <h3 className="text-lg font-bold mb-4 text-zinc-900">Add Distribution Channel</h3>
                <input
                    autoFocus
                    className="w-full border border-zinc-200 rounded p-2 mb-4 text-zinc-900 focus:outline-none focus:border-indigo-500"
                    placeholder="Channel Name (e.g. SEO)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && name && onSave(name, tags)}
                />
                <div className="flex gap-2 mb-6">
                    {['Inbound', 'Outbound'].map(t => (
                        <button
                            key={t}
                            onClick={() => toggleTag(t as ChannelTag)}
                            className={`px-3 py-1 rounded border text-xs font-bold transition-colors ${tags.includes(t as ChannelTag) ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900">Cancel</button>
                    <button onClick={() => onSave(name, tags)} disabled={!name} className="px-4 py-2 bg-zinc-900 text-white rounded text-xs font-bold disabled:opacity-50 hover:bg-zinc-800">Create</button>
                </div>
            </div>
        </div>
    );
};

const WeekContextModal: React.FC<{
    weekIndex: number;
    date: Date;
    tags: TimelineTag[];
    onClose: () => void;
    onSaveTag: (tag: Partial<TimelineTag>) => void;
    onDeleteTag: (id: string) => void;
}> = ({ weekIndex, date, tags, onClose, onSaveTag, onDeleteTag }) => {
    const [newTagLabel, setNewTagLabel] = useState('LAUNCH');
    const [newTagTitle, setNewTagTitle] = useState('');

    const handleAdd = () => {
        if (!newTagTitle) return;
        onSaveTag({ weekIndex, label: newTagLabel, title: newTagTitle, color: 'bg-indigo-500' });
        setNewTagTitle('');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[400px] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 p-6 text-zinc-900">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Week {weekIndex + 1} Context</h3>
                    <span className="text-xs text-zinc-400 font-mono">{date.toLocaleDateString()}</span>
                </div>

                <div className="space-y-2 mb-6">
                    {tags.map(tag => (
                        <div key={tag.id} className="flex items-center justify-between bg-zinc-50 p-2 rounded border border-zinc-100">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-600">{tag.label}</span>
                                <span className="text-sm font-medium">{tag.title}</span>
                            </div>
                            <button onClick={() => onDeleteTag(tag.id)} className="text-zinc-400 hover:text-red-500"><Icons.XCircle className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {tags.length === 0 && <p className="text-xs text-zinc-400 italic">No tags for this week.</p>}
                </div>

                <div className="border-t border-zinc-100 pt-4">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Add Marker</label>
                    <div className="flex gap-2 mb-2">
                        <select
                            className="bg-zinc-50 border border-zinc-200 rounded p-2 text-xs font-bold focus:outline-none"
                            value={newTagLabel}
                            onChange={e => setNewTagLabel(e.target.value)}
                        >
                            <option value="LAUNCH">LAUNCH</option>
                            <option value="THEME">THEME</option>
                            <option value="EVENT">EVENT</option>
                        </select>
                        <input
                            className="flex-1 bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                            placeholder="Title (e.g. Product Hunt)"
                            value={newTagTitle}
                            onChange={e => setNewTagTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                        <button onClick={handleAdd} disabled={!newTagTitle} className="p-2 bg-zinc-900 text-white rounded hover:bg-zinc-700 disabled:opacity-50"><Icons.Plus className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const RoadmapSandbox: React.FC<RoadmapSandboxProps> = ({ onNext, onBack }) => {
    const {
        campaign,
        addRoadmapItem,
        addChannel,
        deleteChannel,
        updateRoadmapItem,
        deleteRoadmapItem,
        deleteProject,
        addTimelineTag,
        deleteTimelineTag,
        users,
        toggleSampleData
    } = useStore();

    const [showChannelModal, setShowChannelModal] = useState(false);
    const [activeTicket, setActiveTicket] = useState<{ item: Partial<RoadmapItem> } | null>(null);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [activeDashboardChannel, setActiveDashboardChannel] = useState<string | null>(null);
    const [activeDashboardProject, setActiveDashboardProject] = useState<string | null>(null);
    const [activeWeekContext, setActiveWeekContext] = useState<number | null>(null);

    const weeks = useMemo(() => {
        const start = campaign?.startDate ? new Date(campaign.startDate) : new Date();
        const w = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + (i * 7));
            w.push(d);
        }
        return w;
    }, [campaign?.startDate]);

    const hasSampleData = !!campaign?.sampleData?.enabled;

    const channels = campaign?.channels || [];
    const projects = campaign?.projects || [];

    const handleSaveChannel = (name: string, tags: ChannelTag[]) => {
        addChannel({
            id: crypto.randomUUID(),
            name: name,
            campaignId: campaign?.id || '',
            tickets: [],
            principles: [],
            tags: tags,
            links: [],
            notes: []
        });
        setShowChannelModal(false);
    };

    const handleSaveTicket = (data: any) => {
        if (!activeTicket) return;

        const newItem: Partial<RoadmapItem> = {
            id: data.id,
            channelId: data.channelId || activeTicket.item.channelId,
            weekIndex: activeTicket.item.weekIndex,
            title: data.title,
            description: data.description,
            type: 'CONTENT',
            durationWeeks: data.durationWeeks,
            startDate: data.startDate,
            endDate: data.endDate,
            ownerIds: data.assigneeId ? [data.assigneeId] : [],
            priority: data.priority,
            projectId: data.projectId,
        };

        if (newItem.id) {
            updateRoadmapItem(newItem.id, newItem);
        } else {
            addRoadmapItem({
                id: crypto.randomUUID(),
                channelId: newItem.channelId,
                weekIndex: newItem.weekIndex!,
                title: newItem.title!,
                description: newItem.description || '',
                type: newItem.type || 'CONTENT',
                label: 'Ticket',
                durationWeeks: newItem.durationWeeks || 1,
                ownerIds: newItem.ownerIds || [],
                priority: newItem.priority || 'Medium',
                projectId: newItem.projectId,
                startDate: newItem.startDate,
                endDate: newItem.endDate,
            });
        }
        setActiveTicket(null);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDrop = (e: React.DragEvent, channelId: string | undefined, weekIndex: number, projectId?: string) => {
        e.preventDefault();
        if (!draggedItemId) return;

        const updates: Partial<RoadmapItem> = {
            weekIndex
        };

        if (channelId !== undefined) {
            updates.channelId = channelId;
        }

        if (projectId !== undefined) {
            updates.projectId = projectId;
            updates.channelId = undefined; // Dropping into a project-specific lane clears the channel
        }

        updateRoadmapItem(draggedItemId, updates);
        setDraggedItemId(null);
    };

    const handleSaveWeekTag = (tag: Partial<TimelineTag>) => {
        addTimelineTag({
            id: generateId(),
            weekIndex: tag.weekIndex!,
            label: tag.label || 'LAUNCH',
            title: tag.title || 'Marker',
            color: tag.color || 'bg-zinc-500'
        });
    };

    return (
        <div className="h-full w-full flex flex-col relative bg-white font-sans text-zinc-900 select-none">

            <div className="flex flex-1 overflow-hidden relative">

                {/* MAIN ROADMAP GRID */}
                <div className="flex-1 overflow-auto bg-white relative custom-scrollbar flex flex-col">

                    {/* TIMELINE HEADER */}
                    <div className="flex sticky top-0 z-40 bg-white min-w-max border-b border-zinc-100">
                        <div className="shrink-0 border-r border-zinc-100 bg-zinc-50 p-3 flex items-end pb-3 sticky left-0 z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" style={{ width: LEFT_PANEL_WIDTH }}>
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">Channels</span>
                                <button
                                    onClick={toggleSampleData}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-100 transition-colors w-fit"
                                >
                                    {hasSampleData ? 'Remove sample data' : 'Populate with data'}
                                </button>
                            </div>
                        </div>
                        <div className="flex">
                            {weeks.map((date, i) => {
                                const weekTags = (campaign?.timelineTags || []).filter(t => t.weekIndex === i);

                                return (
                                    <div
                                        key={i}
                                        className="shrink-0 border-r border-zinc-100 p-2 flex flex-col items-center bg-white group cursor-pointer relative hover:bg-zinc-50 transition-colors"
                                        style={{ width: WEEK_WIDTH }}
                                        onClick={() => setActiveWeekContext(i)}
                                    >
                                        <span className="text-[10px] text-zinc-400 font-mono uppercase mb-1">Week {i + 1}</span>
                                        <span className="text-xs text-zinc-700 font-semibold mb-2">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>

                                        <div className="flex flex-col gap-1 w-full px-2">
                                            {weekTags.map(tag => (
                                                <div key={tag.id} className={`text-[9px] font-bold text-white px-2 py-0.5 rounded-full flex items-center justify-center truncate shadow-sm ${tag.color}`}>
                                                    <span className="opacity-75 mr-1">{tag.label}:</span>
                                                    {tag.title}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-1 rounded bg-zinc-200 text-zinc-500 hover:text-zinc-900">
                                                <Icons.Plus className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* STRATEGY HORIZON (Projects) */}
                    <StrategyHorizon
                        projects={projects}
                        roadmapItems={campaign?.roadmapItems || []}
                        users={users}
                        campaignStart={campaign?.startDate ? new Date(campaign.startDate) : new Date()}
                        onProjectClick={setActiveDashboardProject}
                        onCardClick={(item) => setActiveTicket({ item })}
                        onDragStart={handleDragStart}
                        handleDrop={handleDrop}
                        draggedItemId={draggedItemId}
                        weekCount={weeks.length}
                        weeks={weeks}
                    />

                    {/* LANES CONTAINER */}
                    <div className="min-w-max pb-32">
                        {channels.map(channel => {
                            const channelItems = (campaign?.roadmapItems || []).filter(i => i.channelId === channel.id);
                            const campStart = campaign?.startDate ? new Date(campaign.startDate) : new Date();
                            const { layoutItems, rowHeight } = calculateLaneLayout(channelItems, campStart);

                            // Unscheduled items (weekIndex < 0)
                            const unscheduledItems = channelItems.filter(i => i.weekIndex < 0);

                            return (
                                <div key={channel.id} className="flex flex-col border-b border-zinc-100 relative bg-white group/lane">

                                    {/* Scheduled Row */}
                                    <div className="flex" style={{ minHeight: rowHeight }}>
                                        {/* LEFT SIDEBAR (Controls & Unassigned) */}
                                        <div className="shrink-0 border-r border-zinc-100 bg-zinc-50 p-4 flex flex-col sticky left-0 z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" style={{ width: LEFT_PANEL_WIDTH }}>

                                            <div
                                                className="flex flex-col mb-3 group/header cursor-pointer hover:bg-zinc-100 p-2 -m-2 rounded transition-colors"
                                                onClick={() => setActiveDashboardChannel(channel.id)}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="p-1 rounded bg-white border border-zinc-200 text-zinc-600 shadow-sm"><Icons.Zap className="w-3.5 h-3.5" /></div>
                                                    <span className="font-semibold text-sm text-zinc-800">{channel.name}</span>
                                                </div>

                                                <div className="flex gap-1.5 ml-8">
                                                    {channel.tags?.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className={`text-[9px] font-medium uppercase tracking-wider text-zinc-500`}
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* UNASSIGNED / BACKLOG ITEMS */}
                                            {unscheduledItems.length > 0 && (
                                                <div className="mt-4 border-t border-zinc-200/50 pt-3 flex-1">
                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-2 pl-1">Unassigned</div>
                                                    <div className="flex flex-col gap-2">
                                                        {unscheduledItems.map(item => (
                                                            <RoadmapCard
                                                                key={item.id}
                                                                item={item}
                                                                users={users}
                                                                projects={projects}
                                                                isDragging={draggedItemId === item.id}
                                                                onDragStart={handleDragStart}
                                                                onClick={() => setActiveTicket({ item })}
                                                                isBacklog={true}
                                                                campaignStart={campaign?.startDate ? new Date(campaign.startDate) : new Date()}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* RIGHT SIDE (Grid) */}
                                        <div className="flex relative">
                                            {weeks.map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="border-r border-zinc-100 h-full relative group/cell hover:bg-zinc-50 transition-colors"
                                                    style={{ width: WEEK_WIDTH }}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleDrop(e, channel.id, i, undefined)}
                                                    onClick={() => {
                                                        setActiveTicket({
                                                            item: { channelId: channel.id, weekIndex: i, title: '' }
                                                        })
                                                    }}
                                                >
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 pointer-events-none">
                                                        <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                            <Icons.Plus className="w-3 h-3" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Render Items */}
                                            {layoutItems.map(item => (
                                                <RoadmapCard
                                                    key={item.id}
                                                    item={item}
                                                    users={users}
                                                    projects={projects}
                                                    isDragging={draggedItemId === item.id}
                                                    onDragStart={handleDragStart}
                                                    onClick={() => setActiveTicket({ item })}
                                                    campaignStart={campaign?.startDate ? new Date(campaign.startDate) : new Date()}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}


                        {/* ADD CHANNEL BUTTON */}
                        <div className="p-4 bg-white sticky left-0 w-full border-t border-zinc-100 z-30">
                            <button
                                onClick={() => setShowChannelModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-xs font-bold uppercase tracking-wider"
                            >
                                <Icons.Plus className="w-4 h-4" />
                                Add Distribution Channel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION OVERLAY - Only if onNext/onBack provided (Wizard Mode) */}
            {(onNext || onBack) && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-2">
                    {onBack && (
                        <button onClick={onBack} className="px-6 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-full shadow-lg font-bold text-sm hover:bg-zinc-50 transition-all">
                            Back
                        </button>
                    )}
                    {onNext && (
                        <button onClick={onNext} className="px-8 py-2 bg-zinc-900 text-white rounded-full shadow-lg font-bold text-sm hover:bg-zinc-800 hover:scale-105 transition-all flex items-center gap-2">
                            Next Phase <Icons.ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* MODALS */}
            {showChannelModal && (
                <ChannelCreationModal
                    onClose={() => setShowChannelModal(false)}
                    onSave={handleSaveChannel}
                />
            )}

            {activeTicket && (
                <TicketModal
                    initialData={{
                        id: activeTicket.item.id,
                        title: activeTicket.item.title,
                        description: activeTicket.item.description,
                        priority: activeTicket.item.priority,
                        assigneeId: activeTicket.item.ownerIds?.[0],
                        channelId: activeTicket.item.channelId,
                        projectId: activeTicket.item.projectId,
                        durationWeeks: activeTicket.item.durationWeeks,
                        startDate: activeTicket.item.startDate,
                        endDate: activeTicket.item.endDate,
                    }}
                    context={{ channels, projects, users }}
                    onClose={() => setActiveTicket(null)}
                    onSave={handleSaveTicket}
                    onDelete={deleteRoadmapItem}
                />
            )}

            {activeWeekContext !== null && (
                <WeekContextModal
                    weekIndex={activeWeekContext}
                    date={weeks[activeWeekContext]}
                    tags={(campaign?.timelineTags || []).filter(t => t.weekIndex === activeWeekContext)}
                    onClose={() => setActiveWeekContext(null)}
                    onSaveTag={handleSaveWeekTag}
                    onDeleteTag={deleteTimelineTag}
                />
            )}

            {activeDashboardChannel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setActiveDashboardChannel(null)}></div>
                    <div className="w-[90vw] h-[85vh] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 overflow-hidden">
                        <ChannelDashboard
                            channelId={activeDashboardChannel}
                            isModal={true}
                            onClose={() => setActiveDashboardChannel(null)}
                            onDelete={() => { deleteChannel(activeDashboardChannel!); setActiveDashboardChannel(null); }}
                        />
                    </div>
                </div>
            )}

            {activeDashboardProject && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setActiveDashboardProject(null)}></div>
                    <div className="w-[90vw] h-[85vh] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 overflow-hidden">
                        <ProjectDashboard
                            projectId={activeDashboardProject}
                            isModal={true}
                            onClose={() => setActiveDashboardProject(null)}
                            onDelete={() => { deleteProject(activeDashboardProject!); setActiveDashboardProject(null); }}
                        />
                    </div>
                </div>
            )}

        </div>
    );
};
