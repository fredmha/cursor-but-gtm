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

const LandingPage: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-zinc-900 relative overflow-hidden">
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" 
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>
            
            <div className="z-10 text-center max-w-2xl px-6 animate-in fade-in zoom-in-95 duration-700">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-zinc-200">
                    <Icons.Target className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-5xl font-bold tracking-tight mb-6 text-zinc-900">GTM Operating System</h1>
                <p className="text-lg text-zinc-500 mb-10 leading-relaxed max-w-lg mx-auto">
                    The modern stack for go-to-market strategy and execution. 
                    Plan campaigns, track bets, and execute with precision.
                </p>
                <button 
                    onClick={onGetStarted}
                    className="px-8 py-4 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 hover:scale-105 transition-all shadow-xl shadow-zinc-200 ring-1 ring-black/5"
                >
                    Get Started
                </button>
            </div>
            
            <div className="absolute bottom-8 text-zinc-400 text-xs font-mono">
                v2.0.0 / Harvey Aesthetic
            </div>
        </div>
    )
}

const MainLayout: React.FC = () => {
  const [view, setView] = useState<ViewMode>('ROADMAP');
  const { campaign, users, currentUser, switchUser, reset } = useStore();
  
  // Feature Flag: Lab Mode
  const [isLabMode, setIsLabMode] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('lab') === 'true') {
            setIsLabMode(true);
        }
    }
  }, []);

  // Landing Page State
  if (!campaign && !isOnboarding) {
      if (isLabMode) return <LabOnboarding />;
      return <LandingPage onGetStarted={() => setIsOnboarding(true)} />;
  }

  // Onboarding State
  if ((!campaign || campaign.status === 'Onboarding') && isOnboarding) {
      if (isLabMode) return <LabOnboarding />;
      return <OnboardingWizard onEnableLabMode={() => setIsLabMode(true)} />;
  }

  return (
    <div className="h-screen w-full flex bg-background text-primary font-sans">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <nav className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
         
         {/* Workspace Header */}
         <div className="h-14 px-4 flex items-center mb-2">
             <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer w-full">
                 <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center shadow-sm">
                     <Icons.Target className="w-3.5 h-3.5 text-white" />
                 </div>
                 <div className="flex flex-col overflow-hidden">
                     <span className="font-semibold text-xs text-zinc-900 leading-none truncate">GTM OS</span>
                     <span className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate max-w-[120px]">{campaign?.name}</span>
                 </div>
                 <Icons.ChevronDown className="w-3 h-3 text-zinc-400 ml-auto" />
             </div>
         </div>

         {/* Navigation Links */}
         <div className="flex-1 px-3 space-y-0.5">
             {(['ROADMAP', 'EXECUTION', 'DOCS', 'REVIEW'] as ViewMode[]).map((v) => {
                 const isActive = view === v;
                 const icons: Record<ViewMode, React.FC<any>> = {
                     'ROADMAP': Icons.Kanban,
                     'EXECUTION': Icons.Zap,
                     'DOCS': Icons.FileText,
                     'REVIEW': Icons.Target,
                     'ONBOARDING': Icons.Sparkles
                 };
                 const Icon = icons[v];
                 
                 return (
                     <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all group ${
                            isActive 
                            ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50' 
                            : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                        }`}
                     >
                         <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                         {v.charAt(0) + v.slice(1).toLowerCase()}
                     </button>
                 );
             })}
         </div>

         {/* User Profile / Footer */}
         <div className="p-3 border-t border-border mt-auto">
             <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer group">
                 <div className="flex items-center gap-2">
                     <div className={`w-6 h-6 rounded-full ${currentUser.color} text-white flex items-center justify-center text-[9px] font-bold shadow-sm`}>
                         {currentUser.initials}
                     </div>
                     <span className="text-xs font-medium text-zinc-700">{currentUser.name}</span>
                 </div>
                 <button onClick={reset} className="text-[10px] text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">Reset</button>
             </div>
             
             {/* Simple User Switcher Row */}
             <div className="flex gap-1 px-2 mt-2">
                 {users.filter(u => u.id !== currentUser.id).map(u => (
                     <button 
                        key={u.id} 
                        onClick={() => switchUser(u.id)}
                        className={`w-5 h-5 rounded-full ${u.color} opacity-30 hover:opacity-100 transition-opacity`}
                        title={`Switch to ${u.name}`}
                     />
                 ))}
             </div>
         </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden bg-background relative">
          {view === 'ROADMAP' && <RoadmapSandbox />}
          {view === 'EXECUTION' && <ExecutionBoard />}
          {view === 'REVIEW' && <ReviewMode />}
          {view === 'DOCS' && <DocsView />}
      </main>

    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;