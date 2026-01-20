
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
const LEFT_PANEL_WIDTH = 340; 
const ITEM_HEIGHT = 34; // Compact height for stacking
const ITEM_GAP = 4;
const ROW_PADDING_TOP = 12;
const ROW_PADDING_BOTTOM = 12;
const MIN_ROW_HEIGHT = 160;

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
  // 1. Sort: Earlier start first, then longer duration, then ID
  const sorted = [...items].sort((a, b) => {
    if (a.weekIndex !== b.weekIndex) return a.weekIndex - b.weekIndex;
    if (a.durationWeeks !== b.durationWeeks) return b.durationWeeks - a.durationWeeks; // Longest first
    return a.id.localeCompare(b.id);
  });

  const layoutItems: LayoutItem[] = [];
  const slots: LayoutItem[][] = []; // slots[y] = array of items in that vertical slot

  sorted.forEach(item => {
    let placed = false;
    let slotIndex = 0;

    const itemStart = item.weekIndex;
    const itemEnd = item.weekIndex + (item.durationWeeks || 1);

    while (!placed) {
      if (!slots[slotIndex]) {
        slots[slotIndex] = [];
      }

      // Check collision in this slot
      const hasCollision = slots[slotIndex].some(existing => {
        const existingStart = existing.weekIndex;
        const existingEnd = existing.weekIndex + (existing.durationWeeks || 1);
        // Collision if intervals overlap: startA < endB && endA > startB
        return itemStart < existingEnd && itemEnd > existingStart;
      });

      if (!hasCollision) {
        // Place here
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
  // Calculate total height needed
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
        <div className="min-w-max bg-[#09090b] border-b border-zinc-800 relative z-30 shadow-xl">
            <div className="flex flex-col">
                <div className="shrink-0 border-b border-zinc-800 bg-[#09090b] px-3 py-2">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Icons.Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Strategy Horizon</span>
                    </div>
                </div>

                {projects.map(project => {
                    if (!project.startDate || !project.targetDate) return null;
                    
                    // Show ALL tickets linked to this project, even if they belong to a channel
                    const projectItems = roadmapItems.filter(i => i.projectId === project.id);
                    
                    // Group Items by Week Index for clustered rendering
                    const itemsByWeek: Record<number, RoadmapItem[]> = {};
                    projectItems.forEach(item => {
                        if (!itemsByWeek[item.weekIndex]) itemsByWeek[item.weekIndex] = [];
                        itemsByWeek[item.weekIndex].push(item);
                    });

                    const start = new Date(project.startDate);
                    const end = new Date(project.targetDate);
                    const campaignS = new Date(campaignStart);
                    
                    // Calculate Position for Project Bar
                    const diffTime = Math.abs(start.getTime() - campaignS.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    const startOffsetPixels = (diffDays / 7) * WEEK_WIDTH;
                    
                    const durationTime = Math.abs(end.getTime() - start.getTime());
                    const durationDays = Math.ceil(durationTime / (1000 * 60 * 60 * 24));
                    const widthPixels = Math.max((durationDays / 7) * WEEK_WIDTH, 50);

                    const lead = users.find(u => u.id === project.ownerId);
                    const colorClass = project.status === 'On Track' ? 'bg-emerald-500' : project.status === 'At Risk' ? 'bg-amber-500' : project.status === 'Off Track' ? 'bg-red-500' : 'bg-zinc-500';

                    // Fixed Height Row to prevent bloat
                    return (
                        <div key={project.id} className="flex border-b border-zinc-800/50 group/row hover:bg-zinc-900/20 transition-colors h-16">
                             {/* Project Header (Left) */}
                             <div className="shrink-0 border-r border-zinc-800 bg-zinc-900/10 p-3 flex flex-col justify-center" style={{ width: LEFT_PANEL_WIDTH }}>
                                 <div 
                                    onClick={() => onProjectClick(project.id)}
                                    className="flex items-center gap-2 cursor-pointer group"
                                 >
                                    <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                                    <span className="text-sm font-bold text-zinc-300 group-hover:text-white truncate">{project.name}</span>
                                    <Icons.ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-white opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                 </div>
                                 <div className="mt-1 pl-4 flex gap-4">
                                    <div className="text-[9px] text-zinc-500 font-mono">Lead: {lead?.initials || '--'}</div>
                                    <div className="text-[9px] text-zinc-500 font-mono">{projectItems.length} tasks</div>
                                 </div>
                             </div>

                             {/* Timeline (Right) */}
                             <div className="relative flex-1 bg-zinc-900/5 overflow-visible">
                                 {/* Vertical Lines */}
                                 <div className="absolute inset-0 flex pointer-events-none">
                                     {Array.from({ length: weekCount }).map((_, i) => (
                                         <div key={i} className="border-r border-white/5 h-full" style={{ width: WEEK_WIDTH }}></div>
                                     ))}
                                 </div>

                                 {/* The Main Project Bar */}
                                 <div 
                                    onClick={() => onProjectClick(project.id)}
                                    className="absolute top-2 h-6 rounded bg-zinc-800 border border-zinc-700 hover:border-zinc-500 shadow-sm cursor-pointer group transition-all flex items-center px-2 gap-2 z-10 hover:z-20"
                                    style={{ left: startOffsetPixels, width: widthPixels }}
                                 >
                                     <div className={`w-1 h-full absolute left-0 top-0 bottom-0 rounded-l ${colorClass}`}></div>
                                     <div className="pl-1 overflow-hidden">
                                         <div className="text-[9px] font-bold text-white truncate">{project.name}</div>
                                     </div>
                                 </div>

                                 {/* Compact Ticket Indicators (Squares) */}
                                 {Object.entries(itemsByWeek).map(([weekIndexStr, items]) => {
                                     const weekIndex = parseInt(weekIndexStr);
                                     const left = (weekIndex * WEEK_WIDTH) + 12; // Slight padding from grid line
                                     
                                     return (
                                         <div key={weekIndex} className="absolute top-9 flex gap-1.5 flex-wrap z-20 max-w-[180px]" style={{ left }}>
                                             {items.map(item => (
                                                 <div 
                                                    key={item.id}
                                                    onClick={(e) => { e.stopPropagation(); onTicketClick(item); }}
                                                    className="group/marker relative"
                                                 >
                                                     <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all hover:scale-110 shadow-sm ${item.status === Status.Completed ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:bg-zinc-700 hover:text-indigo-400 hover:border-indigo-500'}`}>
                                                         {item.status === Status.Completed ? (
                                                             <Icons.CheckCircle className="w-3 h-3" />
                                                         ) : (
                                                             <Icons.FileText className="w-3 h-3" />
                                                         )}
                                                     </div>
                                                     
                                                     {/* Tooltip */}
                                                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/marker:block z-50">
                                                         <div className="bg-zinc-950 text-white text-[10px] px-2 py-1.5 rounded border border-zinc-800 shadow-xl whitespace-nowrap min-w-[120px]">
                                                             <div className="font-bold mb-0.5">{item.title}</div>
                                                             <div className="flex items-center justify-between text-zinc-500 text-[9px] uppercase tracking-wider">
                                                                 <span>{item.status}</span>
                                                                 {item.priority !== 'None' && <span className={item.priority === 'Urgent' ? 'text-red-500' : ''}>{item.priority}</span>}
                                                             </div>
                                                         </div>
                                                         {/* Arrow */}
                                                         <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-800 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     );
                                 })}
                             </div>
                        </div>
                    );
                })}

                {projects.length === 0 && (
                     <div className="p-8 text-center text-zinc-600 text-xs italic bg-zinc-900/10">
                         No active projects. Create a project to see the Strategy Horizon.
                     </div>
                )}
            </div>
        </div>
    );
};

const ContextSidebar: React.FC<{
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  groupedPrinciples: Record<string, OperatingPrinciple[]>;
}> = ({ isOpen, setIsOpen, groupedPrinciples }) => (
  <div className={`border-r border-white/5 bg-[#09090b] flex flex-col transition-all duration-300 ${isOpen ? 'w-72' : 'w-12'} z-30 shrink-0`}>
    <div className="h-10 border-b border-white/5 flex items-center justify-between px-3 bg-zinc-900/20">
      {isOpen && <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Strategy Context</span>}
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 text-zinc-500 hover:text-white transition-colors" title="Toggle Sidebar">
        <Icons.Layout className="w-4 h-4" />
      </button>
    </div>
    {isOpen && (
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {Object.keys(groupedPrinciples).length === 0 && (
            <div className="text-zinc-600 text-[10px] italic">No principles defined.</div>
        )}
        {Object.entries(groupedPrinciples).map(([cat, principles]) => (
          <div key={cat}>
            <h4 className="text-[10px] font-bold text-pink-500 font-mono uppercase mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> {cat}
            </h4>
            <div className="space-y-2">
              {(principles as OperatingPrinciple[]).map(p => (
                <div key={p.id} className="group relative bg-zinc-900/50 border border-white/5 rounded p-2 hover:border-zinc-700 transition-colors">
                  <div className="text-xs font-medium text-zinc-300 mb-1">{p.title || "Untitled Principle"}</div>
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

const NorthStarHeader: React.FC<{
  campaignName?: string;
  objective?: string;
  onBack?: () => void;
  onNext?: () => void;
}> = ({ campaignName, objective, onBack, onNext }) => (
  <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#09090b]/90 backdrop-blur-xl z-40 shrink-0 sticky top-0">
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
        <Icons.Target className="w-4 h-4 text-indigo-400" />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5">North Star Objective</div>
        <div className="text-sm font-bold text-white leading-none truncate max-w-xl" title={objective}>{objective}</div>
      </div>
    </div>
    <div className="flex items-center gap-6">
      <div className="text-right hidden md:block">
        <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5">Execution Cycle</div>
        <div className="text-xs font-bold text-zinc-300">{campaignName}</div>
      </div>
      {onNext && onBack && (
        <>
            <div className="h-6 w-px bg-zinc-800 hidden md:block"></div>
            <div className="flex gap-2">
                <button onClick={onBack} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors">Back</button>
                <button onClick={onNext} className="px-4 py-1.5 text-xs font-bold text-black bg-white hover:bg-zinc-200 rounded transition-colors flex items-center gap-2 shadow-lg shadow-white/5">
                Next Step <Icons.ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </>
      )}
    </div>
  </header>
);

// --- MODALS ---

const WeekContextModal: React.FC<{
  weekIndex: number;
  date: Date;
  tags: TimelineTag[];
  onClose: () => void;
  onSaveTag: (tag: Partial<TimelineTag>) => void;
  onDeleteTag: (id: string) => void;
}> = ({ weekIndex, date, tags, onClose, onSaveTag, onDeleteTag }) => {
    const [newTag, setNewTag] = useState<{label: string, title: string, color: string}>({
        label: 'LAUNCH',
        title: '',
        color: 'bg-pink-500'
    });

    const handleAdd = () => {
        if (!newTag.title) return;
        onSaveTag({
            weekIndex,
            label: newTag.label,
            title: newTag.title,
            color: newTag.color
        });
        setNewTag(prev => ({ ...prev, title: '' }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[400px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 p-5">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Week {weekIndex + 1} Context</h3>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{date.toLocaleDateString(undefined, {weekday: 'long', month:'long', day:'numeric'})}</p>
                    </div>
                    <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
                </div>

                {/* Existing Tags */}
                <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto">
                    {tags.length === 0 && <p className="text-xs text-zinc-600 italic text-center py-2">No tags defined for this week.</p>}
                    {tags.map(tag => (
                        <div key={tag.id} className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded ${tag.color}`}>{tag.label}</span>
                                <span className="text-xs text-zinc-300 font-medium">{tag.title}</span>
                            </div>
                            <button onClick={() => onDeleteTag(tag.id)} className="text-zinc-600 hover:text-red-500"><Icons.XCircle className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>

                {/* Add New Tag */}
                <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 space-y-3">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Add New Marker</h4>
                    <div className="flex gap-2">
                        <select 
                            className="bg-zinc-950 border border-zinc-800 rounded text-xs text-white p-2 focus:outline-none"
                            value={newTag.label}
                            onChange={e => setNewTag({...newTag, label: e.target.value})}
                        >
                            <option value="LAUNCH">🚀 Launch</option>
                            <option value="THEME">🎨 Theme</option>
                            <option value="EVENT">📅 Event</option>
                        </select>
                        <input 
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white p-2 focus:outline-none"
                            placeholder="Marker Title..."
                            value={newTag.title}
                            onChange={e => setNewTag({...newTag, title: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-zinc-600 uppercase font-bold">Color:</span>
                        {CONTEXT_COLORS.map(c => (
                            <button 
                                key={c.value}
                                onClick={() => setNewTag({...newTag, color: c.value})}
                                className={`w-4 h-4 rounded-full ${c.value} transition-transform ${newTag.color === c.value ? 'scale-125 ring-1 ring-white' : 'opacity-50 hover:opacity-100'}`}
                            />
                        ))}
                        <button 
                            onClick={handleAdd}
                            disabled={!newTag.title}
                            className="ml-auto px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
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
    if (tags.includes(tag)) setTags(tags.filter(t => t !== tag));
    else setTags([...tags, tag]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="absolute inset-0" onClick={onClose}></div>
       <div className="w-[450px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 p-6">
          <h3 className="text-lg font-bold text-white mb-2">Add Distribution Channel</h3>
          <p className="text-xs text-zinc-500 mb-6">Create a row for a specific channel (e.g. SEO, Social, Email) or function.</p>
          
          <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5 block">Channel Name</label>
          <input 
            autoFocus
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white mb-4 focus:border-indigo-500 focus:outline-none placeholder-zinc-700"
            placeholder="e.g. LinkedIn, Blog, Outbound"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name && onSave(name, tags)}
          />

          <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5 block">Tags</label>
          <div className="flex gap-2 mb-6">
            <button 
                onClick={() => toggleTag('Inbound')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                    tags.includes('Inbound') 
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                    : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                }`}
            >
                Inbound
            </button>
            <button 
                onClick={() => toggleTag('Outbound')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                    tags.includes('Outbound') 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                    : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                }`}
            >
                Outbound
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-4">
             <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">Cancel</button>
             <button 
                onClick={() => onSave(name, tags)} 
                disabled={!name} 
                className="px-6 py-2 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 disabled:opacity-50"
             >
                Create Channel
             </button>
          </div>
       </div>
    </div>
  );
};

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
    
    const priority = PRIORITIES.find(p => p.value === item.priority);
    const linkedProject = projects.find(p => p.id === item.projectId);

    // RENDER: EXECUTION TASK (Bar)
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item.id)}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`absolute rounded-md bg-zinc-800 border border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-700 hover:shadow-xl transition-all cursor-move flex items-center px-2 shadow-md z-20 group overflow-hidden ${isDragging ? 'opacity-50 ring-2 ring-indigo-500 scale-95' : ''}`}
            style={{ left: left + 4, width: width - 8, top, height }}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${item.type === 'NOTE' ? 'bg-pink-500' : 'bg-indigo-500'}`}></div>
            <div className="flex items-center gap-2 w-full overflow-hidden pl-2">
                 <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">{item.linkedBetId ? 'TICKET' : 'NOTE'}</span>
                 <span className="text-xs font-semibold text-zinc-200 truncate flex-1">{item.title}</span>
                 
                 {/* Metadata Row (Inline) */}
                 <div className="flex items-center gap-2 shrink-0">
                    {linkedProject && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" title={linkedProject.name}></div>
                    )}
                    {(item.ownerIds && item.ownerIds.length > 0) && (
                        <div className="flex -space-x-1">
                            {item.ownerIds.slice(0, 2).map(uid => {
                                const u = users.find(user => user.id === uid);
                                if (!u) return null;
                                return (
                                    <div key={uid} className={`w-4 h-4 rounded-full ${u.color} border border-zinc-800 flex items-center justify-center text-[6px] text-white ring-1 ring-[#09090b]`}>
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

// --- MAIN COMPONENT ---

export const RoadmapSandbox: React.FC<RoadmapSandboxProps> = ({ onNext, onBack }) => {
  const { 
    campaign, 
    addBet,
    addRoadmapItem, 
    addChannel,
    updateChannel,
    updateRoadmapItem,
    deleteRoadmapItem,
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
          channelId: data.channelId || activeTicket.item.channelId, // Keep original channel if not changed, or update
          weekIndex: activeTicket.item.weekIndex, // Preserve week
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
    <div className="h-full w-full flex flex-col relative bg-[#09090b] font-sans text-zinc-100 select-none">
      
      <NorthStarHeader 
         campaignName={campaign?.name} 
         objective={campaign?.objective} 
         onBack={onBack} 
         onNext={onNext}
      />

      <div className="flex flex-1 overflow-hidden relative">
         
         <ContextSidebar 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
            groupedPrinciples={groupedPrinciples} 
         />

         {/* MAIN ROADMAP GRID */}
         <div className="flex-1 overflow-auto bg-[#09090b] relative custom-scrollbar flex flex-col">
             
             {/* TIMELINE HEADER */}
             <div className="flex sticky top-0 z-40 bg-[#09090b] min-w-max border-b border-white/5 shadow-md shadow-black/50">
                 <div className="shrink-0 border-r border-white/5 bg-[#09090b] p-3 flex items-end pb-3" style={{ width: LEFT_PANEL_WIDTH }}>
                     <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Channels & Strategy</span>
                 </div>
                 <div className="flex">
                     {weeks.map((date, i) => {
                         const weekTags = (campaign?.timelineTags || []).filter(t => t.weekIndex === i);
                         
                         return (
                            <div 
                                key={i} 
                                className="shrink-0 border-r border-white/5 p-2 flex flex-col items-center bg-[#09090b] group cursor-pointer relative hover:bg-zinc-900/50 transition-colors" 
                                style={{ width: WEEK_WIDTH }}
                                onClick={() => setActiveWeekContext(i)}
                            >
                                <span className="text-[10px] text-zinc-600 font-mono uppercase mb-1">Week {i+1}</span>
                                <span className="text-xs text-zinc-400 font-bold mb-2">{date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                
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
                                    <div className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700">
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
                     // Filter items for this channel
                     const laneItems = (campaign?.roadmapItems || []).filter(i => i.channelId === channel.id);
                     const bets = channel.bets.filter(b => b.status !== Status.Killed);
                     
                     // Calculate Vertical Layout
                     const { layoutItems, rowHeight } = calculateLaneLayout(laneItems);

                     return (
                         <div key={channel.id} className="flex border-b border-white/5 relative bg-[#09090b] group/lane" style={{ height: rowHeight }}>
                             
                             {/* LEFT SIDEBAR (Controls) */}
                             <div className="shrink-0 border-r border-white/5 bg-zinc-900/10 p-4 flex flex-col" style={{ width: LEFT_PANEL_WIDTH, minHeight: rowHeight }}>
                                 
                                <div 
                                    className="flex flex-col mb-3 group/header cursor-pointer hover:bg-white/5 p-2 -m-2 rounded transition-colors"
                                    onClick={() => setActiveDashboardChannel(channel.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded bg-indigo-500/10 text-indigo-400"><Icons.Zap className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-sm text-zinc-200">{channel.name}</span>
                                        {bets.length > 0 && <span className="text-[10px] text-zinc-600 font-mono ml-2">{bets.length} Bets</span>}
                                        <Icons.Layout className="w-3 h-3 text-zinc-600 ml-auto opacity-0 group-hover/header:opacity-100" />
                                    </div>
                                    
                                    {/* TAGS DISPLAY */}
                                    <div className="flex gap-1.5 ml-7">
                                        {channel.tags?.map(tag => (
                                            <span 
                                                key={tag} 
                                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                    tag === 'Inbound' 
                                                    ? 'bg-cyan-500/10 text-cyan-500' 
                                                    : 'bg-orange-500/10 text-orange-500'
                                                }`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                 {/* Bet Stack */}
                                 <div className="flex-1 space-y-2 mb-3">
                                     {bets.length === 0 && (
                                         <div className="p-3 border border-dashed border-zinc-800 rounded bg-zinc-900/30 text-center">
                                             <span className="text-[10px] text-zinc-500 block mb-2">No active strategy.</span>
                                             <button 
                                                onClick={() => setActiveBetCreation(channel.id)}
                                                className="text-[10px] font-bold text-indigo-400 hover:underline"
                                             >
                                                + Add Strategy Bet
                                             </button>
                                         </div>
                                     )}
                                     
                                     {bets.length > 0 && (
                                          <button 
                                            onClick={() => setActiveBetCreation(channel.id)}
                                            className="w-full py-1.5 border border-dashed border-zinc-800 text-[10px] text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors uppercase font-bold"
                                          >
                                            + Add Bet
                                          </button>
                                     )}

                                     {bets.map(bet => {
                                         const isExpanded = expandedBets[bet.id];
                                         const completedTickets = bet.tickets.filter(t => t.status === TicketStatus.Done).length;
                                         
                                         return (
                                             <div key={bet.id} className={`group/bet border rounded transition-all ${isExpanded ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'}`}>
                                                 <div 
                                                    onClick={() => toggleBet(bet.id)}
                                                    className="p-2.5 cursor-pointer flex items-start gap-2"
                                                 >
                                                     <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${bet.status === Status.Active ? 'bg-emerald-500' : 'bg-zinc-600'}`}></div>
                                                     <div className="flex-1 min-w-0">
                                                         <div className="text-xs font-medium text-zinc-300 leading-snug truncate">{bet.description}</div>
                                                         <div className="flex items-center gap-2 mt-1">
                                                             <span className="text-[9px] text-zinc-600 font-mono">{completedTickets}/{bet.tickets.length} Tasks</span>
                                                         </div>
                                                     </div>
                                                     <div className="opacity-0 group-hover/bet:opacity-100 transition-opacity">
                                                         <button onClick={(e) => { e.stopPropagation(); handleDeleteBet(channel.id, bet.id); }} className="text-zinc-600 hover:text-red-500 p-1">
                                                             <Icons.Trash className="w-3 h-3" />
                                                         </button>
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
                                         className="border-r border-white/5 h-full relative group/cell hover:bg-white/[0.02] transition-colors"
                                         style={{ width: WEEK_WIDTH }}
                                         onDragOver={(e) => e.preventDefault()}
                                         onDrop={(e) => handleDrop(e, channel.id, i)}
                                         onClick={() => {
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
                                             <div className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
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
                 <div className="p-4 bg-[#09090b] sticky left-0 w-full border-t border-white/5">
                     <button 
                        onClick={() => setShowChannelModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900 transition-all text-xs font-bold uppercase tracking-wider"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setActiveDashboardChannel(null)}></div>
            <div className="w-[90vw] h-[85vh] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 overflow-hidden">
                <ChannelDashboard 
                    channelId={activeDashboardChannel} 
                    isModal={true}
                    onClose={() => setActiveDashboardChannel(null)}
                />
            </div>
        </div>
      )}

      {/* PROJECT DASHBOARD MODAL */}
      {activeDashboardProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setActiveDashboardProject(null)}></div>
            <div className="w-[90vw] h-[85vh] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 overflow-hidden">
                <ProjectDashboard 
                    projectId={activeDashboardProject} 
                    isModal={true}
                    onClose={() => setActiveDashboardProject(null)}
                />
            </div>
        </div>
      )}

    </div>
  );
};
