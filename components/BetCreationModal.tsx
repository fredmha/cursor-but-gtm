
import React, { useState } from 'react';
import { Icons } from '../constants';
import { Bet } from '../types';

export const BetCreationModal: React.FC<{
  channelId: string;
  onClose: () => void;
  onSave: (bet: Partial<Bet>) => void;
  projects?: any[];
}> = ({ channelId, onClose, onSave, projects = [] }) => {
  const [data, setData] = useState({ description: '', hypothesis: '', successCriteria: '', projectId: '' });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="w-[500px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 relative z-10">
        <div className="bg-zinc-900/50 border-b border-zinc-800 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Icons.Zap className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Define Strategic Bet</span>
            </div>
            <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
        </div>
        <div className="p-6 space-y-5">
            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">The Bet (Action)</label>
                <input 
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none placeholder-zinc-700"
                    placeholder="e.g. Cold Email: CFO Sequence"
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                />
            </div>
            
            {projects.length > 0 && (
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Link to Project (Optional)</label>
                    <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none text-sm"
                        value={data.projectId}
                        onChange={e => setData({...data, projectId: e.target.value})}
                    >
                        <option value="">No Project</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Success Criteria</label>
                <input 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none placeholder-zinc-700 font-mono text-sm"
                    placeholder="e.g. >15% Reply Rate"
                    value={data.successCriteria}
                    onChange={e => setData({...data, successCriteria: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">The Hypothesis (Why?)</label>
                <textarea 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none h-20 resize-none text-sm text-zinc-300 placeholder-zinc-700 leading-relaxed"
                    placeholder="We believe that..."
                    value={data.hypothesis}
                    onChange={e => setData({...data, hypothesis: e.target.value})}
                />
            </div>
        </div>
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">Cancel</button>
            <button 
                disabled={!data.description}
                onClick={() => onSave(data)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-lg shadow-indigo-900/20"
            >
                Place Bet
            </button>
        </div>
      </div>
    </div>
  );
};
