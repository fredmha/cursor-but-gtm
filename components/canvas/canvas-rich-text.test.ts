import { describe, expect, it, vi } from 'vitest';
import {
  extractPlainTextFromRichText,
  indentSelectionLines,
  isShapeRichTextEditableKind,
  outdentSelectionLines,
  sanitizeShapeRichText,
  toRenderableShapeHtml,
  toggleInlineStyle
} from './canvas-rich-text';

/**
 * Installs a temporary execCommand mock for environments that do not implement it.
 * This keeps command-wrapper tests stable across jsdom/browser runtime differences.
 * Tradeoff: command behavior itself is not simulated beyond call verification.
 */
const installExecCommandMock = (): ReturnType<typeof vi.fn> => {
  const mock = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, 'execCommand', {
    value: mock,
    configurable: true
  });
  return mock;
};

/**
 * Creates a text-node caret selection inside an element at a given offset.
 * This keeps range setup deterministic for indentation helper tests.
 * Tradeoff: helper assumes firstChild is a text node for focused unit scenarios.
 */
const setCollapsedSelection = (element: HTMLElement, offset: number): void => {
  const textNode = element.firstChild as Text;
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);

  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
};

describe('canvas rich-text helpers', () => {
  it('sanitizes unsupported tags while keeping allowed emphasis markup', () => {
    const input = '<div>Hello <b>world</b><script>alert(1)</script></div><p><i>Again</i></p>';
    const sanitized = sanitizeShapeRichText(input);

    expect(sanitized).toBe('Hello <strong>world</strong>alert(1)<br><em>Again</em>');
  });

  it('extracts plain text from rich content for non-editor labels', () => {
    const plainText = extractPlainTextFromRichText('<strong>Header</strong><br>Line two');
    expect(plainText).toBe('Header\nLine two');
  });

  it('renders escaped fallback text when rich content is empty', () => {
    const renderable = toRenderableShapeHtml('', '<Unsafe>');
    expect(renderable).toBe('&lt;Unsafe&gt;');
  });

  it('identifies editable shape kinds for inline rich-text mode', () => {
    expect(isShapeRichTextEditableKind('RECTANGLE')).toBe(true);
    expect(isShapeRichTextEditableKind('TEXT')).toBe(true);
    expect(isShapeRichTextEditableKind('PENCIL')).toBe(false);
    expect(isShapeRichTextEditableKind('CONTAINER')).toBe(false);
  });

  it('indents collapsed selection via insertText command', () => {
    const execCommandSpy = installExecCommandMock();
    const didIndent = indentSelectionLines();
    expect(didIndent).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, '  ');
  });

  it('outdents one indent token before the caret for collapsed text selection', () => {
    const editor = document.createElement('div');
    editor.textContent = '  item';
    document.body.appendChild(editor);

    setCollapsedSelection(editor, 2);
    const didOutdent = outdentSelectionLines();

    expect(didOutdent).toBe(true);
    expect(editor.textContent).toBe('item');
    editor.remove();
  });

  it('proxies rich-style toggle commands through document execCommand', () => {
    const execCommandSpy = installExecCommandMock();
    const didToggle = toggleInlineStyle('bold');
    expect(didToggle).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('bold', false);
  });
});
