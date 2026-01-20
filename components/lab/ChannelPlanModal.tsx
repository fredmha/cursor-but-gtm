import React, { useState, useEffect } from 'react';
import { useStore, generateId } from '../../store';
import { Icons } from '../../constants';
import { generateBetsFromPlan } from '../../services/labService';
import { Status, ChannelPlan } from '../../types';

interface ChannelPlanModalProps {
  channelId: string;
  onClose: () => void;
}

export const ChannelPlanModal: React.FC<ChannelPlanModalProps> = ({ channelId, onClose }) => {
  const { campaign, updateChannelPlan, addBet, currentUser } = useStore();
  const channel = campaign?.channels.find(c => c.id === channelId);
  
  const [formData, setFormData] = useState<ChannelPlan>({
    id: generateId(),
    audience: '',
    offer: '',
    mechanics: '',
    contextDump: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (channel?.plan) {
        setFormData(channel.plan);
        setGenerated(true);
    }
  }, [channel]);

  if (!channel) return null;

  const handleSaveAndGenerate = async () => {
    setLoading(true);
    
    // 1. Save Plan
    const plan: ChannelPlan = {
        ...formData,
        lastGeneratedAt: new Date().toISOString()
    };
    updateChannelPlan(channelId, plan);

    // 2. Generate Bets
    const newBets = await generateBetsFromPlan(channel.name, plan);
    
    // 3. Add Bets to Store
    newBets.forEach(bet => {
        addBet(channelId, {
            id: generateId(),
            description: bet.description!,
            hypothesis: bet.hypothesis!,
            successCriteria: 'TBD',
            status: Status.Draft,
            channelId: channelId,
            tickets: [],
            ownerId: currentUser.id,
            timeboxWeeks: 2,
            startDate: new Date().toISOString()
        });
    });

    setLoading(false);
    setGenerated(true);
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b] text-zinc-100 font-sans">
        {/* Lab Header */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-center text-purple-400">
                    <Icons.Layout className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        Strategy Lab <span className="text-zinc-600">/</span> {channel.name}
                    </h2>
                    <p className="text-xs text-zinc-500">Define the inputs. Let the system generate the output.</p>
                </div>
            </div>
            {generated && (
                <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    PLAN ACTIVE
                </span>
            )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                
                {/* Section 1: Audience */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-purple-400 tracking-wider">1. Who is the Audience?</label>
                    <p className="text-xs text-zinc-500">Be specific. "SMBs" is bad. "Founder-led SaaS under $1M ARR" is good.</p>
                    <textarea 
                        value={formData.audience}
                        onChange={e => setFormData({...formData, audience: e.target.value})}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm focus:border-purple-500 focus:outline-none leading-relaxed resize-none"
                        placeholder="Define the ICP..."
                    />
                </div>

                {/* Section 2: Offer */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-purple-400 tracking-wider">2. What is the Offer / Angle?</label>
                    <p className="text-xs text-zinc-500">What are we trading for their attention? Value prop, lead magnet, or hook.</p>
                    <textarea 
                        value={formData.offer}
                        onChange={e => setFormData({...formData, offer: e.target.value})}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm focus:border-purple-500 focus:outline-none leading-relaxed resize-none"
                        placeholder="Define the value proposition..."
                    />
                </div>

                {/* Section 3: Mechanics */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-purple-400 tracking-wider">3. Channel Mechanics</label>
                    <p className="text-xs text-zinc-500">How does this channel actually work for us? Frequency, format, constraints.</p>
                    <textarea 
                        value={formData.mechanics}
                        onChange={e => setFormData({...formData, mechanics: e.target.value})}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm focus:border-purple-500 focus:outline-none leading-relaxed resize-none"
                        placeholder="Define execution constraints..."
                    />
                </div>

                 {/* Section 4: Brain Dump */}
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-600 tracking-wider">Extra Context (Optional)</label>
                    <textarea 
                        value={formData.contextDump}
                        onChange={e => setFormData({...formData, contextDump: e.target.value})}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm focus:border-zinc-600 focus:outline-none leading-relaxed resize-none"
                        placeholder="Any other notes..."
                    />
                </div>

            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-4 shrink-0">
            {generated ? (
                 <button 
                    onClick={handleSaveAndGenerate}
                    disabled={loading}
                    className="px-6 py-3 bg-zinc-800 text-zinc-300 font-bold text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                >
                    {loading ? "Regenerating..." : "Save & Regenerate Bets"}
                </button>
            ) : (
                <button 
                    onClick={handleSaveAndGenerate}
                    disabled={loading || !formData.audience || !formData.offer}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? (
                        <>Processing...</>
                    ) : (
                        <>
                            <Icons.Sparkles className="w-4 h-4" /> Save & Generate Strategy
                        </>
                    )}
                </button>
            )}
        </div>
    </div>
  );
};
