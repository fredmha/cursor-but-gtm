
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from '../constants';
import { CanvasNode, CanvasNodeType, CanvasEdge } from '../types';
import { generateId } from '../store';

interface CanvasEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    readOnly?: boolean;
}

type ToolType = 'SELECT' | 'RECT' | 'CIRCLE' | 'STICKY' | 'TEXT' | 'IMAGE' | 'CONNECTOR';

const COLORS = [
    { name: 'Yellow', hex: '#fef3c7', border: '#fcd34d' },
    { name: 'Blue', hex: '#dbeafe', border: '#93c5fd' },
    { name: 'Pink', hex: '#fce7f3', border: '#f9a8d4' },
    { name: 'White', hex: '#ffffff', border: '#e4e4e7' },
    { name: 'Gray', hex: '#f4f4f5', border: '#d4d4d8' },
];

const processImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800;
                
                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ initialContent, onChange, readOnly = false }) => {
    const [nodes, setNodes] = useState<CanvasNode[]>([]);
    const [edges, setEdges] = useState<CanvasEdge[]>([]);
    
    const [tool, setTool] = useState<ToolType>('SELECT');
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [activeColor, setActiveColor] = useState(COLORS[0].hex);
    
    // --- Refs for Interaction State (No re-renders) ---
    const interactionRef = useRef<{
        mode: 'IDLE' | 'DRAGGING' | 'RESIZING' | 'CONNECTING' | 'PANNING';
        startPos: { x: number, y: number };
        nodesStart: { [id: string]: { x: number, y: number, w: number, h: number } };
        resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null;
        connectStartId: string | null;
        mousePos: { x: number, y: number }; // For connector preview
    }>({
        mode: 'IDLE',
        startPos: { x: 0, y: 0 },
        nodesStart: {},
        resizeHandle: null,
        connectStartId: null,
        mousePos: { x: 0, y: 0 }
    });

    const svgRef = useRef<SVGSVGElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Init ---
    useEffect(() => {
        try {
            const parsed = JSON.parse(initialContent);
            if (Array.isArray(parsed)) {
                setNodes(parsed);
                setEdges([]);
            } else if (parsed && typeof parsed === 'object') {
                setNodes(parsed.nodes || []);
                setEdges(parsed.edges || []);
            }
        } catch (e) {
            setNodes([]);
            setEdges([]);
        }
    }, [initialContent]);

    // --- Autosave ---
    useEffect(() => {
        if (!readOnly) {
            const content = JSON.stringify({ nodes, edges });
            if (content !== initialContent) {
                onChange(content);
            }
        }
    }, [nodes, edges, onChange, initialContent, readOnly]);

    // --- Helpers ---
    const getMousePos = (e: React.MouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left + svgRef.current.scrollLeft,
            y: e.clientY - rect.top + svgRef.current.scrollTop
        };
    };

    const getCenter = (id: string) => {
        const n = nodes.find(x => x.id === id);
        if (!n) return { x: 0, y: 0 };
        return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
    };

    // --- Core Logic ---

    const addNode = (x: number, y: number) => {
        const id = generateId();
        let width = 100;
        let height = 100;
        let text = '';
        let color = activeColor;

        if (tool === 'TEXT') {
            width = 200; height = 40; color = 'transparent'; text = 'Type here...';
        } else if (tool === 'STICKY') {
            width = 160; height = 160;
        }

        const newNode: CanvasNode = {
            id,
            type: tool as CanvasNodeType,
            x: x - width / 2,
            y: y - height / 2,
            width,
            height,
            color,
            text
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([id]);
        setTool('SELECT');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await processImage(file);
            const newNode: CanvasNode = {
                id: generateId(),
                type: 'IMAGE',
                x: (svgRef.current?.scrollLeft || 0) + 100,
                y: (svgRef.current?.scrollTop || 0) + 100,
                width: 300,
                height: 300,
                color: 'transparent',
                src: base64
            };
            setNodes(prev => [...prev, newNode]);
            setTool('SELECT');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Interaction Handlers (Stable) ---

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        const state = interactionRef.current;
        const pos = getMousePos(e);
        state.mousePos = pos;

        if (state.mode === 'DRAGGING') {
            const dx = pos.x - state.startPos.x;
            const dy = pos.y - state.startPos.y;
            
            setNodes(prev => prev.map(n => {
                if (state.nodesStart[n.id]) {
                    return {
                        ...n,
                        x: state.nodesStart[n.id].x + dx,
                        y: state.nodesStart[n.id].y + dy
                    };
                }
                return n;
            }));
        } else if (state.mode === 'RESIZING' && selectedNodeIds.length === 1) {
            const nodeId = selectedNodeIds[0];
            const start = state.nodesStart[nodeId];
            if (!start) return;

            const dx = pos.x - state.startPos.x;
            const dy = pos.y - state.startPos.y;
            
            let { x, y, w, h } = start;

            switch (state.resizeHandle) {
                case 'se': w = Math.max(20, start.w + dx); h = Math.max(20, start.h + dy); break;
                case 'sw': x = start.x + dx; w = Math.max(20, start.w - dx); h = Math.max(20, start.h + dy); break;
                case 'ne': y = start.y + dy; w = Math.max(20, start.w + dx); h = Math.max(20, start.h - dy); break;
                case 'nw': x = start.x + dx; y = start.y + dy; w = Math.max(20, start.w - dx); h = Math.max(20, start.h - dy); break;
            }

            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y, width: w, height: h } : n));
        } else if (state.mode === 'CONNECTING') {
            // Force re-render to update the temp line
            setEdges(prev => [...prev]); 
        }
    }, [selectedNodeIds]);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        const state = interactionRef.current;
        
        // Finalize Connection if dropped on a node (handled by nodeMouseUp, but this cleans up if missed)
        state.mode = 'IDLE';
        state.connectStartId = null;
        state.nodesStart = {};
        state.resizeHandle = null;

        // Cleanup listeners
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        
        // Clean temp edge visual
        setEdges(prev => [...prev]);
    }, [handleGlobalMouseMove]);

    const startInteraction = (e: React.MouseEvent, mode: typeof interactionRef.current.mode) => {
        if (readOnly) return;
        const pos = getMousePos(e);
        interactionRef.current.mode = mode;
        interactionRef.current.startPos = pos;
        interactionRef.current.mousePos = pos;
        
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    // --- Element Handlers ---

    const onMouseDownCanvas = (e: React.MouseEvent) => {
        if (readOnly) return;
        if (e.target === svgRef.current) {
            if (tool === 'SELECT') {
                setSelectedNodeIds([]);
            } else if (tool !== 'CONNECTOR' && tool !== 'IMAGE') {
                addNode(getMousePos(e).x, getMousePos(e).y);
            }
        }
    };

    const onMouseDownNode = (e: React.MouseEvent, id: string) => {
        if (readOnly) return;
        e.stopPropagation();
        
        if (tool === 'CONNECTOR') {
            interactionRef.current.connectStartId = id;
            startInteraction(e, 'CONNECTING');
            return;
        }

        if (tool === 'SELECT') {
            const isMulti = e.shiftKey || e.metaKey;
            const isSelected = selectedNodeIds.includes(id);
            
            let newSelection = selectedNodeIds;
            if (isMulti) {
                newSelection = isSelected ? selectedNodeIds.filter(nid => nid !== id) : [...selectedNodeIds, id];
                setSelectedNodeIds(newSelection);
            } else if (!isSelected) {
                newSelection = [id];
                setSelectedNodeIds(newSelection);
            }

            // Prep Drag
            const nodesStart: any = {};
            nodes.forEach(n => {
                if (newSelection.includes(n.id)) {
                    nodesStart[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height };
                }
            });
            interactionRef.current.nodesStart = nodesStart;
            startInteraction(e, 'DRAGGING');
        }
    };

    const onMouseUpNode = (e: React.MouseEvent, id: string) => {
        if (readOnly) return;
        e.stopPropagation();
        const state = interactionRef.current;

        if (state.mode === 'CONNECTING' && state.connectStartId && state.connectStartId !== id) {
            const newEdge: CanvasEdge = {
                id: generateId(),
                fromNode: state.connectStartId,
                toNode: id
            };
            setEdges(prev => [...prev, newEdge]);
        }
    };

    const onMouseDownResize = (e: React.MouseEvent, handle: 'nw' | 'ne' | 'sw' | 'se', id: string) => {
        if (readOnly) return;
        e.stopPropagation();
        interactionRef.current.resizeHandle = handle;
        const node = nodes.find(n => n.id === id);
        if (node) {
            interactionRef.current.nodesStart = { [id]: { x: node.x, y: node.y, w: node.width, h: node.height } };
            startInteraction(e, 'RESIZING');
        }
    };

    const deleteSelected = () => {
        setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
        setEdges(prev => prev.filter(e => !selectedNodeIds.includes(e.fromNode) && !selectedNodeIds.includes(e.toNode)));
        setSelectedNodeIds([]);
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (readOnly) return;
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeIds.length > 0) {
                if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
                deleteSelected();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedNodeIds, readOnly]);

    // --- Renderers ---

    const renderNode = (node: CanvasNode) => {
        const isSelected = selectedNodeIds.includes(node.id);
        const style: React.CSSProperties = {
            cursor: tool === 'SELECT' ? 'move' : 'default',
            filter: isSelected ? 'drop-shadow(0 0 4px rgba(79, 70, 229, 0.5))' : undefined,
        };
        const stroke = isSelected ? '#4f46e5' : node.color === 'transparent' ? 'transparent' : '#e4e4e7';
        const strokeWidth = isSelected ? 2 : 1;

        let content = null;
        if (node.type === 'RECT') content = <rect x={node.x} y={node.y} width={node.width} height={node.height} fill={node.color} stroke={stroke} strokeWidth={strokeWidth} rx={4} />;
        else if (node.type === 'CIRCLE') content = <ellipse cx={node.x + node.width/2} cy={node.y + node.height/2} rx={node.width/2} ry={node.height/2} fill={node.color} stroke={stroke} strokeWidth={strokeWidth} />;
        else if (node.type === 'STICKY') content = <rect x={node.x} y={node.y} width={node.width} height={node.height} fill={node.color} stroke={stroke} strokeWidth={strokeWidth} style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.05))' }} />;
        else if (node.type === 'TEXT') content = isSelected ? <rect x={node.x - 4} y={node.y - 4} width={node.width + 8} height={node.height + 8} fill="none" stroke="#4f46e5" strokeWidth={1} rx={4} /> : null;
        else if (node.type === 'IMAGE') content = (
            <>
                <rect x={node.x} y={node.y} width={node.width} height={node.height} fill="white" stroke={stroke} strokeWidth={strokeWidth} />
                <image href={node.src} x={node.x} y={node.y} width={node.width} height={node.height} preserveAspectRatio="none" />
            </>
        );

        return (
            <g key={node.id} onMouseDown={(e) => onMouseDownNode(e, node.id)} onMouseUp={(e) => onMouseUpNode(e, node.id)} style={style}>
                {content}
                {node.type !== 'IMAGE' && (
                    <foreignObject x={node.x} y={node.y} width={node.width} height={node.height} style={{ pointerEvents: 'none' }}>
                        <div className={`w-full h-full flex items-center justify-center p-2 text-center`}>
                            <textarea 
                                className={`w-full h-full bg-transparent resize-none border-none outline-none focus:ring-0 text-center font-medium ${node.type === 'STICKY' ? 'text-sm' : 'text-base'} text-zinc-800`}
                                style={{ pointerEvents: 'auto' }}
                                value={node.text || ''}
                                onChange={(e) => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: e.target.value } : n))}
                                placeholder={node.type === 'TEXT' ? 'Type something...' : ''}
                            />
                        </div>
                    </foreignObject>
                )}
                {isSelected && !readOnly && selectedNodeIds.length === 1 && (
                    <>
                        <rect x={node.x - 4} y={node.y - 4} width={8} height={8} fill="white" stroke="#4f46e5" className="cursor-nw-resize" onMouseDown={(e) => onMouseDownResize(e, 'nw', node.id)} />
                        <rect x={node.x + node.width - 4} y={node.y - 4} width={8} height={8} fill="white" stroke="#4f46e5" className="cursor-ne-resize" onMouseDown={(e) => onMouseDownResize(e, 'ne', node.id)} />
                        <rect x={node.x - 4} y={node.y + node.height - 4} width={8} height={8} fill="white" stroke="#4f46e5" className="cursor-sw-resize" onMouseDown={(e) => onMouseDownResize(e, 'sw', node.id)} />
                        <rect x={node.x + node.width - 4} y={node.y + node.height - 4} width={8} height={8} fill="white" stroke="#4f46e5" className="cursor-se-resize" onMouseDown={(e) => onMouseDownResize(e, 'se', node.id)} />
                    </>
                )}
            </g>
        );
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50/50 relative overflow-hidden rounded-lg border border-zinc-100">
            {!readOnly && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-xl border border-zinc-100 p-1.5 flex gap-1 z-20">
                    <ToolbarBtn active={tool === 'SELECT'} onClick={() => setTool('SELECT')} icon={<Icons.MousePointer className="w-4 h-4" />} title="Select" />
                    <div className="w-px h-6 bg-zinc-100 mx-1 self-center" />
                    <ToolbarBtn active={tool === 'RECT'} onClick={() => setTool('RECT')} icon={<Icons.Square className="w-4 h-4" />} title="Rectangle" />
                    <ToolbarBtn active={tool === 'CIRCLE'} onClick={() => setTool('CIRCLE')} icon={<Icons.Circle className="w-4 h-4" />} title="Circle" />
                    <ToolbarBtn active={tool === 'STICKY'} onClick={() => setTool('STICKY')} icon={<Icons.StickyNote className="w-4 h-4" />} title="Sticky Note" />
                    <ToolbarBtn active={tool === 'TEXT'} onClick={() => setTool('TEXT')} icon={<Icons.Type className="w-4 h-4" />} title="Text" />
                    <div className="w-px h-6 bg-zinc-100 mx-1 self-center" />
                    <ToolbarBtn active={tool === 'CONNECTOR'} onClick={() => setTool('CONNECTOR')} icon={<Icons.Connector className="w-4 h-4" />} title="Connector" />
                    <ToolbarBtn active={tool === 'IMAGE'} onClick={() => fileInputRef.current?.click()} icon={<Icons.Image className="w-4 h-4" />} title="Upload Image" />
                    <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleImageUpload} />
                    
                    {selectedNodeIds.length > 0 && (
                        <>
                            <div className="w-px h-6 bg-zinc-100 mx-1 self-center" />
                            {COLORS.map(c => (
                                <button key={c.name} onClick={() => { setNodes(prev => prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, color: c.hex } : n)); setActiveColor(c.hex); }} className="w-5 h-5 rounded-full border hover:scale-110 transition-transform" style={{ backgroundColor: c.hex, borderColor: c.border }} />
                            ))}
                            <div className="w-px h-6 bg-zinc-100 mx-1 self-center" />
                            <ToolbarBtn onClick={deleteSelected} icon={<Icons.Trash className="w-4 h-4 text-red-500" />} title="Delete" />
                        </>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar relative" style={{ cursor: tool === 'SELECT' ? 'default' : tool === 'CONNECTOR' ? 'crosshair' : 'copy' }}>
                <div className="min-w-[2000px] min-h-[2000px] bg-white relative shadow-sm m-8 rounded-xl border border-zinc-100">
                    <div className="absolute inset-0 pointer-events-none opacity-[0.4]" style={{ backgroundImage: 'radial-gradient(#d4d4d8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                    <svg ref={svgRef} className="w-full h-full absolute inset-0" onMouseDown={onMouseDownCanvas}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                            </marker>
                        </defs>
                        <g id="edges">{edges.map(edge => {
                            const start = getCenter(edge.fromNode);
                            const end = getCenter(edge.toNode);
                            return <line key={edge.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrowhead)" />;
                        })}</g>
                        <g id="temp-edge">
                            {interactionRef.current.mode === 'CONNECTING' && interactionRef.current.connectStartId && (
                                <line 
                                    x1={getCenter(interactionRef.current.connectStartId).x} 
                                    y1={getCenter(interactionRef.current.connectStartId).y} 
                                    x2={interactionRef.current.mousePos.x} 
                                    y2={interactionRef.current.mousePos.y} 
                                    stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" 
                                />
                            )}
                        </g>
                        <g id="nodes">{nodes.map(renderNode)}</g>
                    </svg>
                </div>
            </div>
        </div>
    );
};

const ToolbarBtn: React.FC<{ active?: boolean, onClick: () => void, icon: React.ReactNode, title: string }> = ({ active, onClick, icon, title }) => (
    <button onClick={onClick} className={`p-2 rounded-full transition-all ${active ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`} title={title}>{icon}</button>
);
