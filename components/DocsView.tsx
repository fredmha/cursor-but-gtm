import React, { useState } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { DocType, ContextDoc } from '../types';

const DOC_TYPES: { type: DocType, icon: any, label: string }[] = [
    { type: 'STRATEGY', icon: Icons.Target, label: 'Strategy' },
    { type: 'PERSONA', icon: Icons.Circle, label: 'Personas' },
    { type: 'BRAND', icon: Icons.Flag, label: 'Brand' },
    { type: 'PROCESS', icon: Icons.Kanban, label: 'Process' },
];

export const DocsView: React.FC = () => {
  const { campaign, addDoc, updateDoc, deleteDoc, currentUser } = useStore();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<ContextDoc | null>(null);

  const docs = campaign?.docs || [];
  const selectedDoc = docs.find(d => d.id === selectedDocId) || (docs.length > 0 ? docs[0] : null);

  const handleCreateDoc = () => {
      const newDoc: ContextDoc = {
          id: generateId(),
          title: 'Untitled Document',
          content: '# New Document\nStart typing...',
          type: 'STRATEGY',
          lastUpdated: new Date().toISOString(),
          isAiGenerated: false
      };
      addDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setEditingDoc(null); // View mode initially
  };

  const handleSave = () => {
      if (editingDoc) {
          updateDoc(editingDoc.id, {
              title: editingDoc.title,
              content: editingDoc.content,
              lastUpdated: new Date().toISOString()
          });
          setEditingDoc(null);
      }
  };

  return (
    <div className="h-full flex bg-[#09090b] text-zinc-100 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge Base</span>
                <button onClick={handleCreateDoc} className="text-zinc-500 hover:text-white"><Icons.Plus className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-6 custom-scrollbar">
                {DOC_TYPES.map(section => {
                    const sectionDocs = docs.filter(d => d.type === section.type);
                    return (
                        <div key={section.type}>
                            <div className="px-3 mb-2 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                <section.icon className="w-3 h-3" /> {section.label}
                            </div>
                            <div className="space-y-0.5">
                                {sectionDocs.map(doc => (
                                    <div 
                                        key={doc.id}
                                        onClick={() => { setSelectedDocId(doc.id); setEditingDoc(null); }}
                                        className={`px-3 py-2 rounded-lg cursor-pointer text-xs flex items-center justify-between group ${selectedDoc?.id === doc.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900'}`}
                                    >
                                        <span className="truncate">{doc.title}</span>
                                        {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50" />}
                                    </div>
                                ))}
                                {sectionDocs.length === 0 && <div className="px-3 text-[10px] text-zinc-700 italic">Empty</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#09090b]">
            {selectedDoc ? (
                <>
                    {/* Toolbar */}
                    <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/30">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs">
                            <Icons.FileText className="w-4 h-4" />
                            <span>Last edited {new Date(selectedDoc.lastUpdated).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                            {editingDoc ? (
                                <>
                                    <button onClick={() => setEditingDoc(null)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancel</button>
                                    <button onClick={handleSave} className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded">Save Changes</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => deleteDoc(selectedDoc.id)} className="p-2 text-zinc-600 hover:text-red-500"><Icons.Trash className="w-4 h-4"/></button>
                                    <button onClick={() => setEditingDoc(selectedDoc)} className="px-3 py-1.5 border border-zinc-700 text-zinc-300 text-xs font-bold rounded hover:bg-zinc-800">Edit</button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Editor / Viewer */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-w-4xl mx-auto w-full">
                        {editingDoc ? (
                            <div className="space-y-4 h-full flex flex-col">
                                <input 
                                    value={editingDoc.title}
                                    onChange={e => setEditingDoc({...editingDoc, title: e.target.value})}
                                    className="text-3xl font-bold bg-transparent text-white border-none focus:outline-none placeholder-zinc-700"
                                    placeholder="Document Title"
                                />
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-xs text-zinc-500 uppercase font-bold">Type:</span>
                                    <select 
                                        value={editingDoc.type}
                                        onChange={e => setEditingDoc({...editingDoc, type: e.target.value as DocType})}
                                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                                    >
                                        {DOC_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                                    </select>
                                </div>
                                <textarea 
                                    value={editingDoc.content}
                                    onChange={e => setEditingDoc({...editingDoc, content: e.target.value})}
                                    className="flex-1 w-full bg-transparent text-sm text-zinc-300 leading-relaxed font-mono resize-none focus:outline-none placeholder-zinc-800"
                                    placeholder="# Write in markdown..."
                                />
                            </div>
                        ) : (
                            <div className="animate-in fade-in duration-300">
                                <h1 className="text-3xl font-bold text-white mb-6">{selectedDoc.title}</h1>
                                <article className="prose prose-invert prose-zinc max-w-none text-sm text-zinc-300">
                                    {selectedDoc.content.split('\n').map((line, i) => (
                                        <p key={i} className="min-h-[1em]">{line}</p>
                                    ))}
                                </article>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                    <Icons.FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">Select a document to view</p>
                </div>
            )}
        </div>
    </div>
  );
};
