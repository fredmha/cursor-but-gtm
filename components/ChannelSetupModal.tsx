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
        tickets: [],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200 font-sans">
      <div className="w-[600px] bg-white border border-zinc-100 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 bg-white rounded-t-xl">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Icons.Rows className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-zinc-900">Distribution Architecture</h2>
                    <p className="text-xs text-zinc-500">Define the lanes for your execution workflow.</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
            <div className="space-y-3">
                {channels.map(channel => (
                    <div key={channel.id} className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg group hover:border-zinc-300 hover:shadow-sm transition-all">
                        <div className="p-2 bg-zinc-50 rounded text-zinc-400">
                            <Icons.Zap className="w-4 h-4" />
                        </div>
                        
                        <input 
                            value={channel.name}
                            onChange={(e) => setChannels(channels.map(c => c.id === channel.id ? {...c, name: e.target.value} : c))}
                            className="flex-1 bg-transparent text-sm font-bold text-zinc-900 focus:outline-none placeholder-zinc-400"
                            placeholder="Channel Name"
                        />

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => toggleTag(channel.id!, 'Inbound')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                    channel.tags?.includes('Inbound') 
                                    ? 'bg-cyan-50 text-cyan-600 border-cyan-200' 
                                    : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                                }`}
                            >
                                Inbound
                            </button>
                            <button 
                                onClick={() => toggleTag(channel.id!, 'Outbound')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                    channel.tags?.includes('Outbound') 
                                    ? 'bg-orange-50 text-orange-600 border-orange-200' 
                                    : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                                }`}
                            >
                                Outbound
                            </button>
                        </div>

                        <button 
                            onClick={() => removeChannel(channel.id!)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Icons.XCircle className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {/* Add Row */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100 border-dashed">
                    <input 
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                        placeholder="Add new channel (e.g. Paid Social)..."
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                        autoFocus
                    />
                    <button 
                        onClick={addChannel}
                        disabled={!newChannelName.trim()}
                        className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors shadow-sm"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-between items-center rounded-b-xl">
            <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900 font-medium px-4 py-2">
                Back to Setup
            </button>
            <button 
                onClick={() => onComplete(channels)}
                disabled={channels.length === 0}
                className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-zinc-200"
            >
                Continue <Icons.ChevronRight className="w-4 h-4" />
            </button>
        </div>

      </div>
    </div>
  );
};
