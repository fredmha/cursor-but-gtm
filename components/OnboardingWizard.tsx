import React from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import { PrinciplesCanvas } from './PrinciplesCanvas';
import { RoadmapSandbox } from './RoadmapSandbox';
import { Icons } from '../constants';
import { useStore } from '../store';

export const OnboardingWizard: React.FC = () => {
  const { state, actions } = useOnboarding();
  const { currentUser } = useStore();

  const { step, loading, formData, buckets, editingBucket, tempBucketName, principlesByCategory, campaign } = state;
  
  const TOTAL_STEPS = 5;

  // --- STEP 2: OPERATING PRINCIPLES (Full Screen) ---
  if (step === 2) {
    return (
      <div className="fixed inset-0 bg-[#09090b] flex flex-col z-50 font-sans text-zinc-100 selection:bg-pink-500/30 animate-in fade-in duration-500">
        
        {/* Minimal Top Bar */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#09090b]/50 backdrop-blur-xl fixed top-0 left-0 right-0 z-40">
           <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                 <Icons.Target className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                 <span className="text-zinc-500">Setup</span>
                 <span className="text-zinc-700">/</span>
                 <span className="text-white">Operating Principles</span>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-mono text-zinc-600 tracking-wider">Session Active</span>
              <div className={`w-2 h-2 rounded-full ${currentUser.color} shadow-[0_0_10px_currentColor]`}></div>
           </div>
        </header>

        {/* Main Canvas Area */}
        <div className="flex-1 pt-14 pb-0 overflow-hidden relative">
           <PrinciplesCanvas 
               buckets={buckets}
               principlesByCategory={principlesByCategory}
               editingBucket={editingBucket}
               tempBucketName={tempBucketName}
               actions={actions}
             />
        </div>

        {/* Floating Navigation Dock */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
           <div className="flex items-center gap-1 p-1.5 bg-[#18181b] border border-zinc-800 rounded-full shadow-2xl shadow-black/50 backdrop-blur-md">
              <button 
                onClick={actions.handleBack}
                className="px-6 py-2.5 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2"
              >
                <span className="text-xs">←</span> Back
              </button>
              
              <div className="w-px h-4 bg-zinc-800 mx-1"></div>
              
              <button 
                onClick={actions.handleNext}
                className="px-8 py-2.5 rounded-full text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Continue <Icons.ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>

        {/* Background Ambient Effects */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#09090b] to-transparent pointer-events-none z-30"></div>
      </div>
    );
  }

  // --- STEP 3: ROADMAP SANDBOX (Full Screen) ---
  if (step === 3) {
      return (
          <RoadmapSandbox onNext={actions.handleNext} onBack={actions.handleBack} />
      );
  }

  // --- WIZARD CARD MODE (Step 1, 4, 5) ---
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
      
      <div className="w-full max-w-7xl z-10 flex flex-col h-full max-h-[900px]">
        {/* Header */}
        <div className="mb-6 text-center shrink-0">
          <div className="flex items-center justify-center gap-3 mb-2">
             <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center shadow-lg">
                <Icons.Target className="w-4 h-4 text-indigo-500" />
             </div>
             <h1 className="text-xl font-bold text-white tracking-tight">GTM OS <span className="text-zinc-600 font-mono text-sm">/ SETUP</span></h1>
          </div>
        </div>

        {/* Card Container */}
        <div className="flex-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
          
          {/* Progress Indicator */}
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900 z-20">
             <div className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}></div>
          </div>

          <div className="flex-1 overflow-hidden relative">
          
          {step === 1 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 pb-6 border-b border-border">
                  <span className="w-8 h-8 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-sm font-bold font-mono">01</span>
                  <div>
                      <h2 className="text-xl font-bold text-white">Campaign Parameters</h2>
                      <p className="text-sm text-secondary">Define the scope of this execution cycle.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-mono uppercase text-secondary mb-2">Campaign Name</label>
                    <input 
                      value={formData.quarter}
                      onChange={e => actions.setFormData({...formData, quarter: e.target.value})}
                      placeholder="e.g. Q4 2024 Expansion" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 col-span-2">
                     <div>
                      <label className="block text-xs font-mono uppercase text-secondary mb-2">Start Date</label>
                      <input 
                        type="date"
                        value={formData.startDate}
                        onChange={e => actions.setFormData({...formData, startDate: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
                      />
                     </div>
                     <div>
                      <label className="block text-xs font-mono uppercase text-secondary mb-2">End Date</label>
                      <input 
                        type="date"
                        value={formData.endDate}
                        onChange={e => actions.setFormData({...formData, endDate: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
                      />
                     </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-secondary mb-2">North Star Objective</label>
                  <div className="relative">
                      <textarea 
                      value={formData.objective}
                      onChange={e => actions.setFormData({...formData, objective: e.target.value})}
                      placeholder="e.g. Achieve $1M ARR by closing 50 enterprise deals" 
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-lg leading-relaxed"
                      />
                      <Icons.Target className="absolute bottom-4 right-4 w-5 h-5 text-zinc-700 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pt-12">
                 <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                   <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping"></div>
                   <Icons.Sparkles className="w-10 h-10 text-purple-500" />
                 </div>
                 
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-3">Initializing Strategy Engine</h2>
                    <p className="text-zinc-400">Analyzing roadmap and objective parameters...</p>
                 </div>

                 <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 text-left font-mono text-xs text-zinc-500 space-y-2 max-w-sm mx-auto">
                   <div className="flex justify-between">
                      <span>Target:</span>
                      <span className="text-zinc-300">"{formData.objective.substring(0, 25)}..."</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Roadmap Items:</span>
                      <span className="text-indigo-400">{campaign?.roadmapItems?.length || 0} defined</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Model:</span>
                      <span className="text-purple-400">Gemini 3 Flash</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={loading ? "animate-pulse text-yellow-500" : "text-zinc-500"}>{loading ? "PROCESSING..." : "READY"}</span>
                   </div>
                 </div>
                 
                 {!loading && (
                    <button 
                      onClick={actions.handleNext}
                      className="px-8 py-4 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform shadow-xl shadow-purple-900/20"
                    >
                      Generate Strategy
                    </button>
                 )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pt-12">
                 <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Icons.CheckCircle className="w-10 h-10 text-emerald-500" />
                 </div>
                 
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-2">System Ready</h2>
                    <p className="text-zinc-400">Campaign structure initialized with {campaign?.channels.length} channels.</p>
                 </div>

                 <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-zinc-900 rounded p-4 border border-zinc-800">
                       <div className="text-2xl font-bold text-white font-mono">{campaign?.channels.length}</div>
                       <div className="text-[10px] uppercase text-zinc-500 font-bold">Channels</div>
                    </div>
                    <div className="bg-zinc-900 rounded p-4 border border-zinc-800">
                       <div className="text-2xl font-bold text-white font-mono">{campaign?.roadmapItems?.length || 0}</div>
                       <div className="text-[10px] uppercase text-zinc-500 font-bold">Roadmap Items</div>
                    </div>
                    <div className="bg-zinc-900 rounded p-4 border border-zinc-800">
                       <div className="text-2xl font-bold text-white font-mono">{formData.principles.length}</div>
                       <div className="text-[10px] uppercase text-zinc-500 font-bold">Rules</div>
                    </div>
                 </div>
                 
                 <button 
                    onClick={actions.handleNext}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
                  >
                    Enter Command Center
                  </button>
              </div>
            </div>
          )}

          </div>

          {/* Navigation Footer for Wizard Steps */}
          <div className="p-6 border-t border-border bg-surface flex justify-between items-center z-20">
            <button 
              onClick={actions.handleBack}
              disabled={step === 1 || loading}
              className={`text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium ${step === 1 ? 'opacity-0 cursor-default' : 'opacity-100'}`}
            >
               ← Back
            </button>
            
            {step < 3 && (
              <button 
                onClick={actions.handleNext}
                disabled={(!formData.quarter || !formData.objective) && step === 1}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Continue
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* User Persona for Onboarding */}
        <div className="mt-6 flex justify-center items-center gap-2 text-zinc-600 text-xs font-mono shrink-0">
           <span className="opacity-50">INIT_SESSION_USER:</span>
           <div className={`w-2 h-2 rounded-full ${currentUser.color}`}></div>
           <span className="font-bold text-zinc-500">{currentUser.name.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};