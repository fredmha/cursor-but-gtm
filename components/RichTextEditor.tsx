
import React, { useRef, useEffect, useState } from 'react';
import { Icons } from '../constants';

interface RichTextEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    readOnly?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange, readOnly = false }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [activeFormats, setActiveFormats] = useState<string[]>([]);

    // Sync initial content once
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent;
        }
    }, [initialContent]);

    // Check for active formats on cursor move
    const checkFormats = () => {
        if (!editorRef.current) return;
        const formats: string[] = [];
        if (document.queryCommandState('bold')) formats.push('bold');
        if (document.queryCommandState('italic')) formats.push('italic');
        if (document.queryCommandState('underline')) formats.push('underline');
        if (document.queryCommandState('insertUnorderedList')) formats.push('ul');
        if (document.queryCommandState('insertOrderedList')) formats.push('ol');
        setActiveFormats(formats);
    };

    const handleInput = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            onChange(html);
        }
        checkFormats();
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
        handleInput();
    };

    const insertTable = () => {
        const tableHTML = `
            <table class="border-collapse w-full my-4">
                <thead>
                    <tr>
                        <th class="border border-zinc-300 p-2 bg-zinc-50">Header 1</th>
                        <th class="border border-zinc-300 p-2 bg-zinc-50">Header 2</th>
                        <th class="border border-zinc-300 p-2 bg-zinc-50">Header 3</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="border border-zinc-300 p-2">Cell 1</td>
                        <td class="border border-zinc-300 p-2">Cell 2</td>
                        <td class="border border-zinc-300 p-2">Cell 3</td>
                    </tr>
                    <tr>
                        <td class="border border-zinc-300 p-2">Cell 4</td>
                        <td class="border border-zinc-300 p-2">Cell 5</td>
                        <td class="border border-zinc-300 p-2">Cell 6</td>
                    </tr>
                </tbody>
            </table>
            <p><br /></p>
        `;
        execCmd('insertHTML', tableHTML);
    };

    const insertCodeBlock = () => {
        const codeHTML = `
            <pre class="bg-zinc-900 text-zinc-100 p-4 rounded-lg my-4 overflow-x-auto font-mono text-sm"><code>// Your code here</code></pre>
            <p><br /></p>
        `;
        execCmd('insertHTML', codeHTML);
    };

    const insertBlockquote = () => {
        execCmd('formatBlock', 'BLOCKQUOTE');
    };

    const insertDivider = () => {
        const dividerHTML = `<hr class="border-t border-zinc-200 my-6" /><p><br /></p>`;
        execCmd('insertHTML', dividerHTML);
    };

    const insertCallout = () => {
        const calloutHTML = `
            <div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 my-4 rounded-r-lg">
                <div class="flex items-start gap-2">
                    <span class="text-indigo-600 font-bold">💡</span>
                    <p class="text-indigo-900 text-sm m-0">Add your note here...</p>
                </div>
            </div>
            <p><br /></p>
        `;
        execCmd('insertHTML', calloutHTML);
    };

    if (readOnly) {
        return (
            <div
                className="prose prose-zinc prose-sm max-w-none text-zinc-700 outline-none [&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600"
                dangerouslySetInnerHTML={{ __html: initialContent }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-zinc-100 shadow-sm relative group focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-100 transition-all">
            {/* Toolbar - Sticky */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-zinc-100 bg-zinc-50/50 rounded-t-lg sticky top-0 z-10 backdrop-blur-sm">

                {/* Text Styles */}
                <div className="flex gap-0.5 bg-white border border-zinc-200 rounded-md p-0.5">
                    <ToolbarButton isActive={activeFormats.includes('bold')} onClick={() => execCmd('bold')} icon={<span className="font-bold font-serif">B</span>} title="Bold (Ctrl+B)" />
                    <ToolbarButton isActive={activeFormats.includes('italic')} onClick={() => execCmd('italic')} icon={<span className="italic font-serif">I</span>} title="Italic (Ctrl+I)" />
                    <ToolbarButton isActive={activeFormats.includes('underline')} onClick={() => execCmd('underline')} icon={<span className="underline font-serif">U</span>} title="Underline (Ctrl+U)" />
                    <ToolbarButton onClick={() => execCmd('strikeThrough')} icon={<span className="line-through font-serif">S</span>} title="Strikethrough" />
                </div>

                <div className="w-px h-6 bg-zinc-200 mx-1" />

                {/* Headings */}
                <div className="flex gap-0.5 bg-white border border-zinc-200 rounded-md p-0.5">
                    <ToolbarButton onClick={() => execCmd('formatBlock', 'H1')} icon="H1" title="Heading 1" />
                    <ToolbarButton onClick={() => execCmd('formatBlock', 'H2')} icon="H2" title="Heading 2" />
                    <ToolbarButton onClick={() => execCmd('formatBlock', 'H3')} icon="H3" title="Heading 3" />
                </div>

                <div className="w-px h-6 bg-zinc-200 mx-1" />

                {/* Lists */}
                <div className="flex gap-0.5 bg-white border border-zinc-200 rounded-md p-0.5">
                    <ToolbarButton isActive={activeFormats.includes('ul')} onClick={() => execCmd('insertUnorderedList')} icon={<Icons.List className="w-4 h-4" />} title="Bullet List" />
                    <ToolbarButton isActive={activeFormats.includes('ol')} onClick={() => execCmd('insertOrderedList')} icon="1." title="Numbered List" />
                </div>

                <div className="w-px h-6 bg-zinc-200 mx-1" />

                {/* Blocks */}
                <div className="flex gap-0.5 bg-white border border-zinc-200 rounded-md p-0.5">
                    <ToolbarButton onClick={insertBlockquote} icon={<Icons.Quote className="w-4 h-4" />} title="Blockquote" />
                    <ToolbarButton onClick={insertCodeBlock} icon={<Icons.Code className="w-4 h-4" />} title="Code Block" />
                    <ToolbarButton onClick={insertCallout} icon={<Icons.AlertCircle className="w-4 h-4" />} title="Callout" />
                    <ToolbarButton onClick={insertDivider} icon={<Icons.Minus className="w-4 h-4" />} title="Divider" />
                </div>

                <div className="w-px h-6 bg-zinc-200 mx-1" />

                {/* Inserts */}
                <div className="flex gap-0.5 bg-white border border-zinc-200 rounded-md p-0.5">
                    <ToolbarButton onClick={insertTable} icon={<Icons.Kanban className="w-4 h-4" />} title="Insert Table" />
                    <ToolbarButton onClick={() => execCmd('createLink', prompt('Enter URL:') || '')} icon={<Icons.Link className="w-4 h-4" />} title="Link" />
                </div>

                <div className="w-px h-6 bg-zinc-200 mx-1" />

                {/* Clear */}
                <ToolbarButton onClick={() => execCmd('removeFormat')} icon={<Icons.XCircle className="w-4 h-4" />} title="Clear Formatting" />

            </div>

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onKeyUp={checkFormats}
                onMouseUp={checkFormats}
                className="flex-1 p-8 outline-none prose prose-zinc prose-sm max-w-none text-zinc-700 cursor-text overflow-y-auto [&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600"
                style={{ minHeight: '500px' }}
            />
        </div>
    );
};

const ToolbarButton: React.FC<{ onClick: () => void; icon: React.ReactNode; title: string; isActive?: boolean }> = ({ onClick, icon, title, isActive }) => (
    <button
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        className={`p-1.5 rounded text-xs font-bold min-w-[28px] h-[28px] flex items-center justify-center transition-colors ${isActive
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
        title={title}
        type="button"
    >
        {icon}
    </button>
);
