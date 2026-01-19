
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { Status, ProjectHealth, Priority, TicketStatus, Ticket, Bet, Channel } from '../types';
import { TicketBoard } from './TicketBoard';

interface ProjectDashboardProps {
  projectId: string; // Changed from channelId
  isModal?: boolean;
  onClose?: () => void;
  onNavigateToBet?: (betId: string) => void;
}

// MATRIX TICKET CREATION MODAL
const MatrixTicketModal: React.FC<{
    projectId: string;
    channels: Channel[];
    users: any[];
    onClose: () => void;
    onSave: (ticket: Ticket) => void;
}> = ({ projectId, channels, users, onClose, onSave }) => {
    // Bets are pre-filtered to those that are NOT killed
    const availableChannels = channels;
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [selectedBetId, setSelectedBetId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState('');

    const availableBets = useMemo(() => {
        if (!selectedChannelId) return [];
        const channel = channels.find(c => c.id === selectedChannelId);
        return channel ? channel.bets.filter(b => b.status !== Status.Killed) : [];
    }, [selectedChannelId, channels]);

    const handleSave = () => {
        if (!selectedChannelId || !selectedBetId || !title) return;
        
        const ticket: Ticket = {
            id: generateId(),
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title,
            status: TicketStatus.Todo,
            betId: selectedBetId,
            channelId: selectedChannelId,
            projectId: projectId, // LOCKED CONTEXT
            assigneeId: assigneeId || undefined,
            priority: 'Medium',
            createdAt: new Date().toISOString()
        };
        onSave(ticket);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[500px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl relative z-10 p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Icons.PlusCircle className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-lg font-bold text-white">New Matrix Ticket</h3>
                    </div>
                    <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
                </div>

                <div className="space-y-4">
                    <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded text-xs text-zinc-400 mb-4">
                        Creating ticket in context of <strong>Project</strong>. Select where the execution lives (Channel & Bet).
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">1. Select Channel</label>
                        <select 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none text-sm"
                            value={selectedChannelId}
                            onChange={e => { setSelectedChannelId(e.target.value); setSelectedBetId(''); }}
                        >
                            <option value="" disabled>Choose Department...</option>
                            {availableChannels.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">2. Select Strategic Bet</label>
                        <select 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none text-sm disabled:opacity-50"
                            value={selectedBetId}
                            onChange={e => setSelectedBetId(e.target.value)}
                            disabled={!selectedChannelId}
                        >
                            <option value="" disabled>Choose Initiative...</option>
                            {availableBets.map(b => (
                                <option key={b.id} value={b.id}>{b.description}</option>
                            ))}
                        </select>
                        {selectedChannelId && availableBets.length === 0 && (
                            <p className="text-[10px] text-amber-500 mt-1">No active bets in this channel.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">3. Ticket Details</label>
                        <input 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none placeholder-zinc-700 mb-2"
                            placeholder="What needs to be done?"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                         <select 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none text-sm"
                            value={assigneeId}
                            onChange={e => setAssigneeId(e.target.value)}
                        >
                            <option value="">Unassigned</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">Cancel</button>
                    <button 
                        disabled={!selectedBetId || !title}
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-lg"
                    >
                        Create Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};


export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ 
    projectId, 
    isModal = false, 
    onClose, 
    onNavigateToBet
}) => {
  const { campaign, users, currentUser, updateProject, addProjectUpdate, addTicket, updateTicket } = useStore();
  const [newUpdate, setNewUpdate] = useState('');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);

  const project = campaign?.projects.find(p => p.id === projectId);
  
  if (!project) {
      return (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Icons.XCircle className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Project not found or deleted.</p>
          </div>
      )
  }

  // Live Tickets for this Project
  const projectTickets = useMemo(() => {
     return (campaign?.channels || []).flatMap(c => c.bets).flatMap(b => b.tickets).filter(t => t.projectId === projectId);
  }, [campaign, projectId]);
  
  const activeBets = (campaign?.channels || []).flatMap(c => c.bets).filter(b => b.projectId === projectId && b.status !== Status.Killed);
  const projectLead = users.find(u => u.id === project.ownerId);

  const handlePostUpdate = () => {
    if (!newUpdate.trim()) return;
    addProjectUpdate(projectId, {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      authorId: currentUser.id,
      status: project.status || 'On Track',
      text: newUpdate
    });
    setNewUpdate('');
  };

  const handleCreateMatrixTicket = (ticket: Ticket) => {
      addTicket(ticket.channelId, ticket.betId, ticket);
      setShowNewTicketModal(false);
  };

  const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
      // Find ticket to get channel/bet context
      const ticket = projectTickets.find(t => t.id === ticketId);
      if (ticket) {
          updateTicket(ticket.channelId, ticket.betId, ticketId, { status: newStatus });
      }
  };

  return (
    <div className={`flex flex-col bg-[#09090b] h-full ${isModal ? 'rounded-xl overflow-hidden' : ''}`}>
        
        {/* Header */}
        <div className={`p-8 border-b border-zinc-800 bg-zinc-950 flex justify-between items-start shrink-0`}>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>
                    <Icons.Target className="w-6 h-6"/>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{project.name}</h2>
                    <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">{project.description || "No description provided."}</p>
                </div>
            </div>
            {isModal && onClose && (
                <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors">
                    <Icons.XCircle className="w-6 h-6" />
                </button>
            )}
        </div>

        <div className="flex-1 flex overflow-hidden">
             
             {/* Main Content */}
             <div className="flex-1 overflow-hidden flex flex-col border-r border-zinc-800">
                 
                 {/* Toolbar / Tabs */}
                 <div className="px-8 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/20">
                     <div className="flex items-center gap-6">
                         <div className="flex items-center gap-2 text-sm font-bold text-white border-b-2 border-indigo-500 pb-0.5">
                             <Icons.Kanban className="w-4 h-4" /> Live Execution
                         </div>
                     </div>
                     <button 
                        onClick={() => setShowNewTicketModal(true)}
                        className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 transition-colors flex items-center gap-2"
                     >
                        <Icons.Plus className="w-3.5 h-3.5" />
                        New Ticket
                     </button>
                 </div>

                 {/* Kanban Board Area */}
                 <div className="flex-1 overflow-hidden p-6 bg-[#09090b]">
                     <TicketBoard 
                        tickets={projectTickets}
                        channels={campaign?.channels || []}
                        users={users}
                        onTicketClick={(t) => console.log('Edit ticket', t)}
                        onStatusChange={handleStatusChange}
                        groupByChannel={true}
                     />
                 </div>

             </div>

             {/* Right Sidebar (Properties & Context) */}
             <div className="w-80 bg-zinc-950/50 flex flex-col overflow-hidden shrink-0 border-l border-zinc-800">
                 <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                    
                    {/* Status & Updates */}
                    <div>
                         <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Project Health</h3>
                         <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 space-y-3">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${
                                         project.status === 'On Track' ? 'bg-emerald-500' : 
                                         project.status === 'At Risk' ? 'bg-amber-500' : 'bg-red-500'
                                     }`}></div>
                                     <select 
                                         value={project.status || 'On Track'}
                                         onChange={e => updateProject(projectId, { status: e.target.value as ProjectHealth })}
                                         className="bg-transparent text-xs font-bold text-white focus:outline-none uppercase"
                                     >
                                        <option value="On Track">On Track</option>
                                        <option value="At Risk">At Risk</option>
                                        <option value="Off Track">Off Track</option>
                                        <option value="Completed">Completed</option>
                                     </select>
                                 </div>
                                 <span className="text-[10px] text-zinc-500">{project.updates?.length || 0} updates</span>
                             </div>
                             
                             {/* Mini Update Input */}
                             <div className="relative">
                                 <input 
                                     value={newUpdate}
                                     onChange={e => setNewUpdate(e.target.value)}
                                     onKeyDown={e => e.key === 'Enter' && handlePostUpdate()}
                                     placeholder="Post status update..."
                                     className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-zinc-700 focus:outline-none"
                                 />
                                 <button 
                                    onClick={handlePostUpdate}
                                    disabled={!newUpdate} 
                                    className="absolute right-1 top-1 p-0.5 text-indigo-500 disabled:opacity-0 transition-opacity"
                                 >
                                     <Icons.ChevronRight className="w-3 h-3" />
                                 </button>
                             </div>
                             
                             {/* Latest Update */}
                             {project.updates && project.updates.length > 0 && (
                                 <div className="pt-2 border-t border-zinc-800">
                                     <div className="flex items-center gap-1 mb-1">
                                         <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] text-white">
                                            {users.find(u => u.id === project.updates![0].authorId)?.initials}
                                         </div>
                                         <span className="text-[9px] text-zinc-500">{new Date(project.updates![0].date).toLocaleDateString()}</span>
                                     </div>
                                     <p className="text-xs text-zinc-400 line-clamp-3">{project.updates![0].text}</p>
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Metadata Form */}
                    <div className="space-y-6">
                        <div>
                             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Project Lead</label>
                             <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded p-2">
                                {projectLead ? (
                                    <div className={`w-5 h-5 rounded-full ${projectLead.color} flex items-center justify-center text-[8px] text-white font-bold`}>{projectLead.initials}</div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full border border-dashed border-zinc-600"></div>
                                )}
                                <select 
                                     value={project.ownerId || ''}
                                     onChange={e => updateProject(projectId, { ownerId: e.target.value })}
                                     className="bg-transparent text-xs font-medium text-white focus:outline-none flex-1"
                                 >
                                    <option value="">Unassigned</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                 </select>
                             </div>
                         </div>
                         
                         <div>
                             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Timeline</label>
                             <div className="bg-zinc-900 border border-zinc-800 rounded p-3 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">Start</span>
                                    <input 
                                      type="date" 
                                      value={project.startDate?.split('T')[0] || ''}
                                      onChange={e => updateProject(projectId, { startDate: e.target.value })}
                                      className="bg-transparent text-zinc-300 font-mono text-right focus:outline-none w-24"
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">Target</span>
                                    <input 
                                      type="date" 
                                      value={project.targetDate?.split('T')[0] || ''}
                                      onChange={e => updateProject(projectId, { targetDate: e.target.value })}
                                      className="bg-transparent text-zinc-300 font-mono text-right focus:outline-none w-24"
                                    />
                                </div>
                             </div>
                         </div>
                    </div>

                    {/* Participating Bets */}
                    <div>
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Linked Bets</h3>
                        <div className="space-y-2">
                            {activeBets.map(bet => (
                                <div key={bet.id} className="text-xs p-2 rounded bg-zinc-900/50 border border-zinc-800 text-zinc-300">
                                    <div className="truncate mb-1">{bet.description}</div>
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>{campaign?.channels.find(c => c.id === bet.channelId)?.name}</span>
                                        <span>{bet.tickets.length} tickets</span>
                                    </div>
                                </div>
                            ))}
                            {activeBets.length === 0 && <p className="text-xs text-zinc-600 italic">No linked bets.</p>}
                        </div>
                    </div>

                 </div>
             </div>
        </div>

        {showNewTicketModal && (
            <MatrixTicketModal 
                projectId={projectId}
                channels={campaign?.channels || []}
                users={users}
                onClose={() => setShowNewTicketModal(false)}
                onSave={handleCreateMatrixTicket}
            />
        )}
    </div>
  );
};
