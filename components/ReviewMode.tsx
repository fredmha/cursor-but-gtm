import React from 'react';
import { useStore } from '../store';
import { Status, TicketStatus } from '../types';
import { Icons } from '../constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

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
  const { campaign, updateBet } = useStore();

  const activeChannels = campaign.channels.filter(c => c.bets.some(b => b.status !== Status.Killed));
  const activeBets = activeChannels.flatMap(c => c.bets).filter(b => b.status !== Status.Killed);

  // Metrics Calculation
  const totalTickets = activeBets.reduce((acc, b) => acc + b.tickets.length, 0);
  const doneTickets = activeBets.reduce((acc, b) => acc + b.tickets.filter(t => t.status === TicketStatus.Done).length, 0);
  const overdueTickets = activeBets.reduce((acc, b) => acc + b.tickets.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TicketStatus.Done).length, 0);
  
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
             label="Focus" 
             value={activeBets.filter(b => b.status === Status.Active).length} 
             subtext="Active Strategic Bets" 
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

      {/* Bet Health Table */}
      <div className="mb-12">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Icons.Layers className="w-4 h-4 text-zinc-400"/> Health Matrix
          </h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left">
                <thead className="bg-surface text-[10px] uppercase font-semibold text-zinc-400 border-b border-border">
                    <tr>
                        <th className="px-6 py-3">Bet Strategy</th>
                        <th className="px-6 py-3 w-32">Channel</th>
                        <th className="px-6 py-3 w-24">Status</th>
                        <th className="px-6 py-3 w-48">Progress</th>
                        <th className="px-6 py-3 w-32 text-right"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                    {activeBets.map(bet => {
                        const completion = bet.tickets.length > 0 ? (bet.tickets.filter(t => t.status === TicketStatus.Done).length / bet.tickets.length) * 100 : 0;
                        const channelName = campaign.channels.find(c => c.id === bet.channelId)?.name;
                        
                        return (
                            <tr key={bet.id} className="hover:bg-surface transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-zinc-900 mb-0.5">{bet.description}</div>
                                    <div className="text-[10px] text-zinc-400 truncate max-w-md">{bet.hypothesis}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-medium text-zinc-500">{channelName}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wide ${
                                            bet.status === Status.Active ? 'bg-emerald-50 text-emerald-600' :
                                            bet.status === Status.Paused ? 'bg-amber-50 text-amber-600' :
                                            'bg-zinc-100 text-zinc-500'
                                        }`}>
                                            {bet.status}
                                        </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${bet.status === Status.Paused ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${completion}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">{Math.round(completion)}%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {bet.status !== Status.Active && (
                                            <button 
                                                onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Active })}
                                                className="p-1.5 rounded hover:bg-emerald-50 text-zinc-400 hover:text-emerald-600" title="Activate"
                                            >
                                                <Icons.Play className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                        {bet.status === Status.Active && (
                                            <button 
                                                onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Paused })}
                                                className="p-1.5 rounded hover:bg-amber-50 text-zinc-400 hover:text-amber-600" title="Pause"
                                            >
                                                <Icons.Pause className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Killed })}
                                            className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600" title="Kill"
                                        >
                                            <Icons.Trash className="w-3.5 h-3.5"/>
                                        </button>
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