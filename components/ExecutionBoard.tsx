
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { TicketStatus, Ticket, Priority } from '../types';
import { Icons, PRIORITIES } from '../constants';
import { ProjectDashboard } from './ProjectDashboard';
import { ChannelDashboard } from './ChannelDashboard';
import { TicketModal } from './TicketModal';
import { TeamHealthHeader } from './TeamHealthHeader';
import { TicketList } from './TicketList';
import { TicketBoard } from './TicketBoard';

type ViewState = 
    | { type: 'MY_ISSUES' }
    | { type: 'PROJECT', id: string }
    | { type: 'CHANNEL', id: string };

const ProjectCreationModal: React.FC<{
  onClose: () => void;
  onSave: (data: { name: string; description: string; targetDate: string; priority: Priority }) => void;
}> = ({ onClose, onSave }) => {
  const [data, setData] = useState({ name: '', description: '', targetDate: '', priority: 'Medium' as Priority });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="w-[500px] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-white">
           <h3 className="text-base font-bold text-zinc-900">Initialize New Project</h3>
           <p className="text-xs text-zinc-500">Define a finite, high-stakes initiative.</p>
        </div>
        <div className="p-6 space-y-4">
            <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Project Name</label>
                <input 
                    autoFocus
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:border-indigo-500 transition-all placeholder-zinc-400"
                    placeholder="e.g. Q4 Rebrand"
                    value={data.name}
                    onChange={e => setData({...data, name: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && data.name && onSave(data)}
                />
            </div>
             <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:border-indigo-500 h-24 resize-none placeholder-zinc-400"
                    placeholder="What is the goal?"
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Target Date</label>
                    <input 
                        type="date"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:border-indigo-500"
                        value={data.targetDate}
                        onChange={e => setData({...data, targetDate: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                    <select
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:border-indigo-500"
                        value={data.priority}
                        onChange={e => setData({...data, priority: e.target.value as Priority})}
                    >
                        {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                 </div>
             </div>
        </div>
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900">Cancel</button>
            <button 
                disabled={!data.name}
                onClick={() => onSave(data)}
                className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
                Create Project
            </button>
        </div>
      </div>
    </div>
  )
}

export const ExecutionBoard: React.FC = () => {
  const { campaign, users, currentUser, addChannel, addProject, deleteChannel, deleteProject, addTicket, updateTicket, updateProjectTicket, deleteTicket, deleteProjectTicket, addProjectTicket } = useStore();
  
  const [view, setView] = useState<ViewState>({ type: 'MY_ISSUES' });
  const [scope, setScope] = useState<'MINE' | 'TEAM'>('MINE');
  const [viewType, setViewType] = useState<'LIST' | 'BOARD'>('LIST');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const channels = campaign?.channels || [];
  const projects = campaign?.projects || [];

  const allTickets = useMemo(() => {
      return [
          ...channels.flatMap(c => c.tickets),
          ...projects.flatMap(p => p.tickets)
      ];
  }, [channels, projects]);

  const displayTickets = useMemo(() => {
      if (view.type === 'MY_ISSUES') {
          if (scope === 'MINE') {
              return allTickets.filter(t => t.assigneeId === currentUser.id);
          } else {
              // For Team Pulse, filter out cancelled/backlog to focus on active work
              return allTickets.filter(t => t.status !== TicketStatus.Backlog && t.status !== TicketStatus.Canceled);
          }
      }
      return [];
  }, [view, scope, allTickets, currentUser.id]);

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
          updates: [],
          tickets: []
      });
      setShowProjectModal(false);
      setView({ type: 'PROJECT', id: newId });
  };

  const handleAddChannel = () => {
      const name = prompt("Channel Name:");
      if (!name) return;
      addChannel({
          id: generateId(),
          name,
          campaignId: campaign?.id || '',
          tickets: [],
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
  
  const handleDeleteProject = (projectId: string) => {
      deleteProject(projectId);
      setView({ type: 'MY_ISSUES' });
  };

  const handleTicketClick = (ticket: Ticket) => {
      setEditingTicket(ticket);
      setShowTicketModal(true);
  };

  const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
      const channelTicket = channels.flatMap(c => c.tickets).find(t => t.id === ticketId);
      if (channelTicket && channelTicket.channelId) {
          updateTicket(channelTicket.channelId, ticketId, { status: newStatus });
          return;
      }
      const projectTicket = projects.flatMap(p => p.tickets).find(t => t.id === ticketId);
      if (projectTicket && projectTicket.projectId) {
          updateProjectTicket(projectTicket.projectId, ticketId, { status: newStatus });
          return;
      }
  };

  const handleToggleStatus = (e: React.MouseEvent, ticket: Ticket) => {
      e.stopPropagation();
      const newStatus = ticket.status === TicketStatus.Done ? TicketStatus.Todo : TicketStatus.Done;
      handleStatusChange(ticket.id, newStatus);
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
          channelId: data.channelId,
          projectId: data.projectId,
          createdAt: editingTicket?.createdAt || new Date().toISOString(),
          linkedDocIds: data.linkedDocIds
      };

      if (editingTicket) {
          const isLocationChanged = (editingTicket.channelId !== ticketData.channelId) || (editingTicket.projectId !== ticketData.projectId);
          
          if (isLocationChanged) {
              if (editingTicket.channelId) deleteTicket(editingTicket.channelId, editingTicket.id);
              else if (editingTicket.projectId) deleteProjectTicket(editingTicket.projectId, editingTicket.id);
              
              if (ticketData.channelId) addTicket(ticketData.channelId, ticketData);
              else if (ticketData.projectId) addProjectTicket(ticketData.projectId, ticketData);
          } else {
              if (ticketData.channelId) updateTicket(ticketData.channelId, ticketData.id, ticketData);
              else if (ticketData.projectId) updateProjectTicket(ticketData.projectId, ticketData.id, ticketData);
          }
      } else {
          if (ticketData.channelId) addTicket(ticketData.channelId, ticketData);
          else if (ticketData.projectId) addProjectTicket(ticketData.projectId, ticketData);
      }
      setShowTicketModal(false);
      setEditingTicket(null);
  };

  const handleDeleteTicket = (id: string) => {
      if (editingTicket) {
          if (editingTicket.channelId) deleteTicket(editingTicket.channelId, id);
          else if (editingTicket.projectId) deleteProjectTicket(editingTicket.projectId, id);
      }
      setShowTicketModal(false);
  };

  return (
    <div className="h-full flex bg-white font-sans text-zinc-900">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-100 flex flex-col bg-zinc-50/50">
        <div className="p-4 pt-6">
          <h2 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-4 px-2">Workspace</h2>
          <div className="space-y-1 mb-6">
              <button 
                   onClick={() => { setView({type: 'MY_ISSUES'}); setScope('MINE'); }}
                   className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${view.type === 'MY_ISSUES' && scope === 'MINE' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
               >
                   <Icons.Target className="w-4 h-4"/>
                   <span className="text-sm font-medium">My Issues</span>
               </button>
               <button 
                   onClick={() => { setView({type: 'MY_ISSUES'}); setScope('TEAM'); }}
                   className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${view.type === 'MY_ISSUES' && scope === 'TEAM' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
               >
                   <Icons.Layout className="w-4 h-4"/>
                   <span className="text-sm font-medium">Team Pulse</span>
               </button>
           </div>

           {/* Projects */}
           <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Projects</h3>
                <button 
                    onClick={() => setShowProjectModal(true)} 
                    className="text-zinc-400 hover:text-zinc-900 transition-colors" 
                    title="Add Project"
                >
                    <Icons.Plus className="w-3 h-3"/>
                </button>
            </div>
            <div className="space-y-0.5 mb-6">
                {projects.map(p => {
                     const isSelected = view.type === 'PROJECT' && view.id === p.id;
                     return (
                        <div 
                           key={p.id}
                           onClick={() => setView({ type: 'PROJECT', id: p.id })}
                           className={`flex items-center group cursor-pointer px-3 py-1.5 rounded-lg transition-all ${isSelected ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                        >
                            <span className="text-sm font-medium truncate">{p.name}</span>
                        </div>
                    );
                })}
            </div>

           {/* Channels */}
            <div className="flex items-center justify-between mb-2 px-2">
               <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Teams</h3>
               <button onClick={handleAddChannel} className="text-zinc-400 hover:text-zinc-900" title="Add Channel"><Icons.Plus className="w-3 h-3"/></button>
            </div>
            <div className="space-y-0.5">
               {channels.map(channel => {
                   const isSelected = view.type === 'CHANNEL' && view.id === channel.id;
                   return (
                       <div 
                           key={channel.id}
                           onClick={() => setView({ type: 'CHANNEL', id: channel.id })}
                           className={`flex items-center group cursor-pointer px-3 py-1.5 rounded-lg transition-all ${isSelected ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                        >
                            <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="text-sm font-medium truncate">{channel.name}</span>
                            </div>
                       </div>
                   );
               })}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          
          {view.type === 'PROJECT' && (
              <ProjectDashboard 
                  projectId={view.id} 
                  onDelete={() => handleDeleteProject(view.id)}
              />
          )}

          {view.type === 'CHANNEL' && (
              <ChannelDashboard 
                  channelId={view.id}
                  onDelete={() => handleDeleteChannel(view.id)}
              />
          )}

          {view.type === 'MY_ISSUES' && (
            <>
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-8 bg-white shrink-0 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        {scope === 'TEAM' ? <Icons.Layout className="w-4 h-4 text-zinc-500"/> : <Icons.Target className="w-4 h-4 text-zinc-500"/>}
                        <span className="text-sm font-bold text-zinc-900">{scope === 'TEAM' ? 'Team Pulse' : 'My Issues'}</span>
                        <span className="text-sm text-zinc-400 font-normal ml-2">/ {viewType === 'LIST' ? 'Table' : 'Board'}</span>
                    </div>
                    
                    <div className="flex bg-zinc-100 p-0.5 rounded-lg">
                        <button 
                            onClick={() => setViewType('LIST')}
                            className={`p-1.5 rounded-md transition-all ${viewType === 'LIST' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                            title="List View"
                        >
                            <Icons.List className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewType('BOARD')}
                            className={`p-1.5 rounded-md transition-all ${viewType === 'BOARD' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                            title="Board View"
                        >
                            <Icons.Kanban className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden bg-white flex flex-col">
                    {scope === 'TEAM' && (
                         <div className="px-8 pt-6 pb-2 shrink-0">
                             <TeamHealthHeader users={users} tickets={displayTickets} />
                         </div>
                    )}

                    <div className="flex-1 overflow-hidden px-8 pb-8">
                        {viewType === 'LIST' ? (
                            <TicketList 
                                tickets={displayTickets}
                                users={users}
                                channels={channels}
                                projects={projects}
                                onTicketClick={handleTicketClick}
                                onToggleStatus={handleToggleStatus}
                            />
                        ) : (
                            <div className="h-full overflow-hidden">
                                {displayTickets.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                        <Icons.CheckCircle className="w-10 h-10 mb-4 opacity-10"/>
                                        <p className="text-sm">No tickets found.</p>
                                    </div>
                                ) : (
                                    <TicketBoard 
                                        tickets={displayTickets}
                                        channels={channels}
                                        users={users}
                                        onTicketClick={handleTicketClick}
                                        onStatusChange={handleStatusChange}
                                        groupByChannel={false} 
                                        groupByUser={scope === 'TEAM'} // Enable User Swimlanes for Team Pulse
                                    />
                                )}
                            </div>
                        )}
                    </div>
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
                  linkedDocIds: editingTicket.linkedDocIds
              }} 
              context={{ channels, projects, users, docs: campaign?.docs || [] }}
              onClose={() => { setShowTicketModal(false); setEditingTicket(null); }}
              onSave={handleSaveTicket}
              onDelete={() => handleDeleteTicket(editingTicket.id)}
          />
      )}
    </div>
  );
};
