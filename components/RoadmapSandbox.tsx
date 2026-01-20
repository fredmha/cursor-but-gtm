import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { RoadmapItem, User, OperatingPrinciple, Priority, Bet, Status, TicketStatus, ChannelTag, Project, TimelineTag } from '../types';
import { ProjectDashboard } from './ProjectDashboard';
import { ChannelDashboard } from './ChannelDashboard';
import { TicketModal } from './TicketModal';
import { BetCreationModal } from './BetCreationModal';

interface RoadmapSandboxProps {
  onNext?: () => void;
  onBack?: () => void;
}

const WEEK_WIDTH = 200;
const LEFT_PANEL_WIDTH = 280; 
const ITEM_HEIGHT = 32; // Compact height
const ITEM_GAP = 4;
const ROW_PADDING_TOP = 12;
const ROW_PADDING_BOTTOM = 12;
const MIN_ROW_HEIGHT = 120;

const CONTEXT_COLORS = [
    { label: 'Pink', value: 'bg-pink-500' },
    { label: 'Purple', value: 'bg-purple-500' },
    { label: 'Indigo', value: 'bg-indigo-500' },
    { label: 'Cyan', value: 'bg-cyan-500' },
    { label: 'Emerald', value: 'bg-emerald-500' },
    { label: 'Amber', value: 'bg-amber-500' },
    { label: 'Zinc', value: 'bg-zinc-500' },
];

// --- LAYOUT ENGINE ---

interface LayoutItem extends RoadmapItem {
  _layout: {
    top: number;
    height: number;
  };
}

