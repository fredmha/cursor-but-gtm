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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="w-[500px] bg-white border border-zinc-100 rounded-xl shadow-2xl overflow-hidden ring-1 ring-zinc-200 relative z-10">
        <div className="bg-white border-b border-zinc-100 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Icons.Zap className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Define Strategic Bet</span>
            </div>
            <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-400 hover:text-zinc-600" /></button>
        </div>
        <div className="p-6 space-y-5">
            <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">The Bet (Action)</label>
                <input 
                    autoFocus
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:bg-white focus:border-indigo-500 focus:outline-none placeholder-zinc-400 transition-colors"
                    placeholder="e.g. Cold Email: CFO Sequence"
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                />
            </div>
            
            {projects.length > 0 && (
                <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Link to Project (Optional)</label>
                    <select
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:bg-white focus:border-indigo-500 focus:outline-none text-sm transition-colors"
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
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Success Criteria</label>
                <input 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:bg-white focus:border-indigo-500 focus:outline-none placeholder-zinc-400 font-mono text-sm transition-colors"
                    placeholder="e.g. >15% Reply Rate"
                    value={data.successCriteria}
                    onChange={e => setData({...data, successCriteria: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">The Hypothesis (Why?)</label>
                <textarea 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 focus:bg-white focus:border-indigo-500 focus:outline-none h-24 resize-none text-sm placeholder-zinc-400 leading-relaxed transition-colors"
                    placeholder="We believe that..."
                    value={data.hypothesis}
                    onChange={e => setData({...data, hypothesis: e.target.value})}
                />
            </div>
        </div>
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-900 font-medium">Cancel</button>
            <button 
                disabled={!data.description}
                onClick={() => onSave(data)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
            >
                Place Bet
            </button>
        </div>
      </div>
    </div>
  );
};