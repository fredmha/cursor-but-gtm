
import React from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import { RoadmapSandbox } from './RoadmapSandbox';
import { ChannelSetupModal } from './ChannelSetupModal';
import { Icons } from '../constants';
import { useStore } from '../store';

interface OnboardingWizardProps {
  onEnableLabMode: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onEnableLabMode }) => {
  const { state, actions } = useOnboarding();
  const { currentUser } = useStore();

  const { step, loading, formData, campaign, showChannelModal } = state;
  
  const TOTAL_STEPS = 4;

  // --- STEP 2: ROADMAP SANDBOX (Full Screen) ---
  if (step === 2) {
      return (
          <div className="fixed inset-0 bg-white flex flex-col z-50 font-sans text-zinc-900 animate-in fade-in duration-500">
             {/* Minimal Header included in RoadmapSandbox or just render it raw */}
             <RoadmapSandbox onNext={actions.handleNext} onBack={actions.handleBack} />
          </div>
      );
  }

  // --- WIZARD CARD MODE (Step 1, 3, 4) ---
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-zinc-50 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-200"></div>
      
      <div className="w-full max-w-7xl z-10 flex flex-col h-full max-h-[900px]">
        {/* Header */}
        <div className="mb-6 text-center shrink-0">
          <div className="flex items-center justify-center gap-3 mb-2">
             <div className="w-8 h-8 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm">
                <Icons.Target className="w-4 h-4 text-zinc-900" />
             </div>
             <h1 className="text-xl font-bold text-zinc-900 tracking-tight">GTM OS <span className="text-zinc-400 font-mono text-sm">/ SETUP</span></h1>
          </div>
        </div>

        {/* Card Container */}
        <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden flex flex-col relative">
          
          {/* Progress Indicator */}
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100 z-20">
             <div className="h-full bg-zinc-900 transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}></div>
          </div>

          <div className="flex-1 overflow-hidden relative">
          
          {step === 1 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 pb-6 border-b border-zinc-100">
                  <span className="w-8 h-8 rounded bg-zinc-100 text-zinc-900 flex items-center justify-center text-sm font-bold font-mono">01</span>
                  <div>
                      <h2 className="text-xl font-bold text-zinc-900">Campaign Parameters</h2>
                      <p className="text-sm text-zinc-500">Define the scope of this execution cycle.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">Campaign Name</label>
                    <input 
                      value={formData.quarter}
                      onChange={e => actions.setFormData({...formData, quarter: e.target.value})}
                      placeholder="e.g. Q4 2024 Expansion" 
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-zinc-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm placeholder-zinc-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 col-span-2">
                     <div>
                      <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">Start Date</label>
                      <input 
                        type="date"
                        value={formData.startDate}
                        onChange={e => actions.setFormData({...formData, startDate: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                      />
                     </div>
                     <div>
                      <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">End Date</label>
                      <input 
                        type="date"
                        value={formData.endDate}
                        onChange={e => actions.setFormData({...formData, endDate: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                      />
                     </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">North Star Objective</label>
                  <div className="relative">
                      <textarea 
                      value={formData.objective}
                      onChange={e => actions.setFormData({...formData, objective: e.target.value})}
                      placeholder="e.g. Achieve $1M ARR by closing 50 enterprise deals" 
                      className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-zinc-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-lg leading-relaxed placeholder-zinc-400"
                      />
                      <Icons.Target className="absolute bottom-4 right-4 w-5 h-5 text-zinc-300 pointer-events-none" />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
                    <p className="text-zinc-400 text-xs mb-3">Want to try the experimental context-first flow?</p>
                    <button 
                        onClick={onEnableLabMode}
                        className="text-xs font-bold text-purple-600 hover:text-purple-500 flex items-center justify-center gap-2 mx-auto border border-purple-200 bg-purple-50 px-4 py-2 rounded-full transition-all hover:bg-purple-100"
                    >
                        <Icons.Zap className="w-3 h-3" />
                        Switch to AI Lab Mode
                    </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pt-12">
                 <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                   <div className="absolute inset-0 rounded-full bg-purple-100 animate-ping"></div>
                   <Icons.Sparkles className="w-10 h-10 text-purple-600" />
                 </div>
                 
                 <div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-3">Initializing Strategy Engine</h2>
                    <p className="text-zinc-500">Analyzing roadmap and objective parameters...</p>
                 </div>

                 <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-left font-mono text-xs text-zinc-600 space-y-2 max-w-sm mx-auto shadow-sm">
                   <div className="flex justify-between">
                      <span>Target:</span>
                      <span className="text-zinc-900">"{formData.objective.substring(0, 25)}..."</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Roadmap Items:</span>
                      <span className="text-indigo-600">{campaign?.roadmapItems?.length || 0} defined</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Model:</span>
                      <span className="text-purple-600">Gemini 3 Flash</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={loading ? "animate-pulse text-amber-500" : "text-zinc-500"}>{loading ? "PROCESSING..." : "READY"}</span>
                   </div>
                 </div>
                 
                 {!loading && (
                    <button 
                      onClick={actions.handleNext}
                      className="px-8 py-4 bg-zinc-900 text-white rounded-full font-bold hover:scale-105 transition-transform shadow-xl"
                    >
                      Generate Strategy
                    </button>
                 )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pt-12">
                 <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Icons.CheckCircle className="w-10 h-10 text-emerald-600" />
                 </div>
                 
                 <div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-2">System Ready</h2>
                    <p className="text-zinc-500">Campaign structure initialized with {campaign?.channels.length} channels.</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-zinc-50 rounded p-4 border border-zinc-200">
                       <div className="text-2xl font-bold text-zinc-900 font-mono">{campaign?.channels.length}</div>
                       <div className="text-[10px] uppercase text-zinc-400 font-bold">Channels</div>
                    </div>
                    <div className="bg-zinc-50 rounded p-4 border border-zinc-200">
                       <div className="text-2xl font-bold text-zinc-900 font-mono">{campaign?.roadmapItems?.length || 0}</div>
                       <div className="text-[10px] uppercase text-zinc-400 font-bold">Roadmap Items</div>
                    </div>
                 </div>
                 
                 <button 
                    onClick={actions.handleNext}
                    className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg transition-colors shadow-lg"
                  >
                    Enter Command Center
                  </button>
              </div>
            </div>
          )}

          </div>

          {/* Navigation Footer for Wizard Steps */}
          <div className="p-6 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center z-20">
            <button 
              onClick={actions.handleBack}
              disabled={step === 1 || loading}
              className={`text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-2 text-sm font-medium ${step === 1 ? 'opacity-0 cursor-default' : 'opacity-100'}`}
            >
               ← Back
            </button>
            
            {step < 2 && (
              <button 
                onClick={actions.handleNext}
                disabled={(!formData.quarter || !formData.objective) && step === 1}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-md"
              >
                Continue
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* User Persona for Onboarding */}
        <div className="mt-6 flex justify-center items-center gap-2 text-zinc-400 text-xs font-mono shrink-0">
           <span className="opacity-50">INIT_SESSION_USER:</span>
           <div className={`w-2 h-2 rounded-full ${currentUser.color}`}></div>
           <span className="font-bold text-zinc-500">{currentUser.name.toUpperCase()}</span>
        </div>
      </div>

      {/* MODAL OVERLAY - Rendered at root level so it stays visible during step transitions if needed, though usually logic handles it */}
      {showChannelModal && (
          <ChannelSetupModal 
              existingChannels={campaign?.channels || []}
              onComplete={actions.handleChannelSetupComplete}
              onBack={() => actions.setShowChannelModal(false)}
          />
      )}
    </div>
  );
};