const calculateLaneLayout = (items: RoadmapItem[]): { layoutItems: LayoutItem[], rowHeight: number } => {
  const sorted = [...items].sort((a, b) => {
    if (a.weekIndex !== b.weekIndex) return a.weekIndex - b.weekIndex;
    if (a.durationWeeks !== b.durationWeeks) return b.durationWeeks - a.durationWeeks; 
    return a.id.localeCompare(b.id);
  });

  const layoutItems: LayoutItem[] = [];
  const slots: LayoutItem[][] = []; 

  sorted.forEach(item => {
    let placed = false;
    let slotIndex = 0;

    const itemStart = item.weekIndex;
    const itemEnd = item.weekIndex + (item.durationWeeks || 1);

    while (!placed) {
      if (!slots[slotIndex]) {
        slots[slotIndex] = [];
      }

      const hasCollision = slots[slotIndex].some(existing => {
        const existingStart = existing.weekIndex;
        const existingEnd = existing.weekIndex + (existing.durationWeeks || 1);
        return itemStart < existingEnd && itemEnd > existingStart;
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


// --- COMPONENTS ---

// STRATEGY HORIZON COMPONENT
const StrategyHorizon: React.FC<{
    projects: Project[];
    users: User[];
    roadmapItems: RoadmapItem[];
    campaignStart: Date;
    onProjectClick: (projectId: string) => void;
    onTicketClick: (item: RoadmapItem) => void;
    weekCount: number;
}> = ({ projects, users, roadmapItems, campaignStart, onProjectClick, onTicketClick, weekCount }) => {
    
    return (
        <div className="min-w-max bg-background border-b border-border relative z-30">
            <div className="flex flex-col">
                <div className="shrink-0 border-b border-border bg-surface px-4 py-2">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <Icons.Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Strategy Horizon</span>
                    </div>
                </div>

                {projects.map(project => {
                    if (!project.startDate || !project.targetDate) return null;
                    
                    const projectItems = roadmapItems.filter(i => i.projectId === project.id);
                    const itemsByWeek: Record<number, RoadmapItem[]> = {};
                    projectItems.forEach(item => {
                        if (!itemsByWeek[item.weekIndex]) itemsByWeek[item.weekIndex] = [];
                        itemsByWeek[item.weekIndex].push(item);
                    });

                    const start = new Date(project.startDate);
                    const end = new Date(project.targetDate);
                    const campaignS = new Date(campaignStart);
                    
                    const diffTime = Math.abs(start.getTime() - campaignS.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    const startOffsetPixels = (diffDays / 7) * WEEK_WIDTH;
                    
                    const durationTime = Math.abs(end.getTime() - start.getTime());
                    const durationDays = Math.ceil(durationTime / (1000 * 60 * 60 * 24));
                    const widthPixels = Math.max((durationDays / 7) * WEEK_WIDTH, 50);

                    const colorClass = project.status === 'On Track' ? 'bg-emerald-500' : project.status === 'At Risk' ? 'bg-amber-500' : project.status === 'Off Track' ? 'bg-red-500' : 'bg-zinc-500';

                    return (
                        <div key={project.id} className="flex border-b border-border group/row hover:bg-surface transition-colors h-14">
                             {/* Project Header (Left) */}
                             <div className="shrink-0 border-r border-border bg-surface/50 p-3 flex flex-col justify-center" style={{ width: LEFT_PANEL_WIDTH }}>
                                 <div 
                                    onClick={() => onProjectClick(project.id)}
                                    className="flex items-center gap-2 cursor-pointer group"
                                 >
                                    <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                                    <span className="text-sm font-semibold text-zinc-700 group-hover:text-zinc-900 truncate">{project.name}</span>
                                 </div>
                             </div>

                             {/* Timeline (Right) */}
                             <div className="relative flex-1 bg-background overflow-visible">
                                 {/* Vertical Lines */}
                                 <div className="absolute inset-0 flex pointer-events-none">
                                     {Array.from({ length: weekCount }).map((_, i) => (
                                         <div key={i} className="border-r border-border/50 h-full" style={{ width: WEEK_WIDTH }}></div>
                                     ))}
                                 </div>

                                 {/* The Main Project Bar */}
                                 <div 
                                    onClick={() => onProjectClick(project.id)}
                                    className="absolute top-3 h-8 rounded-lg bg-surface border border-border hover:border-zinc-300 shadow-sm cursor-pointer group transition-all flex items-center px-3 gap-2 z-10 hover:z-20"
                                    style={{ left: startOffsetPixels, width: widthPixels }}
                                 >
                                     <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
                                     <div className="pl-1 overflow-hidden">
                                         <div className="text-[10px] font-bold text-zinc-600 truncate">{project.name}</div>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ContextSidebar: React.FC<{
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  groupedPrinciples: Record<string, OperatingPrinciple[]>;
}> = ({ isOpen, setIsOpen, groupedPrinciples }) => (
  <div className={`border-r border-border bg-surface flex flex-col transition-all duration-300 ${isOpen ? 'w-72' : 'w-12'} z-30 shrink-0`}>
    <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-surface">
      {isOpen && <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Strategy Context</span>}
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Toggle Sidebar">
        <Icons.Layout className="w-4 h-4" />
      </button>
    </div>
    {isOpen && (
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {Object.entries(groupedPrinciples).map(([cat, principles]) => (
          <div key={cat}>
            <h4 className="text-[10px] font-bold text-zinc-500 font-mono uppercase mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span> {cat}
            </h4>
            <div className="space-y-2">
              {(principles as OperatingPrinciple[]).map(p => (
                <div key={p.id} className="group relative bg-white border border-border rounded p-2 hover:shadow-sm transition-all">
                  <div className="text-xs font-medium text-zinc-700 mb-1">{p.title || "Untitled Principle"}</div>
                  <div className="text-[10px] text-zinc-500 leading-snug line-clamp-2 group-hover:line-clamp-none transition-all">
                    {p.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const RoadmapCard: React.FC<{
    item: LayoutItem;
    users: User[];
    projects: any[];
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onClick: () => void;
}> = ({ item, users, projects, isDragging, onDragStart, onClick }) => {
    const left = item.weekIndex * WEEK_WIDTH;
    const width = (item.durationWeeks || 1) * WEEK_WIDTH;
    const top = item._layout?.top ?? 8;
    const height = item._layout?.height ?? ITEM_HEIGHT;
    
    // RENDER: EXECUTION TASK (Bar)
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item.id)}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`absolute rounded-md bg-white border border-border hover:border-zinc-300 hover:shadow-sm transition-all cursor-move flex items-center px-2 shadow-sm z-20 group overflow-hidden ${isDragging ? 'opacity-50 ring-2 ring-indigo-500 scale-95' : ''}`}
            style={{ left: left + 4, width: width - 8, top, height }}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${item.type === 'NOTE' ? 'bg-pink-400' : 'bg-indigo-500'}`}></div>
            <div className="flex items-center gap-2 w-full overflow-hidden pl-2">
                 <span className="text-xs font-medium text-zinc-700 truncate flex-1">{item.title}</span>
                 
                 {/* Metadata Row (Inline) */}
                 <div className="flex items-center gap-2 shrink-0">
                    {(item.ownerIds && item.ownerIds.length > 0) && (
                        <div className="flex -space-x-1">
                            {item.ownerIds.slice(0, 2).map(uid => {
                                const u = users.find(user => user.id === uid);
                                if (!u) return null;
                                return (
                                    <div key={uid} className={`w-4 h-4 rounded-full ${u.color} border border-white flex items-center justify-center text-[6px] text-white ring-1 ring-white`}>
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
      <div className="w-[400px] bg-white border border-border rounded-xl shadow-2xl relative z-10 p-6">
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
        if(!newTagTitle) return;
        onSaveTag({ weekIndex, label: newTagLabel, title: newTagTitle, color: 'bg-indigo-500' });
        setNewTagTitle('');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[400px] bg-white border border-border rounded-xl shadow-2xl relative z-10 p-6 text-zinc-900">
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
                             <button onClick={() => onDeleteTag(tag.id)} className="text-zinc-400 hover:text-red-500"><Icons.XCircle className="w-4 h-4"/></button>
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
                        <button onClick={handleAdd} disabled={!newTagTitle} className="p-2 bg-zinc-900 text-white rounded hover:bg-zinc-700 disabled:opacity-50"><Icons.Plus className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const RoadmapSandbox: React.FC<RoadmapSandboxProps> = ({ onNext, onBack }) => {
  const { 
    campaign, 
    addBet,
    addRoadmapItem, 
    addChannel,
    updateChannel,
    deleteChannel,
    updateRoadmapItem,
    deleteRoadmapItem,
    deleteProject,
    addTimelineTag,
    deleteTimelineTag,
    currentUser,
    users
  } = useStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [activeBetCreation, setActiveBetCreation] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<{ item: Partial<RoadmapItem>, bets: Bet[] } | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [expandedBets, setExpandedBets] = useState<Record<string, boolean>>({});
  const [activeDashboardChannel, setActiveDashboardChannel] = useState<string | null>(null);
  const [activeDashboardProject, setActiveDashboardProject] = useState<string | null>(null);
  const [activeWeekContext, setActiveWeekContext] = useState<number | null>(null);

  // --- DATA ---
  const weeks = useMemo(() => {
    const start = campaign?.startDate ? new Date(campaign.startDate) : new Date();
    const w = [];
    for(let i=0; i<12; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + (i*7));
        w.push(d);
    }
    return w;
  }, [campaign?.startDate]);

  const groupedPrinciples = useMemo(() => {
    return (campaign?.principles || []).reduce((acc, p) => {
      const cat = p.category || 'GENERAL';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, OperatingPrinciple[]>);
  }, [campaign?.principles]);

  const channels = campaign?.channels || [];
  const projects = campaign?.projects || [];
  const allBets = useMemo(() => channels.flatMap(c => c.bets), [channels]);

  // --- ACTIONS ---
  
  const handleSaveChannel = (name: string, tags: ChannelTag[]) => {
      addChannel({
          id: crypto.randomUUID(),
          name: name,
          campaignId: campaign?.id || '',
          bets: [],
          principles: [],
          tags: tags,
          links: [],
          notes: []
      });
      setShowChannelModal(false);
  };

  const handleDeleteBet = (channelId: string, betId: string) => {
      if (!confirm('Are you sure you want to delete this bet?')) return;
      const channel = channels.find(c => c.id === channelId);
      if (!channel) return;
      const newBets = channel.bets.filter(b => b.id !== betId);
      updateChannel(channelId, { bets: newBets });
  };

  const handleSaveBet = (betData: Partial<Bet>) => {
      if (!activeBetCreation) return;
      addBet(activeBetCreation, {
          id: crypto.randomUUID(),
          description: betData.description!,
          hypothesis: betData.hypothesis || '',
          successCriteria: betData.successCriteria || 'TBD',
          status: Status.Active,
          channelId: activeBetCreation,
          projectId: betData.projectId, // Link to project
          tickets: [],
          ownerId: currentUser.id,
          timeboxWeeks: 2,
          startDate: new Date().toISOString()
      });
      setActiveBetCreation(null);
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
          ownerIds: data.assigneeId ? [data.assigneeId] : [],
          priority: data.priority,
          linkedBetId: data.betId,
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
              linkedBetId: newItem.linkedBetId,
              projectId: newItem.projectId,
          });
      }
      setActiveTicket(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedItemId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, channelId: string, weekIndex: number) => {
      e.preventDefault();
      if (!draggedItemId) return;
      
      const updates: Partial<RoadmapItem> = {
          channelId,
          weekIndex
      };
      updateRoadmapItem(draggedItemId, updates);
      setDraggedItemId(null);
  };

  const toggleBet = (id: string) => {
      setExpandedBets(prev => ({...prev, [id]: !prev[id]}));
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
    <div className="h-full w-full flex flex-col relative bg-background font-sans text-primary select-none">
      
      <div className="flex flex-1 overflow-hidden relative">
         
         <ContextSidebar 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
            groupedPrinciples={groupedPrinciples} 
         />

         {/* MAIN ROADMAP GRID */}
         <div className="flex-1 overflow-auto bg-background relative custom-scrollbar flex flex-col">
             
             {/* TIMELINE HEADER */}
             <div className="flex sticky top-0 z-40 bg-background min-w-max border-b border-border">
                 <div className="shrink-0 border-r border-border bg-surface p-3 flex items-end pb-3" style={{ width: LEFT_PANEL_WIDTH }}>
                     <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">Channels</span>
                 </div>
                 <div className="flex">
                     {weeks.map((date, i) => {
                         const weekTags = (campaign?.timelineTags || []).filter(t => t.weekIndex === i);
                         
                         return (
                            <div 
                                key={i} 
                                className="shrink-0 border-r border-border p-2 flex flex-col items-center bg-background group cursor-pointer relative hover:bg-surface transition-colors" 
                                style={{ width: WEEK_WIDTH }}
                                onClick={() => setActiveWeekContext(i)}
                            >
                                <span className="text-[10px] text-zinc-400 font-mono uppercase mb-1">Week {i+1}</span>
                                <span className="text-xs text-zinc-700 font-semibold mb-2">{date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                
                                {/* Tags Stack */}
                                <div className="flex flex-col gap-1 w-full px-2">
                                    {weekTags.map(tag => (
                                        <div key={tag.id} className={`text-[9px] font-bold text-white px-2 py-0.5 rounded-full flex items-center justify-center truncate shadow-sm ${tag.color}`}>
                                            <span className="opacity-75 mr-1">{tag.label}:</span>
                                            {tag.title}
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Hover Add Button */}
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
                onTicketClick={(item) => setActiveTicket({ item, bets: allBets })}
                weekCount={weeks.length}
             />

             {/* LANES CONTAINER */}
             <div className="min-w-max pb-32">
                 {channels.map(channel => {
                     const laneItems = (campaign?.roadmapItems || []).filter(i => i.channelId === channel.id);
                     const bets = channel.bets.filter(b => b.status !== Status.Killed);
                     const { layoutItems, rowHeight } = calculateLaneLayout(laneItems);

                     return (
                         <div key={channel.id} className="flex border-b border-border relative bg-background group/lane" style={{ height: rowHeight }}>
                             
                             {/* LEFT SIDEBAR (Controls) */}
                             <div className="shrink-0 border-r border-border bg-surface p-4 flex flex-col" style={{ width: LEFT_PANEL_WIDTH, minHeight: rowHeight }}>
                                 
                                <div 
                                    className="flex flex-col mb-3 group/header cursor-pointer hover:bg-zinc-100 p-2 -m-2 rounded transition-colors"
                                    onClick={() => setActiveDashboardChannel(channel.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded bg-white border border-border text-zinc-600 shadow-sm"><Icons.Zap className="w-3.5 h-3.5" /></div>
                                        <span className="font-semibold text-sm text-zinc-800">{channel.name}</span>
                                        {bets.length > 0 && <span className="text-[10px] text-zinc-400 font-mono ml-2">{bets.length} Bets</span>}
                                    </div>
                                    
                                    {/* TAGS DISPLAY */}
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

                                 {/* Bet Stack */}
                                 <div className="flex-1 space-y-2 mb-3">
                                     {bets.length === 0 && (
                                         <button 
                                            onClick={() => setActiveBetCreation(channel.id)}
                                            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 pl-8"
                                         >
                                            + Add Bet
                                         </button>
                                     )}
                                     
                                     {bets.length > 0 && (
                                          <button 
                                            onClick={() => setActiveBetCreation(channel.id)}
                                            className="w-full py-1.5 border border-dashed border-zinc-200 text-[10px] text-zinc-400 hover:text-zinc-600 rounded hover:bg-white transition-colors uppercase font-bold mb-2"
                                          >
                                            + Add Bet
                                          </button>
                                     )}

                                     {bets.map(bet => {
                                         const isExpanded = expandedBets[bet.id];
                                         return (
                                             <div key={bet.id} className={`group/bet rounded transition-all ${isExpanded ? 'bg-white border border-border shadow-sm' : 'hover:bg-zinc-100'}`}>
                                                 <div 
                                                    onClick={() => toggleBet(bet.id)}
                                                    className="p-2 cursor-pointer flex items-center gap-2"
                                                 >
                                                     <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${bet.status === Status.Active ? 'bg-emerald-500' : 'bg-zinc-300'}`}></div>
                                                     <div className="flex-1 min-w-0">
                                                         <div className="text-xs font-medium text-zinc-600 leading-snug truncate">{bet.description}</div>
                                                     </div>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             </div>

                             {/* RIGHT SIDE (Grid) */}
                             <div className="flex relative">
                                 {weeks.map((_, i) => (
                                     <div 
                                         key={i} 
                                         className="border-r border-border/50 h-full relative group/cell hover:bg-surface transition-colors"
                                         style={{ width: WEEK_WIDTH }}
                                         onDragOver={(e) => e.preventDefault()}
                                         onDrop={(e) => handleDrop(e, channel.id, i)}
                                         onClick={() => {
                                             if (bets.length === 0) {
                                                 setActiveBetCreation(channel.id);
                                                 return;
                                             }
                                             const defaultBetId = bets.length > 0 ? bets[0].id : undefined;
                                             // If default bet has a project, inherit it
                                             const bet = bets.find(b => b.id === defaultBetId);
                                             setActiveTicket({ 
                                                 item: { channelId: channel.id, weekIndex: i, title: '', linkedBetId: defaultBetId, projectId: bet?.projectId }, 
                                                 bets: bets 
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
                                         onClick={() => setActiveTicket({ item, bets })}
                                     />
                                 ))}
                             </div>
                         </div>
                     );
                 })}

                 {/* ADD CHANNEL BUTTON */}
                 <div className="p-4 bg-background sticky left-0 w-full border-t border-border">
                     <button 
                        onClick={() => setShowChannelModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 hover:bg-surface transition-all text-xs font-bold uppercase tracking-wider"
                     >
                         <Icons.Plus className="w-4 h-4" />
                         Add Distribution Channel
                     </button>
                 </div>
             </div>
         </div>
      </div>
      
      {/* MODALS */}
      {showChannelModal && (
          <ChannelCreationModal 
             onClose={() => setShowChannelModal(false)} 
             onSave={handleSaveChannel} 
          />
      )}

      {activeBetCreation && (
          <BetCreationModal 
              channelId={activeBetCreation}
              onClose={() => setActiveBetCreation(null)}
              onSave={handleSaveBet}
              projects={projects}
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
                  betId: activeTicket.item.linkedBetId,
                  projectId: activeTicket.item.projectId,
                  durationWeeks: activeTicket.item.durationWeeks,
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
      
      {/* CHANNEL DASHBOARD MODAL */}
      {activeDashboardChannel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setActiveDashboardChannel(null)}></div>
            <div className="w-[90vw] h-[85vh] bg-white border border-border rounded-xl shadow-2xl relative z-10 overflow-hidden">
                <ChannelDashboard 
                    channelId={activeDashboardChannel} 
                    isModal={true}
                    onClose={() => setActiveDashboardChannel(null)}
                    onDelete={() => { deleteChannel(activeDashboardChannel!); setActiveDashboardChannel(null); }}
                />
            </div>
        </div>
      )}

      {/* PROJECT DASHBOARD MODAL */}
      {activeDashboardProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setActiveDashboardProject(null)}></div>
            <div className="w-[90vw] h-[85vh] bg-white border border-border rounded-xl shadow-2xl relative z-10 overflow-hidden">
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