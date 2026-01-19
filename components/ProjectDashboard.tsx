
import React, { useState } from 'react';
import { useStore } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { Status, ProjectHealth, Priority, TicketStatus } from '../types';

interface ProjectDashboardProps {
  projectId: string; // Changed from channelId
  isModal?: boolean;
  onClose?: () => void;
  onNavigateToBet?: (betId: string) => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ 
    projectId, 
    isModal = false, 
    onClose, 
    onNavigateToBet
}) => {
  const { campaign, users, currentUser, updateProject, addProjectUpdate } = useStore();
  const project = campaign?.projects.find(p => p.id === projectId);
  const [newUpdate, setNewUpdate] = useState('');

  if (!project) return null;

  // Find linked bets across all channels
  const activeBets = (campaign?.channels || []).flatMap(c => c.bets).filter(b => b.projectId === projectId && b.status !== Status.Killed);
  
  // Find linked roadmap items
  const milestones = (campaign?.roadmapItems || []).filter(i => i.projectId === projectId && (i.type === 'LAUNCH' || i.type === 'THEME'));
  
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
             
             {/* Left Content (Feed) */}
             <div className="flex-1 overflow-y-auto p-8 border-r border-zinc-800 custom-scrollbar space-y-10">
                 
                 {/* Update Section */}
                 <div className="space-y-4">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Project Updates</h3>
                     <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                         <div className="flex gap-3 mb-3">
                             <div className={`w-6 h-6 rounded-full ${currentUser.color} flex items-center justify-center text-[10px] text-white font-bold`}>{currentUser.initials}</div>
                             <textarea 
                                value={newUpdate}
                                onChange={e => setNewUpdate(e.target.value)}
                                placeholder="Post a project update..."
                                className="w-full bg-transparent text-sm text-zinc-300 focus:outline-none placeholder-zinc-700 resize-none h-10 focus:h-20 transition-all"
                             />
                         </div>
                         <div className="flex justify-between items-center pt-2 border-t border-white/5">
                             <div className="flex items-center gap-2">
                                 <span className="text-[10px] text-zinc-600">Status:</span>
                                 <select 
                                   value={project.status || 'On Track'}
                                   onChange={e => updateProject(projectId, { status: e.target.value as ProjectHealth })}
                                   className="bg-transparent text-[10px] font-bold text-zinc-400 focus:outline-none uppercase"
                                 >
                                    <option value="On Track">On Track</option>
                                    <option value="At Risk">At Risk</option>
                                    <option value="Off Track">Off Track</option>
                                    <option value="Completed">Completed</option>
                                 </select>
                             </div>
                             <button 
                               onClick={handlePostUpdate}
                               disabled={!newUpdate}
                               className="px-3 py-1 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 disabled:opacity-50"
                             >
                               Post Update
                             </button>
                         </div>
                     </div>
                     
                     <div className="space-y-3 pl-4 border-l border-zinc-800 ml-3">
                         {project.updates?.map(u => {
                             const author = users.find(user => user.id === u.authorId);
                             return (
                                 <div key={u.id} className="relative">
                                     <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-zinc-700 ring-4 ring-[#09090b]"></div>
                                     <div className="flex items-center gap-2 mb-1">
                                         <span className="text-xs font-bold text-zinc-300">{author?.name}</span>
                                         <span className="text-[10px] text-zinc-600">{new Date(u.date).toLocaleDateString()}</span>
                                         <span className={`text-[9px] px-1.5 rounded uppercase font-bold ${
                                            u.status === 'On Track' ? 'bg-emerald-500/10 text-emerald-500' : 
                                            u.status === 'At Risk' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                         }`}>{u.status}</span>
                                     </div>
                                     <p className="text-sm text-zinc-400 leading-relaxed">{u.text}</p>
                                 </div>
                             )
                         })}
                     </div>
                 </div>

                 {/* Initiatives Section */}
                 <div>
                     <div className="flex items-center justify-between mb-4">
                         <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Initiatives (Bets)</h3>
                     </div>
                     <div className="space-y-2">
                         {activeBets.length === 0 && <p className="text-sm text-zinc-600 italic">No bets linked to this project.</p>}
                         {activeBets.map(bet => {
                             const total = bet.tickets.length;
                             const done = bet.tickets.filter(t => t.status === TicketStatus.Done).length;
                             const progress = total > 0 ? (done / total) * 100 : 0;
                             
                             return (
                                 <div 
                                    key={bet.id} 
                                    onClick={() => onNavigateToBet && onNavigateToBet(bet.id)}
                                    className={`flex items-center gap-4 p-3 rounded-lg border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors ${onNavigateToBet ? 'cursor-pointer group' : ''}`}
                                 >
                                     <div className={`p-1.5 rounded bg-zinc-800 ${bet.status === Status.Active ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                         <Icons.Zap className="w-4 h-4" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-sm font-medium text-zinc-200 truncate ${onNavigateToBet ? 'group-hover:text-indigo-400 transition-colors' : ''}`}>{bet.description}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                                bet.status === Status.Active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
                                            }`}>{bet.status}</span>
                                         </div>
                                         <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }}></div>
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-xs font-mono text-zinc-400">{done}/{total}</div>
                                     </div>
                                 </div>
                             )
                         })}
                     </div>
                 </div>
                 
                 {/* Milestones Section */}
                 <div>
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Milestones</h3>
                     <div className="space-y-2">
                        {milestones.length === 0 && <p className="text-sm text-zinc-600 italic">No milestones set on roadmap.</p>}
                        {milestones.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3 border-b border-zinc-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                                    <span className="text-sm text-zinc-300">{m.title}</span>
                                </div>
                                <span className="text-xs text-zinc-600 font-mono">Week {m.weekIndex + 1}</span>
                            </div>
                        ))}
                     </div>
                 </div>

             </div>

             {/* Right Sidebar (Properties) */}
             <div className="w-72 bg-zinc-950/50 p-6 space-y-8 overflow-y-auto shrink-0">
                 <div>
                     <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Status</label>
                     <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${
                             project.status === 'On Track' ? 'bg-emerald-500' : 
                             project.status === 'At Risk' ? 'bg-amber-500' : 
                             project.status === 'Off Track' ? 'bg-red-500' : 'bg-zinc-500'
                         }`}></div>
                         <select 
                             value={project.status || 'On Track'}
                             onChange={e => updateProject(projectId, { status: e.target.value as ProjectHealth })}
                             className="bg-transparent text-sm font-medium text-white focus:outline-none"
                         >
                            {['On Track', 'At Risk', 'Off Track', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                     </div>
                 </div>

                 <div>
                     <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Priority</label>
                     <div className="flex items-center gap-2">
                         <Icons.Flag className={`w-4 h-4 ${PRIORITIES.find(p => p.value === project.priority)?.color || 'text-zinc-500'}`} />
                         <select 
                             value={project.priority || 'Medium'}
                             onChange={e => updateProject(projectId, { priority: e.target.value as Priority })}
                             className="bg-transparent text-sm font-medium text-white focus:outline-none"
                         >
                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                         </select>
                     </div>
                 </div>

                 <div>
                     <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Project Lead</label>
                     <div className="flex items-center gap-2">
                        {projectLead ? (
                            <div className={`w-5 h-5 rounded-full ${projectLead.color} flex items-center justify-center text-[8px] text-white font-bold`}>{projectLead.initials}</div>
                        ) : (
                            <div className="w-5 h-5 rounded-full border border-dashed border-zinc-600"></div>
                        )}
                        <select 
                             value={project.ownerId || ''}
                             onChange={e => updateProject(projectId, { ownerId: e.target.value })}
                             className="bg-transparent text-sm font-medium text-white focus:outline-none"
                         >
                            <option value="">Unassigned</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                         </select>
                     </div>
                 </div>

                 <div>
                     <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Timeline</label>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">Start</span>
                            <span className="text-zinc-300 font-mono">{new Date(project.startDate || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">Target</span>
                            <input 
                              type="date" 
                              value={project.targetDate || ''}
                              onChange={e => updateProject(projectId, { targetDate: e.target.value })}
                              className="bg-transparent text-zinc-300 font-mono text-right focus:outline-none"
                            />
                        </div>
                     </div>
                 </div>
             </div>
        </div>
    </div>
  );
};
