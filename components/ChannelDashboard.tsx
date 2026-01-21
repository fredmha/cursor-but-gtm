
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { TicketStatus, Ticket } from '../types';
import { TicketBoard } from './TicketBoard';
import { TicketModal } from './TicketModal';
import { ChannelPlanModal } from './lab/ChannelPlanModal';

interface ChannelDashboardProps {
  channelId: string;
  isModal?: boolean;
  onClose?: () => void;
  onNavigateToBet?: (betId: string) => void; // Kept for interface compatibility but unused
  onDelete?: () => void;
}

export const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ 
    channelId, 
    isModal = false, 
    onClose, 
    onDelete
}) => {
  const { 
      campaign, users, currentUser, 
      addChannelPrinciple, deleteChannelPrinciple, 
      addChannelLink, removeChannelLink, 
      addChannelNote, deleteChannelNote, 
      addTicket, updateTicket, deleteTicket,
      addChannelMember, removeChannelMember
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'KANBAN' | 'STRATEGY'>('QUEUE');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const [newPrinciple, setNewPrinciple] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkData, setNewLinkData] = useState({ title: '', url: '' });

  const channel = campaign?.channels.find(c => c.id === channelId);
  const projects = campaign?.projects || [];
  const channelDocs = (campaign?.docs || []).filter(d => d.channelId === channelId);
  
  if (!channel) return null;

  const allTickets = useMemo(() => {
      return (channel.tickets || []).sort((a, b) => {
         if (!a.dueDate) return 1;
         if (!b.dueDate) return -1;
         return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [channel.tickets]);

  // --- Handlers ---

  const handleAddPrinciple = () => {
    if (!newPrinciple.trim()) return;
    addChannelPrinciple(channelId, newPrinciple);
    setNewPrinciple('');
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

  const handleTicketClick = (ticket: Ticket) => {
      setEditingTicket(ticket);
      setShowTicketModal(true);
  };

  const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
      updateTicket(channelId, ticketId, { status: newStatus });
  };

  const handleSaveTicket = (data: any) => {
      const ticketData: Ticket = {
          id: data.id || generateId(),
          shortId: editingTicket?.shortId || `T-${Math.floor(Math.random() * 10000)}`,
          title: data.title,
          description: data.description,
          status: editingTicket?.status || TicketStatus.Todo,
          priority: data.priority,
          assigneeId: data.assigneeId,
          channelId: channelId,
          projectId: data.projectId,
          createdAt: editingTicket?.createdAt || new Date().toISOString(),
          linkedDocIds: data.linkedDocIds
      };

      if (editingTicket) {
           updateTicket(channelId, ticketData.id, ticketData);
      } else {
          addTicket(channelId, ticketData);
      }
      setShowTicketModal(false);
      setEditingTicket(null);
  };

  const handleDeleteTicket = (id: string) => {
      deleteTicket(channelId, id);
      setShowTicketModal(false);
  };

  if (activeTab === 'STRATEGY') {
      return (
          <div className="h-full bg-white relative flex flex-col">
              <div className="absolute top-4 right-4 z-50">
                   <button 
                        onClick={() => setActiveTab('QUEUE')} 
                        className="bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded text-xs font-bold shadow-sm"
                    >
                        Close Lab
                   </button>
              </div>
              <ChannelPlanModal channelId={channelId} onClose={() => {}} />
          </div>
      );
  }

  return (
    <div className={`flex flex-col bg-white h-full ${isModal ? 'rounded-xl overflow-hidden' : ''}`}>
        
        {/* Header */}
        <div className={`p-8 border-b border-zinc-100 bg-white flex justify-between items-start shrink-0`}>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border bg-indigo-50 border-indigo-100 text-indigo-600`}>
                    <Icons.Zap className="w-6 h-6"/>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-1">{channel.name}</h2>
                    <div className="flex gap-1.5">
                        {channel.tags?.map(tag => (
                            <span 
                                key={tag} 
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    tag === 'Inbound' 
                                    ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' 
                                    : 'bg-orange-50 text-orange-600 border border-orange-100'
                                }`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {onDelete && (
                    <button 
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation();
                            if(window.confirm('Delete this channel?')) onDelete(); 
                        }}
                        className="p-2 hover:bg-red-50 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete Channel"
                    >
                        <Icons.Trash className="w-5 h-5" />
                    </button>
                )}
                {isModal && onClose && (
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }} 
                        className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                        <Icons.XCircle className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* COLUMN 1: STRATEGY (Principles) - 25% */}
            <div className="w-[25%] border-r border-zinc-100 flex flex-col overflow-hidden bg-zinc-50/50">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Team Members */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                             <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <Icons.Target className="w-3.5 h-3.5" /> Team
                             </h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(channel.memberIds || []).map(mid => {
                                const u = users.find(user => user.id === mid);
                                if (!u) return null;
                                return (
                                    <div key={mid} className={`flex items-center gap-2 px-2 py-1 bg-white rounded border border-zinc-200 shadow-sm`}>
                                        <div className={`w-4 h-4 rounded-full ${u.color} text-[8px] flex items-center justify-center text-white`}>{u.initials}</div>
                                        <span className="text-xs text-zinc-600">{u.name}</span>
                                        <button onClick={() => removeChannelMember(channelId, mid)} className="text-zinc-400 hover:text-red-500 ml-1"><Icons.XCircle className="w-3 h-3"/></button>
                                    </div>
                                )
                            })}
                            {(channel.memberIds || []).length === 0 && <span className="text-xs text-zinc-400 italic">No members assigned.</span>}
                        </div>
                        
                        <div className="relative group">
                            <button className="text-[10px] font-bold text-indigo-500 uppercase hover:text-indigo-600 flex items-center gap-1">
                                + Add Member
                            </button>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-zinc-100 rounded shadow-xl hidden group-hover:block z-50">
                                {users.filter(u => !(channel.memberIds || []).includes(u.id)).map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => addChannelMember(channelId, u.id)}
                                        className="w-full text-left px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                    >
                                        <div className={`w-2 h-2 rounded-full ${u.color}`}></div>
                                        {u.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mandates */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Icons.FileText className="w-4 h-4 text-pink-500" />
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Channel Mandates</h3>
                        </div>
                        <div className="space-y-3 mb-3">
                            {(channel.principles || []).map(p => (
                                <div key={p.id} className="group relative bg-white border border-zinc-200 rounded p-3 hover:border-zinc-300 transition-colors shadow-sm">
                                    <p className="text-xs text-zinc-600 leading-relaxed">{p.text}</p>
                                    <button 
                                        onClick={() => deleteChannelPrinciple(channelId, p.id)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                                    >
                                        <Icons.XCircle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none shadow-sm"
                                placeholder="Add mandate..."
                                value={newPrinciple}
                                onChange={e => setNewPrinciple(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPrinciple()}
                            />
                        </div>
                    </div>

                </div>
            </div>

            {/* COLUMN 2: EXECUTION (Timeline & Board) - 50% */}
            <div className="w-[50%] flex flex-col overflow-hidden bg-white">
                 {/* Tabs Header */}
                 <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
                     <div className="flex items-center gap-4">
                         {(['QUEUE', 'KANBAN'] as const).map(tab => (
                             <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all ${activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
                             >
                                 {tab}
                             </button>
                         ))}
                         <button
                            onClick={() => setActiveTab('STRATEGY')}
                            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all flex items-center gap-1 text-zinc-500 hover:text-purple-600 border border-transparent"
                         >
                             <Icons.Layout className="w-3 h-3" /> Strategy Plan
                         </button>
                     </div>
                     <button 
                        onClick={() => { setEditingTicket(null); setShowTicketModal(true); }}
                        className={`px-4 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-sm`}
                     >
                        <Icons.Plus className="w-3.5 h-3.5" />
                        Ticket
                     </button>
                 </div>

                 <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'QUEUE' && (
                        <div className="h-full overflow-y-auto custom-scrollbar p-6">
                            <div className="space-y-2">
                                {allTickets.map(t => {
                                    const assignee = users.find(u => u.id === t.assigneeId);
                                    return (
                                        <div 
                                            key={t.id} 
                                            onClick={() => handleTicketClick(t)}
                                            className="flex items-center gap-4 p-3 bg-white border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer group shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className={`shrink-0 w-2 h-2 rounded-full ${t.status === TicketStatus.Done ? 'bg-emerald-500' : t.status === TicketStatus.InProgress ? 'bg-amber-500' : 'bg-zinc-300'}`}></div>
                                            <span className="text-xs font-mono text-zinc-400 w-16">{t.shortId}</span>
                                            <span className="text-sm text-zinc-700 truncate flex-1 font-medium">{t.title}</span>
                                            
                                            <div className="flex items-center gap-6">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${t.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>{t.priority}</span>
                                                <span className="text-xs text-zinc-400 font-mono w-24 text-right">
                                                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '--'}
                                                </span>
                                                <div className="w-6 flex justify-center">
                                                    {assignee ? (
                                                        <div className={`w-5 h-5 rounded-full ${assignee.color} text-[8px] text-white flex items-center justify-center font-bold`}>{assignee.initials}</div>
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border border-zinc-300 border-dashed"></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {allTickets.length === 0 && <p className="text-center text-zinc-400 text-sm py-10">No tickets in queue.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'KANBAN' && (
                        <div className="h-full overflow-hidden p-6 bg-white">
                            <TicketBoard 
                                tickets={allTickets}
                                channels={campaign?.channels || []}
                                users={users}
                                onTicketClick={handleTicketClick}
                                onStatusChange={handleStatusChange}
                                groupByChannel={false} 
                            />
                        </div>
                    )}
                 </div>
            </div>

            {/* COLUMN 3: KNOWLEDGE (Links & Notes) - 25% */}
            <div className="w-[25%] border-l border-zinc-100 flex flex-col overflow-hidden bg-zinc-50/50">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Linked Docs */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Icons.FileText className="w-4 h-4 text-purple-500" />
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Strategic Documents</h3>
                        </div>
                        <div className="space-y-2 mb-3">
                            {channelDocs.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-2 bg-white border border-zinc-200 rounded group hover:shadow-sm transition-all cursor-default">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 bg-zinc-50 rounded flex items-center justify-center text-zinc-400">
                                            <Icons.FileText className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <span className="text-xs font-medium text-zinc-700 truncate">{doc.title}</span>
                                            <div className="flex gap-1">
                                                {doc.tags?.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[8px] bg-zinc-100 px-1 rounded text-zinc-500">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-400 shrink-0" />}
                                </div>
                            ))}
                            {channelDocs.length === 0 && <p className="text-xs text-zinc-400 italic">No documents tagged to this channel.</p>}
                        </div>
                    </div>

                    {/* SOPs & Links */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Icons.Layers className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Resources</h3>
                            </div>
                            <button onClick={() => setIsAddingLink(!isAddingLink)} className="text-[10px] text-blue-500 font-bold uppercase hover:text-blue-600">+ Add</button>
                        </div>
                        
                        {isAddingLink && (
                            <div className="bg-white p-3 rounded mb-3 space-y-2 border border-zinc-200 shadow-sm">
                                <input 
                                    className="w-full bg-zinc-50 px-2 py-1 text-xs text-zinc-900 border border-zinc-200 rounded focus:outline-none"
                                    placeholder="Title"
                                    value={newLinkData.title}
                                    onChange={e => setNewLinkData({...newLinkData, title: e.target.value})}
                                />
                                <input 
                                    className="w-full bg-zinc-50 px-2 py-1 text-xs text-zinc-900 border border-zinc-200 rounded focus:outline-none"
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
                                <div key={l.id} className="flex items-center justify-between group p-2 hover:bg-zinc-100 rounded transition-colors">
                                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-600 hover:text-blue-600 truncate">
                                        <Icons.FileText className="w-3.5 h-3.5 text-zinc-400" />
                                        {l.title}
                                    </a>
                                    <button onClick={() => removeChannelLink(channelId, l.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500">
                                        <Icons.XCircle className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(!channel.links || channel.links.length === 0) && <p className="text-xs text-zinc-400 italic">No resources added.</p>}
                        </div>
                    </div>

                    {/* Team Notes */}
                    <div className="flex flex-col h-64">
                         <div className="flex items-center gap-2 mb-4">
                            <Icons.Edit className="w-4 h-4 text-purple-500" />
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Team Notes</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-3 bg-zinc-100/50 rounded p-2 border border-zinc-100">
                            {(channel.notes || []).map(n => {
                                const author = users.find(u => u.id === n.authorId);
                                return (
                                    <div key={n.id} className="text-xs group">
                                        <div className="flex items-center gap-1 mb-1">
                                            <span className="font-bold text-zinc-500">{author?.initials}</span>
                                            <span className="text-[10px] text-zinc-400">{new Date(n.date).toLocaleDateString()}</span>
                                            <button onClick={() => deleteChannelNote(channelId, n.id)} className="opacity-0 group-hover:opacity-100 ml-auto text-zinc-400 hover:text-red-500"><Icons.Trash className="w-3 h-3" /></button>
                                        </div>
                                        <p className="text-zinc-700 leading-relaxed">{n.text}</p>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex gap-2">
                             <input 
                                className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none shadow-sm"
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

        {showTicketModal && (
            <TicketModal 
                initialData={editingTicket ? {
                    id: editingTicket.id,
                    title: editingTicket.title,
                    description: editingTicket.description,
                    priority: editingTicket.priority,
                    assigneeId: editingTicket.assigneeId,
                    channelId: editingTicket.channelId,
                    projectId: editingTicket.projectId,
                    linkedDocIds: editingTicket.linkedDocIds
                } : { channelId }} 
                context={{ channels: campaign?.channels || [], projects, users, docs: campaign?.docs || [] }}
                onClose={() => { setShowTicketModal(false); setEditingTicket(null); }}
                onSave={handleSaveTicket}
                onDelete={editingTicket ? () => handleDeleteTicket(editingTicket.id) : undefined}
            />
        )}
    </div>
  );
};
