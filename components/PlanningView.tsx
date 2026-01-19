
import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Status, OperatingPrinciple } from '../types';
import { Icons } from '../constants';

export const PlanningView: React.FC = () => {
  const { campaign, addChannel, addBet, updateBet, updateChannel, users } = useStore();
  const [showPrinciples, setShowPrinciples] = useState(false);

  // Group principles for display
  const groupedPrinciples = useMemo(() => {
    return (campaign?.principles || []).reduce((acc, p) => {
      const cat = p.category || 'GENERAL';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, OperatingPrinciple[]>);
  }, [campaign?.principles]);

  if (!campaign) return null;

  const handleAddChannel = () => {
    const name = prompt("Channel Name (e.g., SEO, LinkedIn):");
    if (!name) return;
    // We use addChannel to ensure it syncs with Roadmap view immediately
    addChannel({
       id: crypto.randomUUID(),
       name,
       campaignId: campaign.id,
       bets: [],
       principles: []
    });
  };

  const handleAddBet = (channelId: string) => {
    const desc = prompt("Bet Description:");
    if (!desc) return;
    addBet(channelId, {
      id: crypto.randomUUID(),
      description: desc,
      hypothesis: 'If we do this, then...',
      successCriteria: 'Define success metric',
      status: Status.Draft,
      channelId,
      tickets: [],
      ownerId: users[0].id, // Default to first user
      timeboxWeeks: 2,
      startDate: new Date().toISOString()
    });
  };

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Objective Header */}
      <div className="p-8 border-b border-border bg-surface/30 flex justify-between items-start shrink-0">
        <div className="max-w-4xl">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">North Star Objective</h2>
          <div className="text-3xl font-bold text-primary leading-tight">{campaign.objective}</div>
          <div className="flex gap-4 mt-4 text-xs font-mono text-zinc-500">
             <span className="flex items-center gap-1"><Icons.Play className="w-3 h-3"/> Start: {campaign.startDate}</span>
             <span className="flex items-center gap-1"><Icons.Target className="w-3 h-3"/> End: {campaign.endDate}</span>
          </div>
        </div>
        <button 
          onClick={() => setShowPrinciples(!showPrinciples)}
          className={`px-3 py-1.5 rounded border text-xs font-bold font-mono uppercase tracking-wide transition-all ${showPrinciples ? 'bg-pink-500/10 text-pink-500 border-pink-500/50' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}
        >
          {showPrinciples ? 'HIDE_RULES' : 'VIEW_RULES'}
        </button>
      </div>

      {/* Principles Drawer (Overlay) */}
      {showPrinciples && (
        <div className="absolute top-[160px] right-8 w-[450px] max-h-[calc(100vh-200px)] overflow-y-auto bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-xl z-20 p-6 animate-in slide-in-from-right-4 fade-in duration-200 custom-scrollbar">
           <div className="flex justify-between items-center mb-6 border-b border-zinc-900 pb-2 sticky top-0 bg-zinc-950/95 pt-2 z-10">
              <h3 className="text-xs font-mono uppercase text-pink-500 font-bold">OPERATING_PRINCIPLES.md</h3>
              <span className="text-[9px] font-mono text-zinc-600">READ_ONLY</span>
           </div>
           
           <div className="space-y-8">
             {Object.keys(groupedPrinciples).length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4 font-mono">// NO RULES DEFINED</p>
             )}

             {Object.entries(groupedPrinciples).map(([category, items]) => (
                <div key={category}>
                   <h4 className="text-[10px] font-bold text-zinc-500 font-mono uppercase mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-pink-500"></span>
                      {category}
                   </h4>
                   <div className="space-y-3">
                     {(items as OperatingPrinciple[]).map(p => (
                       <div key={p.id} className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
                         <h5 className="font-bold text-sm text-pink-400 font-mono mb-2">{p.title}</h5>
                         <p className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">{p.description}</p>
                       </div>
                     ))}
                   </div>
                </div>
             ))}
           </div>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 overflow-x-auto p-8">
        <div className="flex gap-6 h-full min-w-max">
           
           {/* Channel Columns */}
           {campaign.channels.map(channel => (
             <div key={channel.id} className="w-96 flex flex-col h-full bg-[#121215] border border-white/5 rounded-xl overflow-hidden">
               {/* Channel Header */}
               <div className="p-4 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between group">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                     <Icons.Zap className="w-4 h-4 text-indigo-400" />
                   </div>
                   <div>
                       <h3 className="font-bold text-sm text-zinc-100">{channel.name}</h3>
                       <p className="text-[10px] text-zinc-500 font-mono">{channel.bets.length} Bets Active</p>
                   </div>
                 </div>
                 <button className="text-zinc-600 hover:text-white transition-colors">
                   <Icons.List className="w-4 h-4"/>
                 </button>
               </div>

               {/* Bets Stack */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {channel.bets.length === 0 && (
                     <div className="text-center py-8 opacity-40">
                         <p className="text-xs text-zinc-500 mb-2">No strategy defined.</p>
                     </div>
                 )}
                 {channel.bets.map(bet => {
                   const owner = users.find(u => u.id === bet.ownerId);
                   return (
                     <div key={bet.id} className="group relative bg-zinc-800/40 border border-white/5 hover:border-zinc-600 rounded-lg p-4 transition-all hover:bg-zinc-800/60 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                           <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase ${
                             bet.status === Status.Active ? 'bg-emerald-500/10 text-emerald-400' :
                             bet.status === Status.Draft ? 'bg-zinc-700 text-zinc-400' :
                             bet.status === Status.Killed ? 'bg-red-500/10 text-red-500' :
                             'bg-amber-500/10 text-amber-500'
                           }`}>
                             {bet.status}
                           </span>
                           <div className="flex -space-x-2">
                              {owner && (
                                <div className={`w-5 h-5 rounded-full ${owner.color} border border-zinc-800 flex items-center justify-center text-[7px] text-white font-bold`} title={owner.name}>
                                  {owner.initials}
                                </div>
                              )}
                           </div>
                        </div>
                        
                        <h4 className="font-semibold text-sm text-zinc-200 mb-2 leading-snug">{bet.description}</h4>
                        
                        <div className="bg-black/20 rounded p-2 mb-3 border border-white/5">
                          <p className="text-[10px] text-zinc-500 italic line-clamp-2">Why: "{bet.hypothesis}"</p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-600 border-t border-white/5 pt-2 mt-1">
                           <span className="flex items-center gap-1">
                             <Icons.FileText className="w-3 h-3"/> {bet.tickets.length} Tasks
                           </span>
                           {bet.status === Status.Draft && (
                             <button 
                               onClick={() => updateBet(channel.id, bet.id, { status: Status.Active })}
                               className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline"
                             >
                               ACTIVATE
                             </button>
                           )}
                        </div>
                     </div>
                   );
                 })}

                 <button
                   onClick={() => handleAddBet(channel.id)}
                   className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-white/[0.02] text-zinc-500 hover:text-zinc-300 rounded-lg flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wide"
                 >
                   <Icons.Plus className="w-3.5 h-3.5" />
                   Add Strategy Bet
                 </button>
               </div>
             </div>
           ))}

           {/* Add Channel Button Column */}
           <div className="w-12 pt-0 h-full flex flex-col items-center">
              <button 
                onClick={handleAddChannel}
                className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 hover:text-white text-zinc-500 flex items-center justify-center transition-all shadow-lg"
                title="Add New Channel"
              >
                <Icons.Plus className="w-5 h-5"/>
              </button>
              <div className="w-px h-full bg-gradient-to-b from-zinc-800 to-transparent mt-4"></div>
           </div>

        </div>
      </div>
    </div>
  );
};
