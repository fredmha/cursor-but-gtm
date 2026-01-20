import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import { ExecutionBoard } from './components/ExecutionBoard';
import { ReviewMode } from './components/ReviewMode';
import { OnboardingWizard } from './components/OnboardingWizard';
import { RoadmapSandbox } from './components/RoadmapSandbox';
import { LabOnboarding } from './components/lab/LabOnboarding';
import { DocsView } from './components/DocsView';
import { ViewMode } from './types';
import { Icons } from './constants';

const MainLayout: React.FC = () => {
  const [view, setView] = useState<ViewMode>('ROADMAP');
  const { campaign, users, currentUser, switchUser, reset } = useStore();
  
  // Feature Flag: Lab Mode
  const [isLabMode, setIsLabMode] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('lab') === 'true') {
            setIsLabMode(true);
        }
    }
  }, []);

  if (!campaign || !campaign.name || campaign.status === 'Onboarding') {
     // If Lab Mode active and no campaign, show Lab Onboarding
     if (isLabMode) {
         return <LabOnboarding />;
     }
     return <OnboardingWizard onEnableLabMode={() => setIsLabMode(true)} />;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background text-primary overflow-hidden font-sans">
      {/* Top Nav */}
      <nav className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface z-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-white/10">
              <Icons.Target className="w-4 h-4 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-none">GTM OS</span>
              <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{campaign.name}</span>
            </div>
          </div>
          
          <div className="h-6 w-px bg-border mx-2"></div>
          
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-border">
            {(['ROADMAP', 'EXECUTION', 'DOCS', 'REVIEW'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded text-[11px] font-bold tracking-wide transition-all ${
                  view === v 
                  ? 'bg-zinc-700 text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isLabMode && (
              <span className="text-[10px] font-mono text-purple-500 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 uppercase">
                  Lab Mode
              </span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider mr-1">Impersonate:</span>
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all ${
                  currentUser.id === user.id ? `border-white scale-110 z-10 ${user.color} text-white` : `border-transparent opacity-50 hover:opacity-100 ${user.color} text-white/80`
                }`}
                title={user.name}
              >
                {user.initials}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-zinc-800"></div>
          <button onClick={() => { if(confirm('Reset all data?')) reset(); }} className="text-xs text-zinc-600 hover:text-red-500 transition-colors" title="Hard Reset">
             <Icons.Trash className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'ROADMAP' && <RoadmapSandbox onNext={() => setView('EXECUTION')} />}
        {view === 'EXECUTION' && <ExecutionBoard />}
        {view === 'DOCS' && <DocsView />}
        {view === 'REVIEW' && <ReviewMode />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}