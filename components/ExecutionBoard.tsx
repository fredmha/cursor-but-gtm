
import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { TicketStatus, Bet, Ticket, Priority, Status, Channel, Project } from '../types';
import { Icons, PRIORITIES } from '../constants';
import { generateTicketsForBet } from '../services/geminiService';
import { ProjectDashboard } from './ProjectDashboard';

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

// --- SUB-COMPONENTS ---

const ChannelDashboard: React.FC<{
    channelId: string;
    onDelete: () => void;
    onNavigateToBet: (betId: string) => void;
}> = ({ channelId, onDelete, onNavigateToBet }) => {
    const { campaign, addChannelPrinciple, deleteChannelPrinciple, addBet, currentUser } = useStore();
    const [newPrinciple, setNewPrinciple] = useState('');
    
    const channel = campaign?.channels.find(c => c.id === channelId);
    if (!channel) return null;

    const tickets = channel.bets.flatMap(b => b.tickets).sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const handleAddPrinciple = () => {
        if (!newPrinciple.trim()) return;
        addChannelPrinciple(channelId, newPrinciple);
        setNewPrinciple('');
    };

    const handleAddBet = () => {
        const desc = prompt("Bet Description:");
        if (!desc) return;
        addBet(channelId, {
            id: crypto.randomUUID(),
            description: desc,
            hypothesis: 'New hypothesis',
            successCriteria: 'TBD',
            status: Status.Active,
            channelId,
            tickets: [],
            ownerId: currentUser.id,
            timeboxWeeks: 2,
            startDate: new Date().toISOString()
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#09090b] overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-zinc-800 bg-zinc-950 flex justify-between items-start shrink-0">
                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-indigo-500/10 border-indigo-500/20 text-indigo-500">
                        <Icons.Zap className="w-6 h-6"/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{channel.name}</h2>
                        <p className="text-zinc-500 text-sm">Distribution Channel Dashboard</p>
                    </div>
                </div>
                <button 
                    onClick={() => { if(confirm('Delete this channel and all its data?')) onDelete(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-xs font-bold uppercase tracking-wider"
                >
                    <Icons.Trash className="w-4 h-4" /> Delete Channel
                </button>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-3 gap-8 h-full">
                    
                    {/* ZONE 1: PRINCIPLES */}
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <Icons.FileText className="w-5 h-5 text-pink-500" />
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Channel Mandates</h3>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar mb-4">
                            {(!channel.principles || channel.principles.length === 0) && (
                                <p className="text-sm text-zinc-600 italic">No specific mandates defined for this channel.</p>
                            )}
                            {(channel.principles || []).map(p => (
                                <div key={p.id} className="group flex justify-between items-start p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
                                    <p className="text-sm text-zinc-300 leading-relaxed">{p.text}</p>
                                    <button 
                                        onClick={() => deleteChannelPrinciple(channelId, p.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
                                    >
                                        <Icons.XCircle className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Add a new principle..."
                                value={newPrinciple}
                                onChange={e => setNewPrinciple(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPrinciple()}
                            />
                            <button onClick={handleAddPrinciple} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white transition-colors">
                                <Icons.Plus className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>

                    {/* ZONE 2: STRATEGY (BETS) */}
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Icons.Target className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Active Bets</h3>
                            </div>
                            <button onClick={handleAddBet} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider">+ Create</button>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                            {channel.bets.length === 0 && (
                                <p className="text-sm text-zinc-600 italic">No active bets.</p>
                            )}
                            {channel.bets.map(bet => {
                                const progress = bet.tickets.length > 0 
                                    ? Math.round((bet.tickets.filter(t => t.status === TicketStatus.Done).length / bet.tickets.length) * 100) 
                                    : 0;

                                return (
                                    <div 
                                        key={bet.id} 
                                        onClick={() => onNavigateToBet(bet.id)}
                                        className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                                                bet.status === Status.Active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
                                            }`}>{bet.status}</span>
                                            <Icons.ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                                        </div>
                                        <h4 className="text-sm font-bold text-zinc-200 mb-1 leading-snug">{bet.description}</h4>
                                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-3">
                                            <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ZONE 3: EXECUTION TIMELINE */}
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <Icons.Calendar className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Execution Timeline</h3>
                        </div>
                        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                            {tickets.length === 0 && (
                                <p className="text-sm text-zinc-600 italic">No tickets scheduled.</p>
                            )}
                            {tickets.map(ticket => {
                                const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                                const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== TicketStatus.Done;
                                
                                return (
                                    <div key={ticket.id} className="flex items-center gap-3 p-3 hover:bg-white/[0.02] rounded border-b border-white/5 last:border-0 transition-colors">
                                        <div className="w-16 shrink-0 text-right">
                                            <span className={`text-[10px] font-mono font-bold block ${isOverdue ? 'text-red-500' : 'text-zinc-500'}`}>
                                                {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'No Date'}
                                            </span>
                                        </div>
                                        <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${STATUS_CONFIG[ticket.status].color}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-zinc-300 truncate">{ticket.title}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const ExecutionBoard: React.FC = () => {
  const { campaign, addTicket, updateTicket, deleteTicket, updateBet, users, currentUser, addBet, addChannel, addProject, deleteChannel } = useStore();
  
  // State
  const [view, setView] = useState<ViewState>({ type: 'MY_ISSUES' });
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

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
        id: crypto.randomUUID(),
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

  const handleAddProject = () => {
      const name = prompt("Project Name:");
      if (!name) return;
      addProject({
          id: crypto.randomUUID(),
          name,
          description: 'New Initiative',
          status: 'On Track',
          priority: 'Medium',
          startDate: new Date().toISOString(),
          updates: []
      });
  };

  const handleAddChannel = () => {
      const name = prompt("Channel Name:");
      if (!name) return;
      addChannel({
          id: crypto.randomUUID(),
          name,
          campaignId: campaign?.id || '',
          bets: [],
          principles: []
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
           
           {/* Section: My Work */}
           <div>
               <div 
                   onClick={() => setView({type: 'MY_ISSUES'})}
                   className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${view.type === 'MY_ISSUES' ? 'bg-indigo-500/10 text-indigo-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
               >
                   <Icons.Target className="w-4 h-4"/>
                   <span className="text-xs font-bold">My Issues</span>
               </div>
           </div>

           {/* Section: Active Projects */}
           <div>
                <div className="px-3 flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Active Projects</h3>
                    <button onClick={handleAddProject} className="text-zinc-600 hover:text-white" title="Add Project"><Icons.Plus className="w-3 h-3"/></button>
                </div>
                <div className="space-y-1">
                    {projects.map(p => (
                        <div key={p.id} 
                           onClick={() => setView({ type: 'PROJECT', id: p.id })}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${view.type === 'PROJECT' && view.id === p.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            <Icons.Target className="w-3.5 h-3.5 text-emerald-500"/>
                            <span className="text-xs font-bold truncate">{p.name}</span>
                        </div>
                    ))}
                </div>
           </div>

           {/* Section: Channels */}
           <div>
                <div className="px-3 flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Channels</h3>
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
                                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded select-none ${isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        <Icons.Zap className="w-3.5 h-3.5 text-indigo-500"/>
                                        <span className="text-xs font-bold truncate">{channel.name}</span>
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

          {/* VIEW: TICKET BOARD */}
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
    </div>
  );
};
