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
    <div className="bg-[#121215] border border-white/5 p-6 rounded-xl relative overflow-hidden group hover:border-white/10 transition-all">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            {icon}
        </div>
        <div className="relative z-10">
            <h3 className="text-xs font-mono uppercase text-zinc-500 font-bold mb-1">{label}</h3>
            <div className={`text-3xl font-bold font-mono mb-2 ${color.replace('text', 'text')}`}>{value}</div>
            <p className="text-[10px] text-zinc-400">{subtext}</p>
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
  
  const chartData = activeBets.map(b => ({
    name: b.description.substring(0, 10) + '...',
    fullDesc: b.description,
    total: b.tickets.length,
    done: b.tickets.filter(t => t.status === TicketStatus.Done).length,
    status: b.status,
    channel: campaign.channels.find(c => c.id === b.channelId)?.name
  }));

  return (
    <div className="h-full p-8 overflow-y-auto max-w-7xl mx-auto custom-scrollbar">
      
      <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Strategic Review</h1>
          <p className="text-zinc-500 text-sm">Analyze health, velocity, and focus.</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-12">
          <MetricCard 
             label="Velocity" 
             value={doneTickets} 
             subtext={`${totalTickets} total tickets in scope`} 
             color="text-emerald-500" 
             icon={<Icons.Zap className="w-12 h-12" />}
          />
          <MetricCard 
             label="Slippage" 
             value={overdueTickets} 
             subtext="Tickets past due date" 
             color="text-red-500" 
             icon={<Icons.Clock className="w-12 h-12" />}
          />
          <MetricCard 
             label="Focus" 
             value={activeBets.filter(b => b.status === Status.Active).length} 
             subtext="Active Strategic Bets" 
             color="text-indigo-500" 
             icon={<Icons.Target className="w-12 h-12" />}
          />
           <MetricCard 
             label="Completion" 
             value={totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) + '%' : '0%'} 
             subtext="Global progress" 
             color="text-white" 
             icon={<Icons.CheckCircle className="w-12 h-12" />}
          />
      </div>

      {/* Bet Health Table */}
      <div className="bg-[#121215] border border-white/5 rounded-xl overflow-hidden mb-12">
          <div className="p-4 border-b border-white/5 bg-zinc-900/30 flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                  <Icons.Layers className="w-4 h-4 text-zinc-500"/> Bet Health Matrix
              </h3>
          </div>
          <table className="w-full text-left">
              <thead className="bg-zinc-900/50 text-[10px] uppercase font-bold text-zinc-500">
                  <tr>
                      <th className="px-6 py-3">Bet Strategy</th>
                      <th className="px-6 py-3 w-32">Channel</th>
                      <th className="px-6 py-3 w-24">Status</th>
                      <th className="px-6 py-3 w-48">Progress</th>
                      <th className="px-6 py-3 w-48 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                  {activeBets.map(bet => {
                      const completion = bet.tickets.length > 0 ? (bet.tickets.filter(t => t.status === TicketStatus.Done).length / bet.tickets.length) * 100 : 0;
                      const channelName = campaign.channels.find(c => c.id === bet.channelId)?.name;
                      
                      return (
                          <tr key={bet.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-zinc-200 mb-1">{bet.description}</div>
                                  <div className="text-[10px] text-zinc-500 font-mono italic truncate max-w-md">{bet.hypothesis}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">{channelName}</span>
                              </td>
                              <td className="px-6 py-4">
                                   <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wide ${
                                        bet.status === Status.Active ? 'bg-emerald-500/10 text-emerald-500' :
                                        bet.status === Status.Paused ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-zinc-800 text-zinc-500'
                                    }`}>
                                        {bet.status}
                                    </span>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                          <div className={`h-full ${bet.status === Status.Paused ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${completion}%` }}></div>
                                      </div>
                                      <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">{Math.round(completion)}%</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {bet.status !== Status.Active && (
                                          <button 
                                            onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Active })}
                                            className="p-1.5 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500" title="Activate"
                                          >
                                              <Icons.Play className="w-4 h-4"/>
                                          </button>
                                      )}
                                      {bet.status === Status.Active && (
                                          <button 
                                            onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Paused })}
                                            className="p-1.5 rounded hover:bg-amber-500/10 text-zinc-500 hover:text-amber-500" title="Pause"
                                          >
                                              <Icons.Pause className="w-4 h-4"/>
                                          </button>
                                      )}
                                      <button 
                                        onClick={() => updateBet(bet.channelId, bet.id, { status: Status.Killed })}
                                        className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-500" title="Kill"
                                      >
                                          <Icons.Trash className="w-4 h-4"/>
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
  );
};
