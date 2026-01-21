
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { ContextDoc, DocFolder, TicketStatus } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { ICP_TEMPLATE, EMAIL_SEQUENCE_TEMPLATE, LINKEDIN_POST_TEMPLATE, REDDIT_POST_TEMPLATE, POSITIONING_MATRIX_TEMPLATE, SEO_BLOG_POST_TEMPLATE } from '../templates';
import { TicketModal } from './TicketModal';

export const DocsView: React.FC = () => {
  const { campaign, addDoc, updateDoc, deleteDoc, addDocFolder, updateDocFolder, deleteDocFolder, moveDoc, addTicket, addCampaignTag, users } = useStore();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<ContextDoc | null>(null);
  
  // Folder Management State
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderData, setRenamingFolderData] = useState<{name: string, icon: string}>({ name: '', icon: '' });

  // Sorting
  const [sortOrder, setSortOrder] = useState<'NAME' | 'DATE'>('NAME');

  // Template Menu State
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  
  // Ticket Modal State
  const [showTicketModal, setShowTicketModal] = useState(false);
  
  // Tag Creation
  const [newTagInput, setNewTagInput] = useState('');

  const docs = campaign?.docs || [];
  const folders = campaign?.docFolders || [];
  const channels = campaign?.channels || [];
  const availableTags = campaign?.availableTags || ['Draft', 'Q4', 'Urgent', 'Review'];
  
  const sortedFolders = useMemo(() => {
      return [...folders].sort((a, b) => {
          if (sortOrder === 'NAME') return a.name.localeCompare(b.name);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [folders, sortOrder]);

  const unsortedDocs = docs.filter(d => !d.folderId);
  const folderDocs = sortedFolders.map(f => ({
      ...f,
      docs: docs.filter(d => d.folderId === f.id).sort((a, b) => a.title.localeCompare(b.title))
  }));

  const selectedDoc = docs.find(d => d.id === selectedDocId);

  const handleCreateDoc = (folderId?: string) => {
      const newDoc: ContextDoc = {
          id: generateId(),
          title: 'Untitled Document',
          content: '<h1>New Document</h1><p>Start typing...</p>',
          folderId: folderId,
          lastUpdated: new Date().toISOString(),
          isAiGenerated: false,
          tags: []
      };
      addDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setEditingDoc(null); // View mode initially
  };

  const handleCreateFromTemplate = (templateContent: string, title: string, folderId?: string) => {
      const newDoc: ContextDoc = {
          id: generateId(),
          title: title,
          content: templateContent,
          folderId: folderId,
          lastUpdated: new Date().toISOString(),
          isAiGenerated: false,
          tags: ['Draft']
      };
      addDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setEditingDoc(null);
      setShowTemplateMenu(false);
  };

  const handleSave = () => {
      if (editingDoc) {
          updateDoc(editingDoc.id, {
              title: editingDoc.title,
              content: editingDoc.content,
              channelId: editingDoc.channelId,
              tags: editingDoc.tags,
              lastUpdated: new Date().toISOString()
          });
          setEditingDoc(null);
      }
  };

  const handleAddFolder = () => {
      if (newFolderName.trim()) {
          addDocFolder(newFolderName.trim(), newFolderIcon);
          setNewFolderName('');
          setNewFolderIcon('📁');
          setCreatingFolder(false);
      }
  };

  const handleRenameFolder = (id: string) => {
      if (renamingFolderData.name.trim()) {
          updateDocFolder(id, renamingFolderData);
          setRenamingFolderId(null);
      }
  };

  const handleCreateTicketFromDoc = (data: any) => {
      if (!selectedDoc) return;
      const ticketId = generateId();
      
      const ticket = {
          id: ticketId,
          shortId: `T-${Math.floor(Math.random() * 1000)}`,
          title: data.title,
          description: data.description,
          status: TicketStatus.Todo,
          priority: data.priority,
          assigneeId: data.assigneeId,
          channelId: data.channelId,
          projectId: data.projectId,
          createdAt: new Date().toISOString(),
          linkedDocIds: [selectedDoc.id, ...(data.linkedDocIds || [])]
      };
      
      addTicket(data.channelId || '', ticket);
      setShowTicketModal(false);
  };
  
  const toggleTag = (tag: string) => {
      if (!editingDoc) return;
      const tags = editingDoc.tags || [];
      if (tags.includes(tag)) {
          setEditingDoc({...editingDoc, tags: tags.filter(t => t !== tag)});
      } else {
          setEditingDoc({...editingDoc, tags: [...tags, tag]});
      }
  };
  
  const handleCreateTag = () => {
      if (newTagInput.trim()) {
          const tag = newTagInput.trim();
          addCampaignTag(tag);
          toggleTag(tag); // Auto-add to doc
          setNewTagInput('');
      }
  };

  return (
    <div className="h-full flex bg-white text-zinc-900 overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-64 border-r border-zinc-100 flex flex-col bg-zinc-50/50 shrink-0">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center relative">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge Base</span>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'NAME' ? 'DATE' : 'NAME')}
                        className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider hover:text-zinc-600"
                        title="Toggle Sort"
                    >
                        {sortOrder === 'NAME' ? '(A-Z)' : '(Newest)'}
                    </button>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setCreatingFolder(true)} className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded" title="New Folder">
                        <Icons.Plus className="w-4 h-4" />
                    </button>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)} 
                            className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" 
                            title="Create from Template"
                        >
                            <Icons.Layout className="w-4 h-4" />
                        </button>
                        
                        {showTemplateMenu && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-zinc-100 shadow-xl rounded-lg z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 border-b border-zinc-50 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    New Document
                                </div>
                                <button 
                                    onClick={() => { handleCreateDoc(); setShowTemplateMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.FileText className="w-3.5 h-3.5" /> Blank Document
                                </button>
                                <div className="px-3 py-2 border-b border-zinc-50 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                                    Templates
                                </div>
                                <button 
                                    onClick={() => handleCreateFromTemplate(ICP_TEMPLATE, 'Ideal Customer Profile')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-indigo-500" /> ICP Definition
                                </button>
                                <button 
                                    onClick={() => handleCreateFromTemplate(EMAIL_SEQUENCE_TEMPLATE, 'Cold Email Sequence')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-emerald-500" /> Email Sequence
                                </button>
                                <button 
                                    onClick={() => handleCreateFromTemplate(LINKEDIN_POST_TEMPLATE, 'LinkedIn Post')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-blue-500" /> LinkedIn Post
                                </button>
                                <button 
                                    onClick={() => handleCreateFromTemplate(REDDIT_POST_TEMPLATE, 'Reddit Post')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-orange-500" /> Reddit Post
                                </button>
                                <button 
                                    onClick={() => handleCreateFromTemplate(POSITIONING_MATRIX_TEMPLATE, 'Positioning Matrix')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-purple-500" /> Positioning Matrix
                                </button>
                                <button 
                                    onClick={() => handleCreateFromTemplate(SEO_BLOG_POST_TEMPLATE, 'SEO Blog Post')}
                                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 flex items-center gap-2"
                                >
                                    <Icons.Circle className="w-3.5 h-3.5 text-amber-500" /> SEO Blog Post
                                </button>
                                
                                {/* Overlay to close menu on outside click */}
                                <div className="fixed inset-0 z-[-1]" onClick={() => setShowTemplateMenu(false)}></div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => handleCreateDoc()} className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded" title="Quick New Doc">
                        <Icons.Edit className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                
                {/* New Folder Input */}
                {creatingFolder && (
                    <div className="flex items-center gap-2 px-2 mb-2">
                        <input 
                            className="w-6 text-center border border-zinc-200 rounded text-xs py-1 focus:outline-none"
                            value={newFolderIcon}
                            onChange={e => setNewFolderIcon(e.target.value)}
                            maxLength={2}
                        />
                        <input 
                            autoFocus
                            className="bg-white border border-zinc-200 rounded text-xs px-2 py-1 w-full focus:outline-none focus:border-indigo-500"
                            placeholder="Folder Name"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddFolder()}
                            onBlur={() => setCreatingFolder(false)}
                        />
                    </div>
                )}

                {/* Folders List */}
                {folderDocs.map(folder => (
                    <div key={folder.id}>
                        <div className="group flex items-center justify-between px-2 py-1 mb-1 rounded hover:bg-zinc-100 cursor-default">
                            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 tracking-wide">
                                {renamingFolderId === folder.id ? (
                                    <>
                                        <input 
                                            className="w-6 text-center border border-zinc-200 rounded text-xs py-0.5 focus:outline-none"
                                            value={renamingFolderData.icon}
                                            onChange={e => setRenamingFolderData({...renamingFolderData, icon: e.target.value})}
                                            maxLength={2}
                                        />
                                        <input 
                                            autoFocus
                                            className="bg-white border border-zinc-200 rounded text-xs px-1 py-0.5 w-24 focus:outline-none"
                                            value={renamingFolderData.name}
                                            onChange={e => setRenamingFolderData({...renamingFolderData, name: e.target.value})}
                                            onKeyDown={e => e.key === 'Enter' && handleRenameFolder(folder.id)}
                                            onBlur={() => setRenamingFolderId(null)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </>
                                ) : (
                                    <div 
                                        className="flex items-center gap-2 cursor-pointer"
                                        onDoubleClick={() => { 
                                            setRenamingFolderId(folder.id); 
                                            setRenamingFolderData({ name: folder.name, icon: folder.icon || '📁' }); 
                                        }}
                                    >
                                        <span className="opacity-80">{folder.icon || '📁'}</span>
                                        <span className="uppercase tracking-wider">{folder.name}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleCreateDoc(folder.id)} className="text-zinc-400 hover:text-zinc-900"><Icons.Plus className="w-3 h-3"/></button>
                                <button onClick={() => { if(confirm('Delete folder? Docs will move to Unsorted.')) deleteDocFolder(folder.id) }} className="text-zinc-400 hover:text-red-500"><Icons.Trash className="w-3 h-3"/></button>
                            </div>
                        </div>
                        <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3">
                            {folder.docs.map(doc => (
                                <div 
                                    key={doc.id}
                                    onClick={() => { setSelectedDocId(doc.id); setEditingDoc(null); }}
                                    className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                >
                                    <span className="truncate">{doc.title}</span>
                                    {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50" />}
                                </div>
                            ))}
                            {folder.docs.length === 0 && <div className="px-3 text-[10px] text-zinc-300 italic">Empty</div>}
                        </div>
                    </div>
                ))}

                {/* Unsorted */}
                <div>
                    <div className="px-2 py-1 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Icons.FileText className="w-3 h-3" /> Unsorted
                    </div>
                    <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3">
                        {unsortedDocs.map(doc => (
                            <div 
                                key={doc.id}
                                onClick={() => { setSelectedDocId(doc.id); setEditingDoc(null); }}
                                className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                            >
                                <span className="truncate">{doc.title}</span>
                                {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50" />}
                            </div>
                        ))}
                        {unsortedDocs.length === 0 && <div className="px-3 text-[10px] text-zinc-300 italic">No unsorted docs</div>}
                    </div>
                </div>

            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedDoc ? (
                <>
                    {/* Toolbar */}
                    <div className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                <Icons.Clock className="w-3.5 h-3.5" />
                                <span>Edited {new Date(selectedDoc.lastUpdated).toLocaleDateString()}</span>
                            </div>
                            
                            {/* Folder Mover */}
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-300">/</span>
                                <select 
                                    className="bg-transparent text-xs text-zinc-500 font-medium hover:text-zinc-900 focus:outline-none cursor-pointer"
                                    value={selectedDoc.folderId || ''}
                                    onChange={(e) => moveDoc(selectedDoc.id, e.target.value || undefined)}
                                >
                                    <option value="">Unsorted</option>
                                    {folderDocs.map(f => (
                                        <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Read-Only Metadata Display */}
                            {!editingDoc && (
                                <div className="flex items-center gap-2">
                                    {selectedDoc.channelId && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                            {channels.find(c => c.id === selectedDoc.channelId)?.name}
                                        </span>
                                    )}
                                    {selectedDoc.tags?.map(t => (
                                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {editingDoc ? (
                                <>
                                    <button onClick={() => setEditingDoc(null)} className="px-4 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Discard</button>
                                    <button onClick={handleSave} className="px-4 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 shadow-sm transition-all">Save Changes</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setShowTicketModal(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2">
                                        <Icons.Zap className="w-3.5 h-3.5" /> Create Ticket
                                    </button>
                                    <div className="w-px h-6 bg-zinc-200 mx-2"></div>
                                    <button onClick={() => deleteDoc(selectedDoc.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Icons.Trash className="w-4 h-4"/></button>
                                    <button onClick={() => setEditingDoc(selectedDoc)} className="px-4 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all">Edit Document</button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Editor / Viewer Container */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50/30">
                        <div className="w-full max-w-5xl mx-auto py-8 px-8 lg:px-12 h-full flex flex-col">
                            {editingDoc ? (
                                <div className="space-y-6 flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
                                    {/* Edit Metadata Toolbar */}
                                    <div className="flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-lg shadow-sm">
                                         <div className="flex-1">
                                             <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Title</label>
                                             <input 
                                                value={editingDoc.title}
                                                onChange={e => setEditingDoc({...editingDoc, title: e.target.value})}
                                                className="text-lg font-bold bg-transparent text-zinc-900 border-none focus:outline-none placeholder-zinc-300 w-full"
                                                placeholder="Document Title"
                                                autoFocus
                                            />
                                         </div>
                                         <div className="w-px h-8 bg-zinc-100 mx-2"></div>
                                         <div className="w-48">
                                             <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Channel</label>
                                             <select 
                                                value={editingDoc.channelId || ''}
                                                onChange={e => setEditingDoc({...editingDoc, channelId: e.target.value || undefined})}
                                                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded p-1.5 focus:outline-none"
                                             >
                                                 <option value="">None</option>
                                                 {channels.map(c => (
                                                     <option key={c.id} value={c.id}>{c.name}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <div className="w-64">
                                             <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Tags</label>
                                             <div className="flex flex-wrap gap-1 mb-2">
                                                {availableTags.map(tag => (
                                                    <button 
                                                        key={tag}
                                                        onClick={() => toggleTag(tag)}
                                                        className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${editingDoc.tags?.includes(tag) ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                             </div>
                                             <div className="flex gap-1">
                                                 <input 
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[10px] focus:outline-none"
                                                    placeholder="Add tag..."
                                                    value={newTagInput}
                                                    onChange={e => setNewTagInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                                                 />
                                             </div>
                                         </div>
                                    </div>

                                    <div className="flex-1 min-h-[600px]">
                                        <RichTextEditor 
                                            initialContent={editingDoc.content} 
                                            onChange={(html) => setEditingDoc({...editingDoc, content: html})}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-12 min-h-[80vh] animate-in fade-in duration-300">
                                    <div className="mb-8 pb-4 border-b border-zinc-50">
                                        <h1 className="text-4xl font-bold text-zinc-900 mb-2">{selectedDoc.title}</h1>
                                    </div>
                                    <RichTextEditor 
                                        initialContent={selectedDoc.content} 
                                        onChange={() => {}} 
                                        readOnly={true} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 bg-zinc-50/30">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100 mb-4">
                        <Icons.FileText className="w-8 h-8 text-zinc-200" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">Select a document or create a new one.</p>
                </div>
            )}
        </div>

        {showTicketModal && selectedDoc && (
            <TicketModal 
                initialData={{
                    title: selectedDoc.title,
                    description: `Derived from document: ${selectedDoc.title}`,
                    channelId: selectedDoc.channelId,
                }} 
                context={{ channels, projects: campaign?.projects || [], users, docs: campaign?.docs || [] }}
                onClose={() => setShowTicketModal(false)}
                onSave={handleCreateTicketFromDoc}
            />
        )}
    </div>
  );
};
