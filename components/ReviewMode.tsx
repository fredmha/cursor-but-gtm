
import React from 'react';
import { useStore } from '../store';
import { Status, TicketStatus } from '../types';
import { Icons } from '../constants';

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    subtext: string;
    color: string;
    icon: React.ReactNode;
}> = ({ label, value, subtext, color, icon }) => (
    <div className="bg-surface p-6 rounded-2xl relative overflow-hidden group transition-all">
        <div className={`absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            {icon}
        </div>
        <div className="relative z-10">
            <h3 className="text-xs font-semibold uppercase text-zinc-400 tracking-wider mb-2">{label}</h3>
            <div className={`text-3xl font-bold mb-2 text-zinc-900`}>{value}</div>
            <p className="text-[10px] text-zinc-500 font-medium">{subtext}</p>
        </div>
    </div>
);

export const ReviewMode: React.FC = () => {
  const { campaign } = useStore();

  const allTickets = (campaign.channels || []).flatMap(c => c.tickets).concat((campaign.projects || []).flatMap(p => p.tickets));
  const activeProjects = campaign.projects || [];

  const totalTickets = allTickets.length;
  const doneTickets = allTickets.filter(t => t.status === TicketStatus.Done).length;
  const overdueTickets = allTickets.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TicketStatus.Done).length;
  
  return (
    <div className="h-full p-8 overflow-y-auto max-w-7xl mx-auto custom-scrollbar bg-background">
      
      <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Strategic Review</h1>
          <p className="text-zinc-500 text-sm">Analyze health, velocity, and focus.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
          <MetricCard 
             label="Velocity" 
             value={doneTickets} 
             subtext={`${totalTickets} tickets in scope`} 
             color="text-emerald-600" 
             icon={<Icons.Zap className="w-10 h-10" />}
          />
          <MetricCard 
             label="Slippage" 
             value={overdueTickets} 
             subtext="Tickets past due date" 
             color="text-red-500" 
             icon={<Icons.Clock className="w-10 h-10" />}
          />
          <MetricCard 
             label="Projects" 
             value={activeProjects.length} 
             subtext="Active Initiatives" 
             color="text-indigo-600" 
             icon={<Icons.Target className="w-10 h-10" />}
          />
           <MetricCard 
             label="Completion" 
             value={totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) + '%' : '0%'} 
             subtext="Global progress" 
             color="text-zinc-900" 
             icon={<Icons.CheckCircle className="w-10 h-10" />}
          />
      </div>

      {/* Project Health Table */}
      <div className="mb-12">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Icons.Layers className="w-4 h-4 text-zinc-400"/> Project Health Matrix
          </h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left">
                <thead className="bg-surface text-[10px] uppercase font-semibold text-zinc-400 border-b border-border">
                    <tr>
                        <th className="px-6 py-3">Project</th>
                        <th className="px-6 py-3 w-24">Status</th>
                        <th className="px-6 py-3 w-48">Progress</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                    {activeProjects.map(project => {
                         const pTickets = (project.tickets || []).concat((campaign.channels || []).flatMap(c => c.tickets).filter(t => t.projectId === project.id));
                         const pCompletion = pTickets.length > 0 ? (pTickets.filter(t => t.status === TicketStatus.Done).length / pTickets.length) * 100 : 0;
                        
                        return (
                            <tr key={project.id} className="hover:bg-surface transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-zinc-900 mb-0.5">{project.name}</div>
                                    <div className="text-[10px] text-zinc-400 truncate max-w-md">{project.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wide ${
                                            project.status === 'On Track' ? 'bg-emerald-50 text-emerald-600' :
                                            project.status === 'At Risk' ? 'bg-amber-50 text-amber-600' :
                                            project.status === 'Off Track' ? 'bg-red-50 text-red-600' :
                                            'bg-zinc-100 text-zinc-500'
                                        }`}>
                                            {project.status}
                                        </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                            <div className={`h-full bg-emerald-500`} style={{ width: `${pCompletion}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">{Math.round(pCompletion)}%</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};
