import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { ContextDoc, DocFolder, TicketStatus, Ticket, DocFormat } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { CanvasEditor } from './CanvasEditor';
import { ICP_TEMPLATE, EMAIL_SEQUENCE_TEMPLATE, LINKEDIN_POST_TEMPLATE, REDDIT_POST_TEMPLATE, POSITIONING_MATRIX_TEMPLATE, SEO_BLOG_POST_TEMPLATE } from '../templates';
import { TicketModal } from './TicketModal';
import { exportAsMarkdown, exportAsHTML, exportAsPlainText, printAsPDF } from '../services/ExportUtils';

interface NewDocModalProps {
    onClose: () => void;
    onCreate: (title: string, icon: string, templateContent: string, format: DocFormat) => void;
    initialTitle?: string;
}

const NewDocModal: React.FC<NewDocModalProps> = ({ onClose, onCreate, initialTitle }) => {
    const [title, setTitle] = useState(initialTitle || '');
    const [icon, setIcon] = useState('📄');
    const [format, setFormat] = useState<DocFormat>('TEXT');
    const [selectedTemplate, setSelectedTemplate] = useState<{ name: string, content: string } | null>(null);

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
                                        className={`text-left p-3 rounded-lg border text-xs transition-all ${selectedTemplate?.name === t.name
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
    const {
        campaign, addDoc, updateDoc, deleteDoc,
        addDocFolder, updateDocFolder, deleteDocFolder, moveDocFolder,
        moveDoc, addTicket, linkDocToTicket, addCampaignTag,
        pendingTicketLink, clearPendingTicketLink, users,
        toggleRagIndexing, toggleDocFavorite, recordRecentDoc
    } = useStore();
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [editingDoc, setEditingDoc] = useState<ContextDoc | null>(null);

    // Folder Management State
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderIcon, setNewFolderIcon] = useState('\u{1F4C1}');
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [renamingFolderData, setRenamingFolderData] = useState<{ name: string, icon: string }>({ name: '', icon: '' });

    // Sorting
    const [sortOrder, setSortOrder] = useState<'MANUAL' | 'NAME' | 'DATE'>('MANUAL');

    const ORDER_STEP = 1000;

    type LastMove = {
        kind: 'doc' | 'folder';
        id: string;
        label: string;
        fromParentId?: string;
        fromOrder?: number;
    };

    const moveToastTimerRef = useRef<number | null>(null);
    const [lastMove, setLastMove] = useState<LastMove | null>(null);

    const sortManual = <T extends { order?: number; createdAt?: string; lastUpdated?: string }>(items: T[]): T[] => {
        return [...items].sort((a, b) => {
            const ao = a.order ?? Number.POSITIVE_INFINITY;
            const bo = b.order ?? Number.POSITIVE_INFINITY;
            if (ao !== bo) return ao - bo;
            const at = new Date(a.createdAt || a.lastUpdated || 0).getTime();
            const bt = new Date(b.createdAt || b.lastUpdated || 0).getTime();
            return at - bt;
        });
    };

    const sortFoldersList = (items: DocFolder[]): DocFolder[] => {
        if (sortOrder === 'NAME') return [...items].sort((a, b) => a.name.localeCompare(b.name));
        if (sortOrder === 'DATE') return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return sortManual(items);
    };

    const sortDocsList = (items: ContextDoc[]): ContextDoc[] => {
        if (sortOrder === 'NAME') return [...items].sort((a, b) => a.title.localeCompare(b.title));
        if (sortOrder === 'DATE') return [...items].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        return sortManual(items);
    };

    const getNextOrderFromSiblings = <T extends { order?: number }>(siblings: T[]): number => {
        const maxOrder = siblings.reduce((max, item, index) => {
            const fallback = (index + 1) * ORDER_STEP;
            return Math.max(max, item.order ?? fallback);
        }, 0);
        return maxOrder + ORDER_STEP;
    };

    const getOrderBeforeTarget = <T extends { id: string; order?: number }>(siblings: T[], targetId: string): number => {
        const index = siblings.findIndex(s => s.id === targetId);
        if (index === -1) return getNextOrderFromSiblings(siblings);
        if (index === 0) {
            const targetOrder = siblings[0].order ?? ORDER_STEP;
            return targetOrder - ORDER_STEP / 2;
        }

        const resolveOrder = (item: T, idx: number) => item.order ?? (idx + 1) * ORDER_STEP;
        const targetOrder = resolveOrder(siblings[index], index);
        const prevOrder = resolveOrder(siblings[index - 1], index - 1);
        const gap = targetOrder - prevOrder;
        if (gap > 0.0001) return prevOrder + gap / 2;
        return targetOrder - 1;
    };

    // Modals
    const [showNewDocModal, setShowNewDocModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showLinkTicketModal, setShowLinkTicketModal] = useState(false);
    const [newDocTitle, setNewDocTitle] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Tag Creation
    const [newTagInput, setNewTagInput] = useState('');

    const docs = campaign?.docs || [];
    const folders = campaign?.docFolders || [];
    const channels = campaign?.channels || [];
    const availableTags = campaign?.availableTags || ['Draft', 'Q4', 'Urgent', 'Review'];
    const allTickets = [...(campaign?.channels.flatMap(c => c.tickets) || []), ...(campaign?.projects.flatMap(p => p.tickets) || [])];

    useEffect(() => {
        if (pendingTicketLink) {
            const ticket = allTickets.find(t => t.id === pendingTicketLink);
            if (ticket) {
                setNewDocTitle(`Doc for: ${ticket.title}`);
                setShowNewDocModal(true);
            } else {
                clearPendingTicketLink();
            }
        }
    }, [pendingTicketLink, allTickets, clearPendingTicketLink]);

    useEffect(() => {
        return () => {
            if (moveToastTimerRef.current) {
                window.clearTimeout(moveToastTimerRef.current);
            }
        };
    }, []);

    const unsortedDocs = useMemo(() => {
        const unsorted = docs.filter(d => !d.folderId && !d.isArchived);
        return sortDocsList(unsorted);
    }, [docs, sortOrder]);

    const rootFolders = useMemo(() => {
        const root = folders.filter(f => !f.parentId && !f.isArchived);
        return sortFoldersList(root);
    }, [folders, sortOrder]);

    const favoriteDocs = useMemo(() => {
        const favorites = docs.filter(d => d.isFavorite && !d.isArchived);
        return [...favorites].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    }, [docs]);

    const recentDocs = useMemo(() => {
        const recentIds = campaign?.recentDocIds || [];
        const byId = new Map(docs.map(d => [d.id, d]));
        const orderedRecent = recentIds
            .map(id => byId.get(id))
            .filter((d): d is ContextDoc => !!d && !d.isArchived);

        if (orderedRecent.length >= 8) return orderedRecent.slice(0, 8);

        const remaining = docs
            .filter(d => !d.isArchived && !recentIds.includes(d.id))
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

        return [...orderedRecent, ...remaining].slice(0, 8);
    }, [campaign?.recentDocIds, docs]);

    const selectedDoc = docs.find(d => d.id === selectedDocId);

    const selectDoc = (docId: string) => {
        setSelectedDocId(docId);
        setEditingDoc(null);
        recordRecentDoc(docId);
    };

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
        recordRecentDoc(newDoc.id);

        // Handle Pending Link
        if (pendingTicketLink) {
            const ticket = allTickets.find(t => t.id === pendingTicketLink);
            if (ticket) {
                linkDocToTicket(newDoc.id, ticket.id, ticket.channelId, ticket.projectId);
            }
            clearPendingTicketLink();
            setNewDocTitle('');
        }

        setSelectedDocId(newDoc.id);
        // Immediately enter edit mode for new documents
        setEditingDoc(newDoc);
        setShowNewDocModal(false);
    };

    const handleCloseNewDocModal = () => {
        setShowNewDocModal(false);
        setNewDocTitle('');
        if (pendingTicketLink) clearPendingTicketLink();
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
            const rootSiblings = sortManual(folders.filter(f => !f.parentId && !f.isArchived));
            const order = getNextOrderFromSiblings(rootSiblings);
            addDocFolder(newFolderName.trim(), newFolderIcon, undefined, order);
            setNewFolderName('');
            setNewFolderIcon('\u{1F4C1}');
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
            setEditingDoc({ ...editingDoc, tags: tags.filter(t => t !== tag) });
        } else {
            setEditingDoc({ ...editingDoc, tags: [...tags, tag] });
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

    const showMoveToast = (move: LastMove) => {
        setLastMove(move);
        if (moveToastTimerRef.current) {
            window.clearTimeout(moveToastTimerRef.current);
        }
        moveToastTimerRef.current = window.setTimeout(() => {
            setLastMove(null);
        }, 6000);
    };

    const handleUndoMove = () => {
        if (!lastMove) return;
        if (lastMove.kind === 'doc') {
            moveDoc(lastMove.id, lastMove.fromParentId, lastMove.fromOrder);
        } else {
            moveDocFolder(lastMove.id, lastMove.fromParentId, lastMove.fromOrder);
        }
        if (moveToastTimerRef.current) {
            window.clearTimeout(moveToastTimerRef.current);
            moveToastTimerRef.current = null;
        }
        setLastMove(null);
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, docId: string) => {
        e.dataTransfer.setData('docId', docId);
        e.dataTransfer.setData('dragType', 'doc');
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (
        e: React.DragEvent,
        options?: { targetFolderId?: string; targetParentId?: string; beforeId?: string; beforeType?: 'doc' | 'folder' }
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const docId = e.dataTransfer.getData('docId');
        const draggedFolderId = e.dataTransfer.getData('folderId');
        const isReorder = !!options?.beforeId && e.shiftKey;

        if (docId) {
            const targetFolderId = options?.targetFolderId;
            const currentDoc = docs.find(d => d.id === docId);
            if (!currentDoc) return;
            const moveMeta: LastMove = {
                kind: 'doc',
                id: docId,
                label: currentDoc.title,
                fromParentId: currentDoc.folderId,
                fromOrder: currentDoc.order
            };

            if (isReorder && options?.beforeType === 'doc' && options.beforeId !== docId) {
                const siblings = sortDocsList(docs.filter(d => d.folderId === targetFolderId && !d.isArchived));
                const order = getOrderBeforeTarget(siblings, options.beforeId);
                moveDoc(docId, targetFolderId, order);
                showMoveToast(moveMeta);
                return;
            }

            const siblings = sortDocsList(docs.filter(d => d.folderId === targetFolderId && !d.isArchived && d.id !== docId));
            const order = getNextOrderFromSiblings(siblings);
            moveDoc(docId, targetFolderId, order);
            showMoveToast(moveMeta);
        } else if (draggedFolderId) {
            const intoFolderId = options?.targetFolderId;
            const currentFolder = folders.find(f => f.id === draggedFolderId);
            if (!currentFolder) return;
            const moveMeta: LastMove = {
                kind: 'folder',
                id: draggedFolderId,
                label: currentFolder.name,
                fromParentId: currentFolder.parentId,
                fromOrder: currentFolder.order
            };

            if (isReorder && options?.beforeType === 'folder' && options.beforeId !== draggedFolderId) {
                const targetParentId = options?.targetParentId;
                const siblings = sortFoldersList(folders.filter(f => f.parentId === targetParentId && !f.isArchived));
                const order = getOrderBeforeTarget(siblings, options.beforeId);
                moveDocFolder(draggedFolderId, targetParentId, order);
                showMoveToast(moveMeta);
                return;
            }

            const siblings = sortFoldersList(folders.filter(f => f.parentId === intoFolderId && !f.isArchived && f.id !== draggedFolderId));
            const order = getNextOrderFromSiblings(siblings);
            moveDocFolder(draggedFolderId, intoFolderId, order);
            showMoveToast(moveMeta);
        }
    };

    const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
        e.dataTransfer.setData('folderId', folderId);
        e.dataTransfer.setData('dragType', 'folder');
        e.dataTransfer.effectAllowed = 'move';
    };

    const FolderItem: React.FC<{ folder: DocFolder & { docs: ContextDoc[] }, depth: number }> = ({ folder, depth }) => {
        const [isExpanded, setIsExpanded] = useState(true);

        const childFolders = useMemo(() => {
            const children = folders.filter(f => f.parentId === folder.id && !f.isArchived);
            return sortFoldersList(children);
        }, [folder.id, folders, sortOrder]);

        const childDocs = useMemo(() => {
            const children = docs.filter(d => d.folderId === folder.id && !d.isArchived);
            return sortDocsList(children);
        }, [folder.id, docs, sortOrder]);

        return (
            <div
                className="mb-0.5"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, { targetFolderId: folder.id })}
            >
                <div
                    draggable
                    onDragStart={(e) => handleDragStartFolder(e, folder.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, {
                        targetFolderId: folder.id,
                        targetParentId: folder.parentId,
                        beforeId: folder.id,
                        beforeType: 'folder'
                    })}
                    className="group flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-100 cursor-default"
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 tracking-wide flex-1 min-w-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                            className={`p-0.5 hover:bg-zinc-200 rounded transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        >
                            <Icons.ChevronRight className="w-3 h-3" />
                        </button>

                        {renamingFolderId === folder.id ? (
                            <div className="flex items-center gap-1 flex-1">
                                <input
                                    className="w-6 text-center border border-zinc-200 rounded text-[10px] py-0.5 focus:outline-none"
                                    value={renamingFolderData.icon}
                                    onChange={e => setRenamingFolderData({ ...renamingFolderData, icon: e.target.value })}
                                    maxLength={2}
                                />
                                <input
                                    autoFocus
                                    className="bg-white border border-zinc-200 rounded text-[10px] px-1 py-0.5 w-full focus:outline-none"
                                    value={renamingFolderData.name}
                                    onChange={e => setRenamingFolderData({ ...renamingFolderData, name: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleRenameFolder(folder.id)}
                                    onBlur={() => setRenamingFolderId(null)}
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        ) : (
                            <div
                                className="flex items-center gap-2 cursor-pointer truncate flex-1"
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingFolderId(folder.id);
                                    setRenamingFolderData({ name: folder.name, icon: folder.icon || '\u{1F4C1}' });
                                }}
                            >
                                <span className="opacity-80 shrink-0">{folder.icon || '\u{1F4C1}'}</span>
                                <span className="uppercase tracking-wider truncate">{folder.name}</span>
                                {folder.isRagIndexed && <Icons.Database className="w-2.5 h-2.5 text-indigo-400 shrink-0" title="RAG Indexed" />}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleRagIndexing('FOLDER', folder.id, !folder.isRagIndexed); }}
                            className={`p-1 rounded hover:bg-zinc-200 ${folder.isRagIndexed ? 'text-indigo-500' : 'text-zinc-400'}`}
                            title={folder.isRagIndexed ? "Remove from RAG" : "Index for RAG"}
                        >
                            <Icons.Database className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const siblings = sortManual(folders.filter(f => f.parentId === folder.id && !f.isArchived));
                                const order = getNextOrderFromSiblings(siblings);
                                addDocFolder('New Subfolder', '\u{1F4C1}', folder.id, order);
                            }}
                            className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded"
                            title="New Subfolder"
                        >
                            <Icons.Plus className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete folder? Children will move to parent.')) deleteDocFolder(folder.id) }}
                            className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                            <Icons.Trash className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="space-y-0.5 mt-0.5">
                        {childFolders.map(child => (
                            <FolderItem key={child.id} folder={{ ...child, docs: childDocs.filter(d => d.folderId === child.id) }} depth={depth + 1} />
                        ))}
                                                {childDocs.map(doc => (
                            <div
                                key={doc.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, doc.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, { targetFolderId: folder.id, beforeId: doc.id, beforeType: 'doc' })}
                                onClick={() => selectDoc(doc.id)}
                                className={`py-1.5 pr-3 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                style={{ marginLeft: `${depth * 12 + 24}px` }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="shrink-0">{doc.icon || '\u{1F4C4}'}</span>
                                    <span className="truncate">{doc.title}</span>
                                    {doc.isFavorite && <Icons.Star className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                    {doc.isRagIndexed && <Icons.Database className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleDocFavorite(doc.id); }}
                                        className={`p-0.5 rounded hover:bg-zinc-200 ${doc.isFavorite ? 'text-amber-500' : 'text-zinc-400'}`}
                                        title={doc.isFavorite ? 'Remove favorite' : 'Add favorite'}
                                    >
                                        <Icons.Star className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleRagIndexing('DOC', doc.id, !doc.isRagIndexed); }}
                                        className={`p-0.5 rounded hover:bg-zinc-200 ${doc.isRagIndexed ? 'text-indigo-500' : 'text-zinc-400'}`}
                                    >
                                        <Icons.Database className="w-3 h-3" />
                                    </button>
                                    {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50 shrink-0" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex bg-white text-zinc-900 overflow-hidden relative">
            {/* Sidebar */}
            <div className="w-64 border-r border-zinc-100 flex flex-col bg-zinc-50/50 shrink-0">
                <div className="p-4 border-b border-zinc-100 flex justify-between items-center relative">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge Base</span>
                        <button
                            onClick={() => setSortOrder(prev => prev === 'MANUAL' ? 'NAME' : prev === 'NAME' ? 'DATE' : 'MANUAL')}
                            className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider hover:text-zinc-600"
                            title="Sort: Manual / A-Z / Newest"
                        >
                            {sortOrder === 'MANUAL' ? '(Manual)' : sortOrder === 'NAME' ? '(A-Z)' : '(Newest)'}
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
                    {recentDocs.length > 0 && (
                        <div>
                            <div className="px-2 py-1 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <Icons.Clock className="w-3 h-3" /> Recent
                            </div>
                            <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3">
                                {recentDocs.map(doc => (
                                    <div
                                        key={`recent-${doc.id}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, doc.id)}
                                        onClick={() => selectDoc(doc.id)}
                                        className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span>{doc.icon || '\u{1F4C4}'}</span>
                                            <span className="truncate">{doc.title}</span>
                                            {doc.isFavorite && <Icons.Star className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                            {doc.isRagIndexed && <Icons.Database className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleDocFavorite(doc.id); }}
                                                className={`p-0.5 rounded hover:bg-zinc-200 ${doc.isFavorite ? 'text-amber-500' : 'text-zinc-400'}`}
                                            >
                                                <Icons.Star className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {favoriteDocs.length > 0 && (
                        <div>
                            <div className="px-2 py-1 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <Icons.Star className="w-3 h-3" /> Favorites
                            </div>
                            <div className="pl-4 space-y-0.5 border-l border-zinc-100 ml-3">
                                {favoriteDocs.slice(0, 12).map(doc => (
                                    <div
                                        key={`favorite-${doc.id}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, doc.id)}
                                        onClick={() => selectDoc(doc.id)}
                                        className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span>{doc.icon || '\u{1F4C4}'}</span>
                                            <span className="truncate">{doc.title}</span>
                                            <Icons.Star className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleDocFavorite(doc.id, false); }}
                                                className="p-0.5 rounded hover:bg-zinc-200 text-amber-500"
                                                title="Remove favorite"
                                            >
                                                <Icons.Star className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Root Folders Tree */}
                    <div>
                        {rootFolders.map(folder => (
                            <FolderItem
                                key={folder.id}
                                folder={{ ...folder, docs: docs.filter(d => d.folderId === folder.id && !d.isArchived) }}
                                depth={0}
                            />
                        ))}
                    </div>

                    {/* Unsorted */}
                    <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, { targetFolderId: undefined, targetParentId: undefined })}
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
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, { targetFolderId: undefined, beforeId: doc.id, beforeType: 'doc' })}
                                    onClick={() => selectDoc(doc.id)}
                                    className={`px-3 py-1.5 rounded-md cursor-pointer text-xs flex items-center justify-between group transition-colors ${selectedDoc?.id === doc.id ? 'bg-white shadow-sm ring-1 ring-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <span>{doc.icon || '\u{1F4C4}'}</span>
                                        <span className="truncate">{doc.title}</span>
                                        {doc.isFavorite && <Icons.Star className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                        {doc.isRagIndexed && <Icons.Database className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleDocFavorite(doc.id); }}
                                            className={`p-0.5 rounded hover:bg-zinc-200 ${doc.isFavorite ? 'text-amber-500' : 'text-zinc-400'}`}
                                            title={doc.isFavorite ? 'Remove favorite' : 'Add favorite'}
                                        >
                                            <Icons.Star className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleRagIndexing('DOC', doc.id, !doc.isRagIndexed); }}
                                            className={`p-0.5 rounded hover:bg-zinc-200 ${doc.isRagIndexed ? 'text-indigo-500' : 'text-zinc-400'}`}
                                        >
                                            <Icons.Database className="w-3 h-3" />
                                        </button>
                                        {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-500 opacity-50 shrink-0" />}
                                    </div>
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
                                {/* Last edited by */}
                                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                    {selectedDoc.lastEditedBy && (
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${users.find(u => u.id === selectedDoc.lastEditedBy)?.color || 'bg-zinc-400'}`}>
                                            {users.find(u => u.id === selectedDoc.lastEditedBy)?.initials || '?'}
                                        </div>
                                    )}
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
                                        {(() => {
                                            const renderFolderOptions = (parentId: string | undefined, depth: number): React.ReactElement[] => {
                                                return folders
                                                    .filter(f => f.parentId === parentId)
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .flatMap(f => [
                                                        <option key={f.id} value={f.id}>
                                                            {'\u00A0'.repeat(depth * 3)}{f.icon} {f.name}
                                                        </option>,
                                                        ...renderFolderOptions(f.id, depth + 1)
                                                    ]);
                                            };
                                            return renderFolderOptions(undefined, 0);
                                        })()}
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

                            <div className="flex gap-2 items-center">
                                {editingDoc ? (
                                    <>
                                        <button onClick={() => setEditingDoc(null)} className="px-4 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Discard</button>
                                        <button onClick={handleSave} className="px-4 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 shadow-sm transition-all">Save Changes</button>
                                    </>
                                ) : (
                                    <>
                                        {/* Export Dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowExportMenu(!showExportMenu)}
                                                className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-2 border border-zinc-200"
                                            >
                                                <Icons.Download className="w-3.5 h-3.5" /> Export
                                            </button>
                                            {showExportMenu && selectedDoc.format !== 'CANVAS' && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <button
                                                        onClick={() => { exportAsMarkdown(selectedDoc.title, selectedDoc.content); setShowExportMenu(false); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                                    >
                                                        <span className="text-zinc-400">📝</span> Export as Markdown
                                                    </button>
                                                    <button
                                                        onClick={() => { exportAsHTML(selectedDoc.title, selectedDoc.content); setShowExportMenu(false); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                                    >
                                                        <span className="text-zinc-400">🌐</span> Export as HTML
                                                    </button>
                                                    <button
                                                        onClick={() => { printAsPDF(); setShowExportMenu(false); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                                    >
                                                        <span className="text-zinc-400">📄</span> Print as PDF
                                                    </button>
                                                    <div className="h-px bg-zinc-100 my-1" />
                                                    <button
                                                        onClick={() => { exportAsPlainText(selectedDoc.title, selectedDoc.content); setShowExportMenu(false); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                                    >
                                                        <span className="text-zinc-400">📋</span> Export as Plain Text
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => setShowLinkTicketModal(true)} className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-2 border border-zinc-200">
                                            <Icons.Link className="w-3.5 h-3.5" /> Link Ticket
                                        </button>
                                        <button onClick={() => setShowTicketModal(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2">
                                            <Icons.Zap className="w-3.5 h-3.5" /> Create Ticket
                                        </button>
                                        <div className="w-px h-6 bg-zinc-200 mx-2"></div>
                                        <button onClick={() => deleteDoc(selectedDoc.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Icons.Trash className="w-4 h-4" /></button>
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
                                                    onChange={e => setEditingDoc({ ...editingDoc, icon: e.target.value })}
                                                    className="w-full text-center text-xl bg-zinc-50 border border-zinc-200 rounded p-1 focus:outline-none"
                                                    maxLength={2}
                                                    placeholder="📄"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Title</label>
                                                <input
                                                    value={editingDoc.title}
                                                    onChange={e => setEditingDoc({ ...editingDoc, title: e.target.value })}
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
                                                    onChange={e => setEditingDoc({ ...editingDoc, channelId: e.target.value || undefined })}
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
                                                    onChange={(html) => setEditingDoc({ ...editingDoc, content: html })}
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
                                                        onChange={() => { }}
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
                                                    onChange={() => { }}
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
                    onClose={handleCloseNewDocModal}
                    onCreate={handleCreateDoc}
                    initialTitle={newDocTitle}
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

            {lastMove && (
                <div className="fixed bottom-4 right-4 z-[200] bg-zinc-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-3">
                    <span className="font-medium truncate max-w-[240px]">Moved {lastMove.label}</span>
                    <button
                        onClick={handleUndoMove}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors font-semibold"
                    >
                        Undo
                    </button>
                </div>
            )}
        </div>
    );
};

















