
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { ContextDoc, DocFolder, TicketStatus, Ticket, DocFormat } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { CanvasEditor } from './CanvasEditor';
import { ICP_TEMPLATE, EMAIL_SEQUENCE_TEMPLATE, LINKEDIN_POST_TEMPLATE, REDDIT_POST_TEMPLATE, POSITIONING_MATRIX_TEMPLATE, SEO_BLOG_POST_TEMPLATE } from '../templates';
import { TicketModal } from './TicketModal';

interface NewDocModalProps {
    onClose: () => void;
    onCreate: (title: string, icon: string, templateContent: string, format: DocFormat) => void;
}

const NewDocModal: React.FC<NewDocModalProps> = ({ onClose, onCreate }) => {
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState('📄');
    const [format, setFormat] = useState<DocFormat>('TEXT');
    const [selectedTemplate, setSelectedTemplate] = useState<{name: string, content: string} | null>(null);

    const templates = [
        { name: 'Blank Document', content: '<h1>New Document</h1><p>Start typing...</p>' },
        { name: 'Ideal Customer Profile (ICP)', content: ICP_TEMPLATE },
        { name: 'Cold Email Sequence', content: EMAIL_SEQUENCE_TEMPLATE },
        { name: 'LinkedIn Post', content: LINKEDIN_POST_TEMPLATE },
        { name: 'Reddit Post', content: REDDIT_POST_TEMPLATE },
        { name: 'Positioning Matrix', content: POSITIONING_MATRIX_TEMPLATE },
        { name: 'SEO Blog Post', content: SEO_BLOG_POST_TEMPLATE },
    ];

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[500px] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 p-6 flex flex-col max-h-[80vh]">
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Create New Document</h3>
                
                <div className="space-y-4 mb-6">
                    {/* Format Toggle */}
                    <div className="flex bg-zinc-100 p-1 rounded-lg">
                        <button 
                            onClick={() => { setFormat('TEXT'); setIcon('📄'); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${format === 'TEXT' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            <Icons.FileText className="w-4 h-4" /> Text Doc
                        </button>
                        <button 
                            onClick={() => { setFormat('CANVAS'); setIcon('🎨'); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${format === 'CANVAS' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            <Icons.Layout className="w-4 h-4" /> Canvas / Whiteboard
                        </button>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-16">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Icon</label>
                            <input 
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-center text-xl focus:outline-none focus:border-indigo-500"
                                value={icon}
                                onChange={e => setIcon(e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Title</label>
                            <input 
                                autoFocus
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:border-indigo-500"
                                placeholder="e.g. Q4 Strategy"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    {format === 'TEXT' && (
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Choose Template</label>
                            <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto custom-scrollbar border border-zinc-100 rounded-lg p-1">
                                {templates.map(t => (
                                    <button
                                        key={t.name}
                                        onClick={() => setSelectedTemplate(t)}
                                        className={`text-left p-3 rounded-lg border text-xs transition-all ${
                                            selectedTemplate?.name === t.name 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' 
                                            : 'bg-white border-zinc-100 text-zinc-600 hover:border-zinc-300'
                                        }`}
                                    >
                                        <span className="font-semibold block mb-0.5">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-auto">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900">Cancel</button>
                    <button 
                        onClick={() => onCreate(title || 'Untitled', icon, format === 'TEXT' ? (selectedTemplate?.content || templates[0].content) : '[]', format)}
                        className="px-6 py-2 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 disabled:opacity-50 shadow-sm"
                    >
                        Create {format === 'CANVAS' ? 'Board' : 'Document'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const LinkTicketModal: React.FC<{
    onClose: () => void;
    onLink: (ticketId: string) => void;
    tickets: Ticket[];
}> = ({ onClose, onLink, tickets }) => {
    const [search, setSearch] = useState('');
    
    const filteredTickets = tickets.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.shortId.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[400px] bg-white border border-zinc-100 rounded-xl shadow-2xl relative z-10 p-4 flex flex-col max-h-[60vh]">
                <h3 className="text-sm font-bold text-zinc-900 mb-3">Link to Existing Ticket</h3>
                <input 
                    autoFocus
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
                    placeholder="Search tickets..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                    {filteredTickets.map(t => (
                        <button
                            key={t.id}
                            onClick={() => onLink(t.id)}
                            className="w-full text-left p-2 rounded hover:bg-zinc-50 flex items-center gap-2 group"
                        >
                            <span className="font-mono text-xs text-zinc-400 group-hover:text-zinc-600">{t.shortId}</span>
                            <span className="text-xs text-zinc-700 font-medium truncate flex-1">{t.title}</span>
                            {t.linkedDocIds && t.linkedDocIds.length > 0 && <Icons.Link className="w-3 h-3 text-indigo-400" />}
                        </button>
                    ))}
                    {filteredTickets.length === 0 && <p className="text-xs text-zinc-400 text-center py-4">No tickets found.</p>}
                </div>
            </div>
        </div>
    );
};

export const DocsView: React.FC = () => {
  const { campaign, addDoc, updateDoc, deleteDoc, addDocFolder, updateDocFolder, deleteDocFolder, moveDoc, addTicket, linkDocToTicket, addCampaignTag, users } = useStore();
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

  // Modals
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showLinkTicketModal, setShowLinkTicketModal] = useState(false);
  
  // Tag Creation
  const [newTagInput, setNewTagInput] = useState('');

  const docs = campaign?.docs || [];
  const folders = campaign?.docFolders || [];
  const channels = campaign?.channels || [];
  const availableTags = campaign?.availableTags || ['Draft', 'Q4', 'Urgent', 'Review'];
  const allTickets = [...(campaign?.channels.flatMap(c => c.tickets) || []), ...(campaign?.projects.flatMap(p => p.tickets) || [])];
  
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

  const handleCreateDoc = (title: string, icon: string, content: string, format: DocFormat) => {
      const newDoc: ContextDoc = {
          id: generateId(),
          title: title,
          icon: icon,
          content: content,
          format: format,
          folderId: undefined, 
          lastUpdated: new Date().toISOString(),
          isAiGenerated: false,
          tags: ['Draft']
      };
      addDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setEditingDoc(null); 
      setShowNewDocModal(false);
  };

  const handleSave = () => {
      if (editingDoc) {
          updateDoc(editingDoc.id, {
              title: editingDoc.title,
              content: editingDoc.content,
              channelId: editingDoc.channelId,
              tags: editingDoc.tags,
              icon: editingDoc.icon,
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
  
  const handleLinkToTicket = (ticketId: string) => {
      if (!selectedDoc) return;
      const ticket = allTickets.find(t => t.id === ticketId);
      if (ticket) {
          linkDocToTicket(selectedDoc.id, ticket.id, ticket.channelId, ticket.projectId);
      }
      setShowLinkTicketModal(false);
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
          toggleTag(tag); 
          setNewTagInput('');
      }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, docId: string) => {
      e.dataTransfer.setData('docId', docId);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, folderId?: string) => {
      e.preventDefault();
      const docId = e.dataTransfer.getData('docId');
      if (docId) {
          moveDoc(docId, folderId);
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
                    <button onClick={() => setShowNewDocModal(true)} className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded" title="New Document">
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
                    <div 
                        key={folder.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, folder.id)}
                    >
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
                                <button onClick={() => { if(confirm('Delete folder? Docs will move to Unsorted.')) deleteDocFolder(folder.id) }} className="text-zinc-400 hover:text-red-500"><Icons.Trash className="w-3 h-3"/></button>
                            </div>
                        </div>
                        <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3 min-h-[10px]">
                            {folder.docs.map(doc => (
                                <div 
                                    key={doc.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, doc.id)}
                                    onClick={() => { setSelectedDocId(doc.id); setEditingDoc(null); }}
                                    className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <span>{doc.icon || '📄'}</span>
                                        <span className="truncate">{doc.title}</span>
                                    </div>
                                    {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50 shrink-0" />}
                                </div>
                            ))}
                            {folder.docs.length === 0 && <div className="px-3 text-[10px] text-zinc-300 italic">Empty</div>}
                        </div>
                    </div>
                ))}

                {/* Unsorted */}
                <div 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, undefined)}
                >
                    <div className="px-2 py-1 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Icons.FileText className="w-3 h-3" /> Unsorted
                    </div>
                    <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3 min-h-[20px]">
                        {unsortedDocs.map(doc => (
                            <div 
                                key={doc.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, doc.id)}
                                onClick={() => { setSelectedDocId(doc.id); setEditingDoc(null); }}
                                className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span>{doc.icon || '📄'}</span>
                                    <span className="truncate">{doc.title}</span>
                                </div>
                                {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50 shrink-0" />}
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
                                    <button onClick={() => setShowLinkTicketModal(true)} className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-2 border border-zinc-200">
                                        <Icons.Link className="w-3.5 h-3.5" /> Link Ticket
                                    </button>
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
                                         <div className="w-16">
                                             <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Icon</label>
                                             <input 
                                                value={editingDoc.icon || ''}
                                                onChange={e => setEditingDoc({...editingDoc, icon: e.target.value})}
                                                className="w-full text-center text-xl bg-zinc-50 border border-zinc-200 rounded p-1 focus:outline-none"
                                                maxLength={2}
                                                placeholder="📄"
                                             />
                                         </div>
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

                                    {/* EDITOR SWITCH */}
                                    <div className="flex-1 min-h-[600px]">
                                        {editingDoc.format === 'CANVAS' ? (
                                            <CanvasEditor
                                                initialContent={editingDoc.content}
                                                onChange={(content) => setEditingDoc({ ...editingDoc, content })}
                                            />
                                        ) : (
                                            <RichTextEditor 
                                                initialContent={editingDoc.content} 
                                                onChange={(html) => setEditingDoc({...editingDoc, content: html})}
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={`bg-white rounded-xl shadow-sm border border-zinc-100 min-h-[80vh] animate-in fade-in duration-300 ${selectedDoc.format === 'CANVAS' ? 'p-0 overflow-hidden' : 'p-12'}`}>
                                    {selectedDoc.format === 'CANVAS' ? (
                                        <div className="h-full flex flex-col">
                                            <div className="p-6 border-b border-zinc-50 flex items-center gap-4 bg-white z-10 relative">
                                                <div className="text-4xl">{selectedDoc.icon || '🎨'}</div>
                                                <h1 className="text-4xl font-bold text-zinc-900">{selectedDoc.title}</h1>
                                            </div>
                                            <div className="flex-1">
                                                <CanvasEditor 
                                                    initialContent={selectedDoc.content}
                                                    onChange={() => {}}
                                                    readOnly={true}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-8 pb-4 border-b border-zinc-50 flex items-center gap-4">
                                                <div className="text-4xl">{selectedDoc.icon || '📄'}</div>
                                                <h1 className="text-4xl font-bold text-zinc-900 mb-2">{selectedDoc.title}</h1>
                                            </div>
                                            <RichTextEditor 
                                                initialContent={selectedDoc.content} 
                                                onChange={() => {}} 
                                                readOnly={true} 
                                            />
                                        </>
                                    )}
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

        {showNewDocModal && (
            <NewDocModal 
                onClose={() => setShowNewDocModal(false)}
                onCreate={handleCreateDoc}
            />
        )}

        {showLinkTicketModal && (
            <LinkTicketModal
                tickets={allTickets}
                onClose={() => setShowLinkTicketModal(false)}
                onLink={handleLinkToTicket}
            />
        )}

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
