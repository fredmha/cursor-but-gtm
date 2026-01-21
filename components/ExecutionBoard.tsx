
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { TicketStatus, Ticket, Priority, Status, Channel, Project } from '../types';
import { Icons, PRIORITIES } from '../constants';
import { ProjectDashboard } from './ProjectDashboard';
import { ChannelDashboard } from './ChannelDashboard';

const STATUS_CONFIG = {
    [TicketStatus.Backlog]: { icon: Icons.Circle, color: 'text-zinc-300', bg: 'bg-zinc-50' },
    [TicketStatus.Todo]: { icon: Icons.Circle, color: 'text-zinc-400', bg: 'bg-zinc-50' },
    [TicketStatus.InProgress]: { icon: Icons.Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    [TicketStatus.Done]: { icon: Icons.CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    [TicketStatus.Canceled]: { icon: Icons.XCircle, color: 'text-red-400', bg: 'bg-red-50' },
};

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
      <div className="w-[500px] bg-white border border-border rounded-xl shadow-2xl relative z-10 overflow-hidden">
        <div className="p-6 border-b border-border bg-surface">
           <h3 className="text-base font-semibold text-zinc-900">Initialize New Project</h3>
           <p className="text-xs text-zinc-500">Define a finite, high-stakes initiative.</p>
        </div>
        <div className="p-6 space-y-4">
            <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Project Name</label>
                <input 
                    autoFocus
                    className="w-full bg-surface border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100 placeholder-zinc-400 transition-all"
                    placeholder="e.g. Q4 Rebrand"
                    value={data.name}
                    onChange={e => setData({...data, name: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && data.name && onSave(data)}
                />
            </div>
             <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea 
                    className="w-full bg-surface border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100 h-24 resize-none placeholder-zinc-400"
                    placeholder="What is the goal?"
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Target Date</label>
                    <input 
                        type="date"
                        className="w-full bg-surface border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                        value={data.targetDate}
                        onChange={e => setData({...data, targetDate: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Priority</label>
                    <select
                        className="w-full bg-surface border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                        value={data.priority}
                        onChange={e => setData({...data, priority: e.target.value as Priority})}
                    >
                        {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                 </div>
             </div>
        </div>
        <div className="p-4 border-t border-border bg-surface flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900">Cancel</button>
            <button 
                disabled={!data.name}
                onClick={() => onSave(data)}
                className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
                Create Project
            </button>
        </div>
      </div>
    </div>
  )
}

export const ExecutionBoard: React.FC = () => {
  const { campaign, users, currentUser, addChannel, addProject, deleteChannel, deleteProject } = useStore();
  
  const [view, setView] = useState<ViewState>({ type: 'MY_ISSUES' });
  const [showProjectModal, setShowProjectModal] = useState(false);

  const channels = campaign?.channels || [];
  const projects = campaign?.projects || [];

  const displayTickets = useMemo(() => {
      if (view.type === 'MY_ISSUES') {
          return channels.flatMap(c => 
              c.tickets.map(t => ({
                ...t, 
                channelName: c.name,
              }))
            ).filter(t => t.assigneeId === currentUser.id);
      }
      return [];
  }, [view, channels, currentUser.id]);

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

  return (
    <div className="h-full flex bg-background">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-surface">
        <div className="p-4 pt-6">
          <h2 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-4 px-2">Workspace</h2>
          <div 
               onClick={() => setView({type: 'MY_ISSUES'})}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all mb-6 ${view.type === 'MY_ISSUES' ? 'bg-white shadow-sm text-zinc-900 border border-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
           >
               <Icons.Target className="w-4 h-4"/>
               <span className="text-sm font-medium">My Issues</span>
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
                           className={`flex items-center group cursor-pointer px-3 py-1.5 rounded-lg transition-all ${isSelected ? 'bg-white shadow-sm text-zinc-900 border border-zinc-100' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
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
                           className={`flex items-center group cursor-pointer px-3 py-1.5 rounded-lg transition-all ${isSelected ? 'bg-white shadow-sm text-zinc-900 border border-zinc-100' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
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
      <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
          
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
                <div className="h-14 flex items-center justify-between px-8 bg-background shrink-0 border-b border-zinc-100">
                    <span className="text-sm font-semibold text-zinc-900">My Issues</span>
                </div>

                <div className="flex-1 overflow-hidden bg-background px-4">
                    {displayTickets.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                            <Icons.CheckCircle className="w-10 h-10 mb-4 opacity-10"/>
                            <p className="text-sm">No tickets found.</p>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto custom-scrollbar pb-10">
                            <table className="w-full text-left border-separate border-spacing-y-1">
                                <thead className="text-[10px] uppercase font-semibold text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-2 w-20">ID</th>
                                        <th className="px-4 py-2">Title</th>
                                        <th className="px-4 py-2 w-32">Status</th>
                                        <th className="px-4 py-2 w-24">Priority</th>
                                        <th className="px-4 py-2 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayTickets.map(ticket => {
                                        const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                                        const PriorityConfig = PRIORITIES.find(p => p.value === ticket.priority) || PRIORITIES[4];
                                        const assignee = users.find(u => u.id === ticket.assigneeId);
                                        
                                        return (
                                            <tr 
                                                key={ticket.id} 
                                                className="group cursor-pointer hover:bg-surface transition-colors rounded-lg"
                                            >
                                                <td className="px-4 py-3 text-xs font-mono text-zinc-400 rounded-l-lg">{ticket.shortId}</td>
                                                <td className="px-4 py-3 text-sm text-zinc-800 font-medium">
                                                    {ticket.title}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <StatusIcon className={`w-3.5 h-3.5 ${STATUS_CONFIG[ticket.status].color}`} />
                                                        <span className="text-xs text-zinc-500">{ticket.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Icons.Flag className={`w-3 h-3 ${PriorityConfig.color}`} />
                                                        <span className={`text-xs ${PriorityConfig.color}`}>{ticket.priority !== 'None' ? ticket.priority : ''}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 rounded-r-lg text-right">
                                                    {assignee && (
                                                        <div className={`w-5 h-5 rounded-full ${assignee.color} text-[8px] text-white flex items-center justify-center font-bold inline-block`}>
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
