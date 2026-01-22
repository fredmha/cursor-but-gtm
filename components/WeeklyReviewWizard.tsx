

import React, { useState, useMemo, useEffect } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { generateWeeklyActionItems } from '../services/geminiService';
import { TicketStatus, Ticket } from '../types';

interface WeeklyReviewWizardProps {
  onClose: () => void;
}

type Act = 'CLEANSE' | 'BRIEF' | 'DRAFT';

interface GeneratedTicket {
    id: string; // temp id
    title: string;
    description: string;
    contextId: string; // channelId or projectId
    selected: boolean;
}

export const WeeklyReviewWizard: React.FC<WeeklyReviewWizardProps> = ({ onClose }) => {
  const { campaign, addTicket, addDoc, addProjectTicket, currentUser, updateTicket, updateProjectTicket, deleteTicket, deleteProjectTicket } = useStore();
  
  // --- STATE ---
  const [act, setAct] = useState<Act>('CLEANSE');
  
  // Act I: Cleanse
  const [slippageQueue, setSlippageQueue] = useState<Ticket[]>([]);
  const [triageHistory, setTriageHistory] = useState<string[]>([]); // Ticket IDs handled

  // Act II: Brief
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [ethos, setEthos] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Act III: Draft
  const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);


  // --- INITIALIZATION ---
  const allTickets = useMemo(() => {
    return (campaign?.channels || []).flatMap(c => c.tickets).concat((campaign?.projects || []).flatMap(p => p.tickets));
  }, [campaign]);

  const wins = useMemo(() => allTickets.filter(t => t.status === TicketStatus.Done), [allTickets]);
  const velocityScore = useMemo(() => {
      const total = allTickets.length;
      if (total === 0) return 0;
      return Math.round((wins.length / total) * 100);
  }, [allTickets, wins]);

  // Load Slippage on Mount
  useEffect(() => {
    const overdue = allTickets.filter(t => 
        (t.status === TicketStatus.Todo || t.status === TicketStatus.InProgress) && 
        t.dueDate && new Date(t.dueDate) < new Date()
    );
    setSlippageQueue(overdue);
    // Auto-select all contexts initially
    const contexts = [
        ...(campaign?.channels || []).map(c => c.id),
        ...(campaign?.projects || []).map(p => p.id)
    ];
    setSelectedContextIds(contexts);
  }, [campaign]); // Re-run if campaign changes (which happens when we update tickets)


  // --- ACT I: CLEANSE LOGIC ---

  const currentSlippageTicket = slippageQueue.find(t => !triageHistory.includes(t.id));

  const handleTriage = (action: 'DEFER' | 'BACKLOG' | 'KILL') => {
      if (!currentSlippageTicket) return;

      const ticket = currentSlippageTicket;
      const isChannelTicket = !!ticket.channelId;
      const parentId = isChannelTicket ? ticket.channelId! : ticket.projectId!;

      if (action === 'DEFER') {
          // Move to next week (+7 days from now)
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          const updates = { dueDate: nextWeek.toISOString(), status: TicketStatus.Todo }; // Reset status to Todo? Or keep InProgress. Let's keep status unless it's done. Actually let's just update date.
          
          if (isChannelTicket) updateTicket(parentId, ticket.id, updates);
          else updateProjectTicket(parentId, ticket.id, updates);
      } 
      else if (action === 'BACKLOG') {
          // Remove due date, set status Backlog
          const updates = { dueDate: undefined, status: TicketStatus.Backlog };
          if (isChannelTicket) updateTicket(parentId, ticket.id, updates);
          else updateProjectTicket(parentId, ticket.id, updates);
      }
      else if (action === 'KILL') {
          // Delete
          if (isChannelTicket) deleteTicket(parentId, ticket.id);
          else deleteProjectTicket(parentId, ticket.id);
      }

      setTriageHistory(prev => [...prev, ticket.id]);
  };

  // --- ACT II: BRIEF LOGIC ---

  const toggleContext = (id: string) => {
      setSelectedContextIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGeneratePlan = async () => {
    if (!ethos.trim()) return;
    setIsGenerating(true);

    // 1. Snapshot the Strategy (Doc)
    const docTitle = `Weekly Plan - ${new Date().toLocaleDateString()}`;
    addDoc({
      id: generateId(),
      title: docTitle,
      content: `<h1>${docTitle}</h1><h2>The Ethos</h2><p>${ethos}</p><h3>Focus Areas</h3><ul>${selectedContextIds.map(id => {
          const name = campaign?.channels.find(c => c.id === id)?.name || campaign?.projects.find(p => p.id === id)?.name;
          return `<li>${name}</li>`
      }).join('')}</ul>`,
      lastUpdated: new Date().toISOString(),
      isAiGenerated: false,
      folderId: campaign?.docFolders.find(f => f.name === 'Process')?.id, 
      tags: ['Weekly Review']
    });

    // 2. Prepare Context for AI
    const availableContexts = [
        ...(campaign?.channels || []).map(c => ({ id: c.id, name: c.name, type: 'CHANNEL' as const })),
        ...(campaign?.projects || []).map(p => ({ id: p.id, name: p.name, type: 'PROJECT' as const }))
    ].filter(c => selectedContextIds.includes(c.id));

    // 3. Call AI
    const rawSuggestions = await generateWeeklyActionItems(ethos, "Resolved during triage.", availableContexts);

    // 4. Map to State
    setGeneratedTickets(rawSuggestions.map((s: any) => ({
        id: generateId(),
        title: s.title,
        description: s.description,
        contextId: s.contextId, // Expecting AI to return this
        selected: true
    })));

    setIsGenerating(false);
    setAct('DRAFT');
  };

  // --- ACT III: DRAFT LOGIC ---

  const handleFinalize = () => {
      generatedTickets.filter(t => t.selected).forEach(t => {
          const newTicket: Ticket = {
              id: generateId(),
              shortId: `T-${Math.floor(Math.random() * 10000)}`,
              title: t.title,
              description: t.description,
              status: TicketStatus.Todo,
              priority: 'Medium',
              assigneeId: currentUser.id,
              createdAt: new Date().toISOString(),
              channelId: undefined, 
              projectId: undefined
          };

          // Try to find if contextId is channel or project
          const isChannel = campaign?.channels.some(c => c.id === t.contextId);
          const isProject = campaign?.projects.some(p => p.id === t.contextId);

          if (isChannel) {
              addTicket(t.contextId, { ...newTicket, channelId: t.contextId });
          } else if (isProject) {
              addProjectTicket(t.contextId, { ...newTicket, projectId: t.contextId });
          } else {
              // Fallback: Add to first channel
               if (campaign?.channels[0]) {
                   addTicket(campaign.channels[0].id, { ...newTicket, channelId: campaign.channels[0].id });
               }
          }
      });
      onClose();
  };

  // --- RENDER HELPERS ---
  const getContextName = (id: string) => {
      return campaign?.channels.find(c => c.id === id)?.name || campaign?.projects.find(p => p.id === id)?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white animate-in fade-in duration-300 font-sans text-zinc-900">
      
      {/* Header */}
      <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-sm">
             <Icons.Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Weekly Command Center</h2>
            <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <span className={act === 'CLEANSE' ? 'text-zinc-900' : ''}>1. Cleanse</span>
                <span className="text-zinc-300">/</span>
                <span className={act === 'BRIEF' ? 'text-zinc-900' : ''}>2. Brief</span>
                <span className="text-zinc-300">/</span>
                <span className={act === 'DRAFT' ? 'text-zinc-900' : ''}>3. Draft</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
          <Icons.XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 flex flex-col items-center">
        <div className="w-full max-w-4xl py-12 px-6">
          
          {/* --- ACT I: THE CLEANSE --- */}
          {act === 'CLEANSE' && (
              <div className="max-w-2xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <div className="text-center space-y-2">
                      <h1 className="text-3xl font-bold tracking-tight">Let's clear the decks.</h1>
                      <p className="text-zinc-500">Review last week's velocity and resolve slippage to start fresh.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-2">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Velocity Score</span>
                          <span className="text-5xl font-bold text-zinc-900">{velocityScore}%</span>
                          <span className="text-sm text-zinc-500">{wins.length} Tickets Shipped</span>
                      </div>
                      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-2">
                           <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Slippage</span>
                           <span className={`text-5xl font-bold ${slippageQueue.length - triageHistory.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                               {slippageQueue.length - triageHistory.length}
                           </span>
                           <span className="text-sm text-zinc-500">Overdue Items</span>
                      </div>
                  </div>

                  {currentSlippageTicket ? (
                      <div className="relative">
                          <div className="absolute -inset-1 bg-zinc-200/50 rounded-2xl rotate-1"></div>
                          <div className="relative bg-white border border-zinc-200 rounded-xl p-8 shadow-xl">
                              <div className="flex justify-between items-start mb-6">
                                  <div className="space-y-1">
                                      <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-full uppercase tracking-wider">Overdue</span>
                                      <h3 className="text-xl font-bold text-zinc-900">{currentSlippageTicket.title}</h3>
                                  </div>
                                  <span className="text-xs font-mono text-zinc-400">{currentSlippageTicket.shortId}</span>
                              </div>
                              <p className="text-zinc-600 text-sm mb-8 line-clamp-3">{currentSlippageTicket.description || 'No description provided.'}</p>
                              
                              <div className="grid grid-cols-3 gap-3">
                                  <button onClick={() => handleTriage('DEFER')} className="py-3 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 font-bold text-sm rounded-lg border border-zinc-200 transition-colors">
                                      Defer (Next Fri)
                                  </button>
                                  <button onClick={() => handleTriage('BACKLOG')} className="py-3 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 font-bold text-sm rounded-lg border border-zinc-200 transition-colors">
                                      Demote to Backlog
                                  </button>
                                  <button onClick={() => handleTriage('KILL')} className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-lg border border-red-100 transition-colors">
                                      Kill Task
                                  </button>
                              </div>
                          </div>
                          <p className="text-center text-xs text-zinc-400 mt-4">{slippageQueue.length - triageHistory.length - 1} more to review</p>
                      </div>
                  ) : (
                      <div className="text-center py-12">
                          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Icons.CheckCircle className="w-8 h-8 text-emerald-600" />
                          </div>
                          <h3 className="text-xl font-bold text-zinc-900 mb-2">Slippage Resolved</h3>
                          <p className="text-zinc-500 mb-8">You are ready to plan the next cycle.</p>
                          <button 
                            onClick={() => setAct('BRIEF')}
                            className="px-8 py-3 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-all shadow-lg"
                          >
                            Proceed to Strategy &rarr;
                          </button>
                      </div>
                  )}
              </div>
          )}

          {/* --- ACT II: THE BRIEF --- */}
          {act === 'BRIEF' && (
              <div className="max-w-2xl mx-auto space-y-10 animate-in slide-in-from-right-4 fade-in duration-500">
                  <div className="text-center space-y-2">
                      <h1 className="text-3xl font-bold tracking-tight">What are we hunting?</h1>
                      <p className="text-zinc-500">Define the focus for the week.</p>
                  </div>

                  {/* Context Selector */}
                  <div className="space-y-3">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block text-center">Active Contexts</label>
                      <div className="flex flex-wrap justify-center gap-2">
                          {[...(campaign?.projects || []), ...(campaign?.channels || [])].map((item) => {
                              const isSelected = selectedContextIds.includes(item.id);
                              return (
                                  <button
                                    key={item.id}
                                    onClick={() => toggleContext(item.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                        isSelected 
                                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' 
                                        : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                                    }`}
                                  >
                                      {/* @ts-ignore - 'type' field check */}
                                      {item.type === 'PROJECT' ? '🎯' : '⚡️'} {item.name}
                                  </button>
                              )
                          })}
                      </div>
                  </div>

                  {/* Ethos Input */}
                  <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
                      <textarea 
                          className="w-full h-40 p-6 text-lg text-zinc-800 placeholder-zinc-300 resize-none focus:outline-none rounded-lg"
                          placeholder="What is the single governing theme? e.g. 'Fix the churn issue by pausing new features and doubling down on reliability.'"
                          value={ethos}
                          onChange={e => setEthos(e.target.value)}
                          autoFocus
                      />
                  </div>

                  <div className="flex justify-between items-center pt-4">
                      <button onClick={() => setAct('CLEANSE')} className="text-zinc-400 hover:text-zinc-600 text-sm font-bold">Back</button>
                      <button 
                          onClick={handleGeneratePlan}
                          disabled={!ethos.trim() || isGenerating}
                          className="px-8 py-3 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                      >
                          {isGenerating ? (
                              <>Processing...</>
                          ) : (
                              <>Generate Plan <Icons.Sparkles className="w-4 h-4 text-purple-400" /></>
                          )}
                      </button>
                  </div>
              </div>
          )}

          {/* --- ACT III: THE DRAFT --- */}
          {act === 'DRAFT' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-500">
                   <div className="text-center space-y-2 mb-8">
                      <h1 className="text-3xl font-bold tracking-tight">Tactical Plan</h1>
                      <p className="text-zinc-500">Review and approve the generated tickets.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Render columns by Context */}
                      {Array.from(new Set(generatedTickets.map(t => t.contextId))).map((ctxId: string) => {
                          const ctxName = getContextName(ctxId);
                          const items = generatedTickets.filter(t => t.contextId === ctxId);
                          
                          return (
                              <div key={ctxId} className="space-y-4">
                                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                                      <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">{ctxName}</span>
                                      <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">{items.length}</span>
                                  </div>
                                  <div className="space-y-3">
                                      {items.map(t => (
                                          <div key={t.id} className={`bg-white border p-4 rounded-lg shadow-sm transition-all ${t.selected ? 'border-zinc-200' : 'opacity-50 border-zinc-100'}`}>
                                               <div className="flex justify-between items-start mb-2">
                                                   <input 
                                                      type="checkbox"
                                                      checked={t.selected}
                                                      onChange={e => {
                                                          setGeneratedTickets(prev => prev.map(pt => pt.id === t.id ? {...pt, selected: e.target.checked} : pt));
                                                      }}
                                                      className="mt-1 w-4 h-4 accent-zinc-900"
                                                   />
                                               </div>
                                               <input 
                                                  value={t.title}
                                                  onChange={e => setGeneratedTickets(prev => prev.map(pt => pt.id === t.id ? {...pt, title: e.target.value} : pt))}
                                                  className="w-full text-sm font-bold text-zinc-900 bg-transparent border-none p-0 focus:ring-0 mb-1"
                                               />
                                               <textarea 
                                                  value={t.description}
                                                  onChange={e => setGeneratedTickets(prev => prev.map(pt => pt.id === t.id ? {...pt, description: e.target.value} : pt))}
                                                  className="w-full text-xs text-zinc-500 bg-transparent border-none p-0 focus:ring-0 resize-none"
                                                  rows={2}
                                               />
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )
                      })}
                  </div>

                  <div className="flex justify-between items-center pt-8 border-t border-zinc-100">
                      <button onClick={() => setAct('BRIEF')} className="text-zinc-400 hover:text-zinc-600 text-sm font-bold">Back to Strategy</button>
                      <button 
                          onClick={handleFinalize}
                          className="px-8 py-3 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-all shadow-lg"
                      >
                          Finalize Plan ({generatedTickets.filter(t => t.selected).length} Tickets)
                      </button>
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};
