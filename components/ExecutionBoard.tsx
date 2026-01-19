
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { TicketStatus, Bet, Ticket, Priority, Status, Channel, Project } from '../types';
import { Icons, PRIORITIES } from '../constants';
import { generateTicketsForBet } from '../services/geminiService';
import { ProjectDashboard } from './ProjectDashboard';
import { ChannelDashboard } from './ChannelDashboard';

const STATUS_CONFIG = {
    [TicketStatus.Backlog]: { icon: Icons.Circle, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
    [TicketStatus.Todo]: { icon: Icons.Circle, color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
    [TicketStatus.InProgress]: { icon: Icons.Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    [TicketStatus.Done]: { icon: Icons.CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    [TicketStatus.Canceled]: { icon: Icons.XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
};

type ViewState = 
    | { type: 'MY_ISSUES' }
    | { type: 'PROJECT', id: string }
    | { type: 'CHANNEL', id: string }
    | { type: 'BET', id: string };

// --- MODALS ---

const ProjectCreationModal: React.FC<{
  onClose: () => void;
  onSave: (data: { name: string; description: string; targetDate: string; priority: Priority }) => void;
}> = ({ onClose, onSave }) => {
  const [data, setData] = useState({ name: '', description: '', targetDate: '', priority: 'Medium' as Priority });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="w-[500px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 overflow-hidden">
        <div className="p-6 border-b border-zinc-800 bg-zinc-950">
           <h3 className="text-lg font-bold text-white">Initialize New Project</h3>
           <p className="text-xs text-zinc-500">Define a finite, high-stakes initiative.</p>
        </div>
        <div className="p-6 space-y-4">
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Project Name</label>
                <input 
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 placeholder-zinc-700"
                    placeholder="e.g. Q4 Rebrand"
                    value={data.name}
                    onChange={e => setData({...data, name: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && data.name && onSave(data)}
                />
            </div>
             <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 h-24 resize-none placeholder-zinc-700"
                    placeholder="What is the goal?"
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Target Date</label>
                    <input 
                        type="date"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                        value={data.targetDate}
                        onChange={e => setData({...data, targetDate: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Priority</label>
                    <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                        value={data.priority}
                        onChange={e => setData({...data, priority: e.target.value as Priority})}
                    >
                        {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                 </div>
             </div>
        </div>
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">Cancel</button>
            <button 
                disabled={!data.name}
                onClick={() => onSave(data)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
            >
                Create Project
            </button>
        </div>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---

export const ExecutionBoard: React.FC = () => {
  const { campaign, addTicket, users, currentUser, addBet, addChannel, addProject, deleteChannel } = useStore();
  
  // State
  const [view, setView] = useState<ViewState>({ type: 'MY_ISSUES' });
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [showProjectModal, setShowProjectModal] = useState(false);

  // --- Data Selectors ---
  const channels = campaign?.channels || [];
  const projects = campaign?.projects || [];

  const selectedBet = useMemo(() => {
      if (view.type === 'BET') {
          return channels.flatMap(c => c.bets).find(b => b.id === view.id) || null;
      }
      return null;
  }, [channels, view]);

  const displayTickets = useMemo(() => {
      if (view.type === 'MY_ISSUES') {
          return channels.flatMap(c => 
            c.bets.flatMap(b => 
              b.tickets.map(t => ({
                ...t, 
                betTitle: b.description, 
                channelName: c.name,
                betId: b.id
              }))
            )
          ).filter(t => t.assigneeId === currentUser.id);
      } else if (selectedBet) {
          const channel = channels.find(c => c.id === selectedBet.channelId);
          return selectedBet.tickets.map(t => ({...t, betTitle: selectedBet.description, channelName: channel?.name || 'Unknown', betId: selectedBet.id}));
      }
      return [];
  }, [view, selectedBet, channels, currentUser.id]);

  // --- Handlers ---
  
  const handleCreateTicket = () => {
      if (!selectedBet) return;
      const newTicket: Ticket = {
        id: generateId(),
        shortId: `T-${Math.floor(Math.random() * 10000)}`, 
        title: 'New Ticket',
        description: '',
        status: TicketStatus.Todo,
        betId: selectedBet.id,
        channelId: selectedBet.channelId,
        priority: 'Medium',
        assigneeId: currentUser.id,
        createdAt: new Date().toISOString()
      };
      addTicket(selectedBet.channelId, selectedBet.id, newTicket);
      setEditingTicket(newTicket);
  };

  const handleSaveProject = (data: { name: string; description: string; targetDate: string; priority: Priority }) => {
      const newId = generateId();
      addProject({
          id: newId,
          name: data.name,
          description: data.description,
          status: 'On Track',
          priority: data.priority,
          targetDate: data.targetDate,
          startDate: new Date().toISOString(),
          updates: []
      });
      setShowProjectModal(false);
      // Immediately navigate to the new project
      setView({ type: 'PROJECT', id: newId });
  };

  const handleAddChannel = () => {
      const name = prompt("Channel Name:");
      if (!name) return;
      addChannel({
          id: generateId(),
          name,
          campaignId: campaign?.id || '',
          bets: [],
          principles: [],
          tags: [],
          links: [],
          notes: []
      });
  };
  
  const handleDeleteChannel = (channelId: string) => {
      deleteChannel(channelId);
      setView({ type: 'MY_ISSUES' });
  };

  const toggleCollapse = (id: string) => {
      setCollapsedItems(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="h-full flex bg-background">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-[#121215]">
        <div className="p-4 border-b border-border bg-zinc-900/50">
          <h2 className="text-xs uppercase font-mono text-zinc-500 font-bold tracking-wider">Execution</h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-6">
           
           {/* Section 1: Workspace */}
           <div>
               <div 
                   onClick={() => setView({type: 'MY_ISSUES'})}
                   className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${view.type === 'MY_ISSUES' ? 'bg-indigo-500/10 text-indigo-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
               >
                   <Icons.Target className="w-4 h-4"/>
                   <span className="text-xs font-bold">My Issues</span>
               </div>
           </div>

           {/* Section 2: Active Projects */}
           <div>
                <div className="px-3 flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Active Projects</h3>
                    <button 
                        onClick={() => setShowProjectModal(true)} 
                        className="text-zinc-600 hover:text-white transition-colors" 
                        title="Add Project"
                    >
                        <Icons.Plus className="w-3 h-3"/>
                    </button>
                </div>
                <div className="space-y-1">
                    {projects.map(p => {
                         const isSelected = view.type === 'PROJECT' && view.id === p.id;
                         const isExpanded = !collapsedItems[p.id];
                         // Find bets associated with this project across all channels
                         const projectBets = channels.flatMap(c => c.bets).filter(b => b.projectId === p.id);

                         return (
                            <div key={p.id}>
                                <div 
                                   onClick={() => setView({ type: 'PROJECT', id: p.id })}
                                   className={`flex items-center group cursor-pointer rounded overflow-hidden ${isSelected ? 'bg-zinc-800' : ''}`}
                                >
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleCollapse(p.id); }}
                                        className="p-2 text-zinc-600 hover:text-white transition-colors"
                                    >
                                        <Icons.ChevronDown className={`w-3.5 h-3.5 transform transition-transform ${!isExpanded ? '-rotate-90' : 'rotate-0'}`} />
                                    </button>
                                    <div className={`flex-1 flex items-center gap-2 py-1.5 pr-2 ${isSelected ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                                        <Icons.Target className="w-3.5 h-3.5 text-emerald-500"/>
                                        <span className="text-xs font-bold truncate">{p.name}</span>
                                    </div>
                                </div>
                                {isExpanded && (
                                   <div className="pl-6 border-l border-zinc-800 ml-3 space-y-0.5 mt-1">
                                       {projectBets.map(bet => (
                                           <div 
                                               key={bet.id}
                                               onClick={() => setView({ type: 'BET', id: bet.id })}
                                               className={`px-2 py-1 rounded cursor-pointer truncate transition-all ${view.type === 'BET' && view.id === bet.id ? 'text-indigo-300 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
                                           >
                                               <span className="text-[11px]">{bet.description}</span>
                                           </div>
                                       ))}
                                       {projectBets.length === 0 && <div className="px-2 text-[10px] text-zinc-600 italic">No bets</div>}
                                   </div>
                               )}
                            </div>
                        );
                    })}
                </div>
           </div>

           {/* Section 3: Departments (Channels) */}
           <div>
                <div className="px-3 flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Departments</h3>
                   <button onClick={handleAddChannel} className="text-zinc-600 hover:text-white" title="Add Channel"><Icons.Plus className="w-3 h-3"/></button>
                </div>
                <div className="space-y-1">
                   {channels.map(channel => {
                       const isExpanded = !collapsedItems[channel.id];
                       const isSelected = view.type === 'CHANNEL' && view.id === channel.id;
                       
                       return (
                           <div key={channel.id}>
                               <div className="flex items-center group cursor-pointer" onClick={() => setView({ type: 'CHANNEL', id: channel.id })}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleCollapse(channel.id); }}
                                        className="p-1 text-zinc-600 hover:text-white transition-colors"
                                    >
                                        <Icons.ChevronDown className={`w-3.5 h-3.5 transform transition-transform ${!isExpanded ? '-rotate-90' : 'rotate-0'}`} />
                                    </button>
                                    <div 
                                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded select-none overflow-hidden ${isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        <Icons.Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0"/>
                                        <div className="flex-1 flex items-center justify-between min-w-0">
                                            <span className="text-xs font-bold truncate">{channel.name}</span>
                                            {/* Tag Dots */}
                                            <div className="flex -space-x-1 shrink-0 ml-1">
                                                {channel.tags?.includes('Inbound') && (
                                                    <div className="w-2 h-2 rounded-full bg-cyan-500 ring-1 ring-[#121215]"></div>
                                                )}
                                                {channel.tags?.includes('Outbound') && (
                                                    <div className="w-2 h-2 rounded-full bg-orange-500 ring-1 ring-[#121215]"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                               </div>
                               {isExpanded && (
                                   <div className="pl-6 border-l border-zinc-800 ml-3 space-y-0.5 mt-1">
                                       {channel.bets.map(bet => (
                                           <div 
                                               key={bet.id}
                                               onClick={() => setView({ type: 'BET', id: bet.id })}
                                               className={`px-2 py-1 rounded cursor-pointer truncate transition-all ${view.type === 'BET' && view.id === bet.id ? 'text-indigo-300 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
                                           >
                                               <span className="text-[11px]">{bet.description}</span>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       );
                   })}
                </div>
           </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
          
          {/* VIEW: PROJECT DASHBOARD */}
          {view.type === 'PROJECT' && (
              <ProjectDashboard 
                  projectId={view.id} 
                  onNavigateToBet={(betId) => setView({type: 'BET', id: betId})}
              />
          )}

          {/* VIEW: CHANNEL DASHBOARD */}
          {view.type === 'CHANNEL' && (
              <ChannelDashboard 
                  channelId={view.id}
                  onDelete={() => handleDeleteChannel(view.id)}
                  onNavigateToBet={(betId) => setView({type: 'BET', id: betId})}
              />
          )}

          {/* VIEW: TICKET BOARD (For Bets or My Issues) */}
          {(view.type === 'BET' || view.type === 'MY_ISSUES') && (
            <>
                {/* Toolbar */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/50 backdrop-blur shrink-0">
                    <div className="flex items-center gap-3">
                         {/* Breadcrumbs */}
                         {view.type === 'MY_ISSUES' ? (
                             <span className="text-sm font-bold text-white">My Issues</span>
                         ) : selectedBet ? (
                             <>
                                <span className="text-zinc-500 text-sm font-medium">{channels.find(c => c.id === selectedBet.channelId)?.name}</span>
                                <span className="text-zinc-700">/</span>
                                <span className="text-white text-sm font-bold truncate max-w-xs">{selectedBet.description}</span>
                             </>
                         ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        {view.type === 'BET' && (
                            <button
                                onClick={handleCreateTicket}
                                className="text-xs px-3 py-1.5 bg-white hover:bg-zinc-200 text-black rounded font-bold flex items-center gap-2 transition-colors shadow-lg shadow-white/5"
                            >
                                <Icons.Plus className="w-3.5 h-3.5" />
                                New Ticket
                            </button>
                        )}
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-hidden bg-background">
                    {displayTickets.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                            <Icons.CheckCircle className="w-12 h-12 mb-4 opacity-20"/>
                            <p className="text-sm">No tickets found.</p>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-surface sticky top-0 z-10 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-bold uppercase text-zinc-500 w-24">ID</th>
                                        <th className="px-6 py-3 text-[10px] font-bold uppercase text-zinc-500">Title</th>
                                        <th className="px-6 py-3 text-[10px] font-bold uppercase text-zinc-500 w-32">Status</th>
                                        <th className="px-6 py-3 text-[10px] font-bold uppercase text-zinc-500 w-24">Priority</th>
                                        <th className="px-6 py-3 text-[10px] font-bold uppercase text-zinc-500 w-24">Assignee</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900">
                                    {displayTickets.map(ticket => {
                                        const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                                        const PriorityConfig = PRIORITIES.find(p => p.value === ticket.priority) || PRIORITIES[4];
                                        const assignee = users.find(u => u.id === ticket.assigneeId);
                                        
                                        return (
                                            <tr 
                                                key={ticket.id} 
                                                className="hover:bg-zinc-900/50 cursor-pointer group transition-colors"
                                            >
                                                <td className="px-6 py-3 text-xs font-mono text-zinc-500">{ticket.shortId}</td>
                                                <td className="px-6 py-3 text-sm text-zinc-200 font-medium">
                                                    {ticket.title}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <StatusIcon className={`w-3.5 h-3.5 ${STATUS_CONFIG[ticket.status].color}`} />
                                                        <span className="text-xs text-zinc-400">{ticket.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Icons.Flag className={`w-3 h-3 ${PriorityConfig.color}`} />
                                                        <span className={`text-xs ${PriorityConfig.color}`}>{ticket.priority !== 'None' ? ticket.priority : ''}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    {assignee && (
                                                        <div className={`w-5 h-5 rounded-full ${assignee.color} text-[8px] text-white flex items-center justify-center font-bold`}>
                                                            {assignee.initials}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
          )}

      </div>
      
      {showProjectModal && (
          <ProjectCreationModal 
              onClose={() => setShowProjectModal(false)}
              onSave={handleSaveProject}
          />
      )}
    </div>
  );
};
