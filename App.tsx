
import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore, generateId } from './store';
import { ExecutionBoard } from './components/ExecutionBoard';
import { ReviewMode } from './components/ReviewMode';
import { RoadmapSandbox } from './components/RoadmapSandbox';
import { DocsView } from './components/DocsView';
import { SettingsView } from './components/SettingsView';
import { ViewMode, Campaign } from './types';
import { Icons } from './constants';

const MainLayout: React.FC = () => {
  const { campaign, setCampaign, users, currentUser, switchUser, reset, currentView, setCurrentView } = useStore();

  const handleInitialize = () => {
      const newCampaign: Campaign = {
          id: generateId(),
          name: 'New Strategy',
          objective: '',
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
          status: 'Active',
          channels: [],
          projects: [],
          principles: [],
          roadmapItems: [],
          timelineTags: [],
          docFolders: [
            { id: 'f_strategy', name: 'Strategy', icon: '♟️', order: 1000, createdAt: new Date().toISOString() },
            { id: 'f_personas', name: 'Personas', icon: '👥', order: 2000, createdAt: new Date().toISOString() },
            { id: 'f_brand', name: 'Brand', icon: '🎨', order: 3000, createdAt: new Date().toISOString() },
            { id: 'f_process', name: 'Process', icon: '⚙️', order: 4000, createdAt: new Date().toISOString() },
          ],
          docs: [],
          recentDocIds: [],
          availableTags: ['Q1', 'Q2', 'Urgent', 'Draft']
      };
      setCampaign(newCampaign);
  };

  // Blank Slate / Initialization View
  if (!campaign) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-zinc-900 relative overflow-hidden font-sans">
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" 
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>
            
            <div className="z-10 text-center max-w-lg px-6 animate-in fade-in zoom-in-95 duration-700">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-zinc-200">
                    <Icons.Target className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-4 text-zinc-900">GTM Operating System</h1>
                <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
                    Initialize a blank workspace to begin planning your campaign.
                </p>
                <button 
                    onClick={handleInitialize}
                    className="px-8 py-3 bg-zinc-900 text-white rounded-lg font-bold text-sm hover:bg-zinc-800 hover:scale-105 transition-all shadow-xl shadow-zinc-200"
                >
                    Initialize Workspace
                </button>
            </div>
        </div>
      );
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
                 const isActive = currentView === v;
                 const icons: Record<ViewMode, React.FC<any>> = {
                     'ROADMAP': Icons.Kanban,
                     'EXECUTION': Icons.Zap,
                     'DOCS': Icons.FileText,
                     'REVIEW': Icons.Target,
                     'ONBOARDING': Icons.Sparkles,
                     'SETTINGS': Icons.Settings
                 };
                 const Icon = icons[v];
                 
                 return (
                     <button
                        key={v}
                        onClick={() => setCurrentView(v)}
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
             
             {/* Settings Link */}
             <button
                onClick={() => setCurrentView('SETTINGS')}
                className={`w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-md text-sm transition-all group ${
                    currentView === 'SETTINGS'
                    ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50' 
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
             >
                 <Icons.Settings className={`w-4 h-4 ${currentView === 'SETTINGS' ? 'text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                 Settings
             </button>

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
          {currentView === 'ROADMAP' && <RoadmapSandbox />}
          {currentView === 'EXECUTION' && <ExecutionBoard />}
          {currentView === 'REVIEW' && <ReviewMode />}
          {currentView === 'DOCS' && <DocsView />}
          {currentView === 'SETTINGS' && <SettingsView />}
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

