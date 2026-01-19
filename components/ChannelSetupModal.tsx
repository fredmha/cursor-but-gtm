
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { Channel, ChannelTag } from '../types';

interface ChannelSetupModalProps {
  existingChannels: Channel[];
  onComplete: (channels: Partial<Channel>[]) => void;
  onBack: () => void;
}

export const ChannelSetupModal: React.FC<ChannelSetupModalProps> = ({ existingChannels, onComplete, onBack }) => {
  const [channels, setChannels] = useState<Partial<Channel>[]>([]);
  const [newChannelName, setNewChannelName] = useState('');

  // Initialize with existing or default channels
  useEffect(() => {
    if (existingChannels.length > 0) {
        setChannels(existingChannels.map(c => ({ ...c })));
    } else {
        setChannels([
            { id: crypto.randomUUID(), name: 'SEO', tags: ['Inbound'] },
            { id: crypto.randomUUID(), name: 'Outbound', tags: ['Outbound'] },
            { id: crypto.randomUUID(), name: 'Events', tags: ['Inbound', 'Outbound'] }
        ]);
    }
  }, [existingChannels]);

  const addChannel = () => {
    if (!newChannelName.trim()) return;
    setChannels([...channels, { 
        id: crypto.randomUUID(), 
        name: newChannelName.trim(), 
        tags: [],
        bets: [],
        principles: []
    }]);
    setNewChannelName('');
  };

  const removeChannel = (id: string) => {
    setChannels(channels.filter(c => c.id !== id));
  };

  const toggleTag = (id: string, tag: ChannelTag) => {
    setChannels(channels.map(c => {
        if (c.id === id) {
            const currentTags = c.tags || [];
            const newTags = currentTags.includes(tag) 
                ? currentTags.filter(t => t !== tag)
                : [...currentTags, tag];
            return { ...c, tags: newTags };
        }
        return c;
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200 font-sans">
      <div className="w-[600px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-950 rounded-t-xl">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                    <Icons.Rows className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Distribution Architecture</h2>
                    <p className="text-xs text-zinc-500">Define the lanes for your roadmap execution.</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-[#09090b]">
            <div className="space-y-3">
                {channels.map(channel => (
                    <div key={channel.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-all">
                        <div className="p-2 bg-zinc-800 rounded text-zinc-400">
                            <Icons.Zap className="w-4 h-4" />
                        </div>
                        
                        <input 
                            value={channel.name}
                            onChange={(e) => setChannels(channels.map(c => c.id === channel.id ? {...c, name: e.target.value} : c))}
                            className="flex-1 bg-transparent text-sm font-bold text-white focus:outline-none placeholder-zinc-600"
                            placeholder="Channel Name"
                        />

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => toggleTag(channel.id!, 'Inbound')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                    channel.tags?.includes('Inbound') 
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                                    : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                Inbound
                            </button>
                            <button 
                                onClick={() => toggleTag(channel.id!, 'Outbound')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                    channel.tags?.includes('Outbound') 
                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                                    : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                Outbound
                            </button>
                        </div>

                        <button 
                            onClick={() => removeChannel(channel.id!)}
                            className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Icons.XCircle className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {/* Add Row */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800 border-dashed">
                    <input 
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                        placeholder="Add new channel (e.g. Paid Social)..."
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
                        autoFocus
                    />
                    <button 
                        onClick={addChannel}
                        disabled={!newChannelName.trim()}
                        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/30 flex justify-between items-center rounded-b-xl">
            <button onClick={onBack} className="text-sm text-zinc-500 hover:text-white font-medium px-4 py-2">
                Back to Principles
            </button>
            <button 
                onClick={() => onComplete(channels)}
                disabled={channels.length === 0}
                className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-white/5"
            >
                Enter Roadmap <Icons.ChevronRight className="w-4 h-4" />
            </button>
        </div>

      </div>
    </div>
  );
};
