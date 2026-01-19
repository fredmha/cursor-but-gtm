
import React, { useState } from 'react';
import { useStore } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { Status, TicketStatus, ChannelLink } from '../types';

interface ChannelDashboardProps {
  channelId: string;
  isModal?: boolean;
  onClose?: () => void;
  onNavigateToBet?: (betId: string) => void;
  onDelete?: () => void;
}

export const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ 
    channelId, 
    isModal = false, 
    onClose, 
    onNavigateToBet,
    onDelete
}) => {
  const { campaign, users, currentUser, addChannelPrinciple, deleteChannelPrinciple, addBet, addChannelLink, removeChannelLink, addChannelNote, deleteChannelNote } = useStore();
  const [newPrinciple, setNewPrinciple] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkData, setNewLinkData] = useState({ title: '', url: '' });

  const channel = campaign?.channels.find(c => c.id === channelId);
  if (!channel) return null;

  // Flatten tickets for timeline
  const allTickets = channel.bets.flatMap(b => b.tickets).sort((a, b) => {
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

  const handleAddLink = () => {
      if (!newLinkData.title || !newLinkData.url) return;
      addChannelLink(channelId, {
          id: crypto.randomUUID(),
          title: newLinkData.title,
          url: newLinkData.url,
          icon: 'link'
      });
      setIsAddingLink(false);
      setNewLinkData({ title: '', url: '' });
  };

  const handleAddNote = () => {
      if (!newNote.trim()) return;
      addChannelNote(channelId, {
          id: crypto.randomUUID(),
          authorId: currentUser.id,
          date: new Date().toISOString(),
          text: newNote
      });
      setNewNote('');
  };

  return (
    <div className={`flex flex-col bg-[#09090b] h-full ${isModal ? 'rounded-xl overflow-hidden' : ''}`}>
        
        {/* Header */}
        <div className={`p-8 border-b border-zinc-800 bg-zinc-950 flex justify-between items-start shrink-0`}>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border bg-indigo-500/10 border-indigo-500/20 text-indigo-500`}>
                    <Icons.Zap className="w-6 h-6"/>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{channel.name}</h2>
                    <div className="flex gap-1.5">
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
            </div>
            <div className="flex items-center gap-2">
                {!isModal && onDelete && (
                    <button 
                        onClick={() => { if(confirm('Delete this channel?')) onDelete() }}
                        className="p-2 hover:bg-red-500/10 rounded-full text-zinc-500 hover:text-red-500 transition-colors"
                        title="Delete Channel"
                    >
                        <Icons.Trash className="w-5 h-5" />
                    </button>
                )}
                {isModal && onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors">
                        <Icons.XCircle className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* COLUMN 1: STRATEGY (Principles & Bets) - 30% */}
            <div className="w-[30%] border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-900/10">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Mandates */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Icons.FileText className="w-4 h-4 text-pink-500" />
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Channel Mandates</h3>
                        </div>
                        <div className="space-y-3 mb-3">
                            {(channel.principles || []).map(p => (
                                <div key={p.id} className="group relative bg-zinc-900 border border-zinc-800 rounded p-3 hover:border-zinc-700 transition-colors">
                                    <p className="text-xs text-zinc-300 leading-relaxed">{p.text}</p>
                                    <button 
                                        onClick={() => deleteChannelPrinciple(channelId, p.id)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-opacity"
                                    >
                                        <Icons.XCircle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {channel.principles.length === 0 && <p className="text-xs text-zinc-600 italic">No mandates defined.</p>}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Add mandate..."
                                value={newPrinciple}
                                onChange={e => setNewPrinciple(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPrinciple()}
                            />
                        </div>
                    </div>

                    {/* Active Bets */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Icons.Target className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active Bets</h3>
                            </div>
                            <button onClick={handleAddBet} className="text-[10px] text-indigo-400 font-bold uppercase hover:text-indigo-300">+ New</button>
                        </div>
                        <div className="space-y-3">
                            {channel.bets.map(bet => {
                                const total = bet.tickets.length;
                                const done = bet.tickets.filter(t => t.status === TicketStatus.Done).length;
                                const progress = total > 0 ? (done / total) * 100 : 0;
                                
                                return (
                                    <div 
                                        key={bet.id} 
                                        onClick={() => onNavigateToBet && onNavigateToBet(bet.id)}
                                        className={`p-3 bg-zinc-900 border border-zinc-800 rounded-lg group hover:border-indigo-500/50 transition-all ${onNavigateToBet ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                                                bet.status === Status.Active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
                                            }`}>{bet.status}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-zinc-200 mb-2 leading-snug">{bet.description}</h4>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-mono text-zinc-500">{done}/{total}</span>
                                        </div>
                                    </div>
                                );
                            })}
                             {channel.bets.length === 0 && <p className="text-xs text-zinc-600 italic">No active bets.</p>}
                        </div>
                    </div>

                </div>
            </div>

            {/* COLUMN 2: EXECUTION (Timeline & Board) - 45% */}
            <div className="w-[45%] flex flex-col overflow-hidden bg-[#09090b]">
                 <div className="p-6 border-b border-zinc-800 shrink-0">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Icons.Calendar className="w-4 h-4 text-emerald-500" /> Execution Queue
                     </h3>
                     {/* Mini Timeline Visualization (MVP: List) */}
                     <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mb-6">
                         {allTickets.slice(0, 5).map(t => (
                             <div key={t.id} className="flex items-center gap-3 text-xs">
                                 <span className="text-zinc-600 font-mono w-20 text-right">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No Date'}</span>
                                 <div className={`w-1.5 h-1.5 rounded-full ${t.status === TicketStatus.Done ? 'bg-emerald-500' : 'bg-zinc-600'}`}></div>
                                 <span className="text-zinc-300 truncate">{t.title}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                     <div className="flex items-center justify-between mb-4">
                         <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <Icons.Kanban className="w-4 h-4 text-zinc-500" /> Ticket Board
                         </h3>
                         <span className="text-[10px] text-zinc-600">{allTickets.length} items</span>
                     </div>
                     
                     <div className="space-y-2">
                        {allTickets.map(t => {
                            const assignee = users.find(u => u.id === t.assigneeId);
                            return (
                                <div key={t.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800/50 rounded hover:bg-zinc-900 transition-colors">
                                     <div className={`shrink-0 w-2 h-2 rounded-full ${t.status === TicketStatus.Done ? 'bg-emerald-500' : t.status === TicketStatus.InProgress ? 'bg-amber-500' : 'bg-zinc-600'}`}></div>
                                     <span className="text-xs font-mono text-zinc-500">{t.shortId}</span>
                                     <span className="text-sm text-zinc-300 truncate flex-1">{t.title}</span>
                                     {assignee && (
                                         <div className={`w-5 h-5 rounded-full ${assignee.color} flex items-center justify-center text-[8px] text-white font-bold`}>
                                             {assignee.initials}
                                         </div>
                                     )}
                                </div>
                            )
                        })}
                        {allTickets.length === 0 && <p className="text-xs text-zinc-600 italic">No tickets in this channel.</p>}
                     </div>
                 </div>
            </div>

            {/* COLUMN 3: KNOWLEDGE (Links & Notes) - 25% */}
            <div className="w-[25%] border-l border-zinc-800 flex flex-col overflow-hidden bg-zinc-900/10">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* SOPs & Links */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Icons.Layers className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Resources</h3>
                            </div>
                            <button onClick={() => setIsAddingLink(!isAddingLink)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">+ Add</button>
                        </div>
                        
                        {isAddingLink && (
                            <div className="bg-zinc-900 p-3 rounded mb-3 space-y-2 border border-zinc-800">
                                <input 
                                    className="w-full bg-zinc-950 px-2 py-1 text-xs text-white border border-zinc-800 rounded focus:outline-none"
                                    placeholder="Title"
                                    value={newLinkData.title}
                                    onChange={e => setNewLinkData({...newLinkData, title: e.target.value})}
                                />
                                <input 
                                    className="w-full bg-zinc-950 px-2 py-1 text-xs text-white border border-zinc-800 rounded focus:outline-none"
                                    placeholder="URL"
                                    value={newLinkData.url}
                                    onChange={e => setNewLinkData({...newLinkData, url: e.target.value})}
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsAddingLink(false)} className="text-[10px] text-zinc-500">Cancel</button>
                                    <button onClick={handleAddLink} className="text-[10px] text-white font-bold bg-blue-600 px-2 py-1 rounded">Save</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {(channel.links || []).map(l => (
                                <div key={l.id} className="flex items-center justify-between group p-2 hover:bg-zinc-800 rounded transition-colors">
                                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-300 hover:text-blue-400 truncate">
                                        <Icons.FileText className="w-3.5 h-3.5 text-zinc-500" />
                                        {l.title}
                                    </a>
                                    <button onClick={() => removeChannelLink(channelId, l.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500">
                                        <Icons.XCircle className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(!channel.links || channel.links.length === 0) && <p className="text-xs text-zinc-600 italic">No resources added.</p>}
                        </div>
                    </div>

                    {/* Team Notes */}
                    <div className="flex flex-col h-64">
                         <div className="flex items-center gap-2 mb-4">
                            <Icons.Edit className="w-4 h-4 text-purple-500" />
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Team Notes</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-3 bg-zinc-900/30 rounded p-2">
                            {(channel.notes || []).map(n => {
                                const author = users.find(u => u.id === n.authorId);
                                return (
                                    <div key={n.id} className="text-xs group">
                                        <div className="flex items-center gap-1 mb-1">
                                            <span className="font-bold text-zinc-400">{author?.initials}</span>
                                            <span className="text-[10px] text-zinc-600">{new Date(n.date).toLocaleDateString()}</span>
                                            <button onClick={() => deleteChannelNote(channelId, n.id)} className="opacity-0 group-hover:opacity-100 ml-auto text-zinc-700 hover:text-red-500"><Icons.Trash className="w-3 h-3" /></button>
                                        </div>
                                        <p className="text-zinc-300 leading-relaxed">{n.text}</p>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex gap-2">
                             <input 
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Type a note..."
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                            />
                        </div>
                    </div>

                </div>
            </div>

        </div>
    </div>
  );
};
