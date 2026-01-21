import React from 'react';
import { Icons } from '../constants';
import { OperatingPrinciple } from '../types';

interface PrinciplesCanvasProps {
  buckets: string[];
  principlesByCategory: Record<string, OperatingPrinciple[]>;
  editingBucket: string | null;
  tempBucketName: string;
  actions: {
    addBucket: () => void;
    deleteBucket: (bucket: string) => void;
    setEditingBucket: (bucket: string | null) => void;
    setTempBucketName: (name: string) => void;
    renameBucket: (oldName: string) => void;
    handleDragStart: (e: React.DragEvent, id: string) => void;
    handleDrop: (e: React.DragEvent, bucket: string) => void;
    removePrinciple: (id: string) => void;
    updatePrinciple: (id: string, updates: Partial<OperatingPrinciple>) => void;
    addPrinciple: (bucket: string) => void;
  };
}

export const PrinciplesCanvas: React.FC<PrinciplesCanvasProps> = ({
  buckets,
  principlesByCategory,
  editingBucket,
  tempBucketName,
  actions
}) => {
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50">
      
      {/* Canvas Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-8 relative">
          {/* Subtle Grid Background (Dots) */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(#a1a1aa 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}>
          </div>
          
          <div className="flex gap-8 h-full min-w-max pb-4 px-4 relative z-10">
              {buckets.map((bucket) => (
                  <div 
                    key={bucket} 
                    className="w-80 flex flex-col h-full bg-zinc-100/50 rounded-xl border border-zinc-200/50 hover:border-zinc-300 transition-colors group shadow-sm"
                    onDragOver={handleDragOver}
                    onDrop={(e) => actions.handleDrop(e, bucket)}
                  >
                    {/* Bucket Header */}
                    <div className="p-4 border-b border-zinc-200 flex justify-between items-center rounded-t-xl bg-white/50 backdrop-blur-sm group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0"></div>
                            
                            {editingBucket === bucket ? (
                              <input 
                                  autoFocus
                                  className="bg-white text-zinc-900 font-mono font-bold text-xs uppercase tracking-wider border border-pink-500/50 rounded px-1.5 py-0.5 w-full focus:outline-none"
                                  value={tempBucketName}
                                  onChange={(e) => actions.setTempBucketName(e.target.value)}
                                  onBlur={() => actions.renameBucket(bucket)}
                                  onKeyDown={(e) => e.key === 'Enter' && actions.renameBucket(bucket)}
                              />
                            ) : (
                              <span 
                                  className="font-mono font-bold text-xs text-zinc-500 tracking-wider cursor-pointer hover:text-zinc-900 truncate uppercase select-none transition-colors"
                                  onDoubleClick={() => { 
                                    actions.setEditingBucket(bucket); 
                                    actions.setTempBucketName(bucket); 
                                  }}
                              >
                                  {bucket}
                              </span>
                            )}
                            
                            <span className="text-zinc-400 text-[10px] font-mono shrink-0">
                              {principlesByCategory[bucket]?.length || 0}
                            </span>
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.deleteBucket(bucket);
                              }}
                              className="p-1.5 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500 transition-colors"
                              title="Delete Bucket"
                            >
                                <Icons.XCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Drop Zone / List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {principlesByCategory[bucket]?.map((principle) => (
                            <div
                                key={principle.id}
                                draggable
                                onDragStart={(e) => actions.handleDragStart(e, principle.id)}
                                className={`bg-white border border-zinc-200 hover:border-zinc-300 p-4 rounded-lg shadow-sm cursor-move active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all relative group/card ${!principle.title && 'animate-pulse ring-1 ring-pink-500/30'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-zinc-400 group-hover/card:text-zinc-500 transition-colors">
                                        <Icons.GripVertical className="w-3 h-3" />
                                    </div>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        actions.removePrinciple(principle.id);
                                      }}
                                      className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 hover:bg-zinc-50 rounded"
                                      title="Delete Card"
                                    >
                                        <Icons.XCircle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                
                                <input 
                                  value={principle.title}
                                  onChange={(e) => actions.updatePrinciple(principle.id, { title: e.target.value })}
                                  className="w-full bg-transparent text-sm font-semibold text-zinc-800 font-sans mb-1.5 focus:outline-none focus:text-pink-600 placeholder-zinc-300"
                                  placeholder="Principle Title..."
                                  autoFocus={!principle.title}
                                />
                                
                                <textarea 
                                  value={principle.description}
                                  onChange={(e) => actions.updatePrinciple(principle.id, { description: e.target.value })}
                                  className="w-full bg-transparent text-[11px] text-zinc-500 font-mono resize-none focus:outline-none focus:text-zinc-700 placeholder-zinc-300 leading-relaxed overflow-hidden h-auto"
                                  placeholder="Add context..."
                                  rows={3}
                                />
                            </div>
                        ))}
                        
                        {/* Quick Add */}
                        <button 
                          onClick={() => actions.addPrinciple(bucket)}
                          className="w-full h-9 rounded-lg border border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-white flex items-center justify-center gap-2 text-zinc-400 hover:text-zinc-600 transition-all group/add mt-2 bg-transparent"
                        >
                            <Icons.Plus className="w-3.5 h-3.5 group-hover/add:scale-110 transition-transform" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wide">Add Card</span>
                        </button>
                    </div>
                  </div>
              ))}

              {/* Add Bucket Column */}
              <div className="w-80 h-full flex flex-col pt-0 opacity-60 hover:opacity-100 transition-opacity">
                  <button 
                      onClick={actions.addBucket} 
                      className="w-full h-12 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 hover:text-zinc-600 text-zinc-400 flex items-center justify-center gap-2 transition-all hover:bg-white"
                  >
                      <Icons.Plus className="w-4 h-4" />
                      <span className="font-mono text-xs font-bold uppercase tracking-widest">New Group</span>
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};