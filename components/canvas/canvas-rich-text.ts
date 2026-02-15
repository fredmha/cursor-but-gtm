import { CanvasElementKind } from '../../types';

const EDITABLE_SHAPE_KINDS: CanvasElementKind[] = ['RECTANGLE', 'ELLIPSE', 'DIAMOND', 'TEXT'];
const INDENT_TOKEN = '  ';

/**
 * Escapes user-provided text so it can be safely rendered as HTML.
 * This exists to keep fallback labels safe when no rich text markup is present.
 * Tradeoff: unsupported HTML is displayed as literal text rather than preserved markup.
 */
const escapeHtmlText = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

/**
 * Recursively sanitizes one DOM node into the allowed rich-text subset.
 * This allows only strong/emphasis and line breaks to keep canvas text predictable.
 * Tradeoff: unsupported semantic tags are flattened into plain text content.
 */
const sanitizeNode = (node: ChildNode): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtmlText(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const sanitizedChildren = Array.from(element.childNodes).map(sanitizeNode).join('');

  if (tagName === 'br') return '<br>';
  if (tagName === 'strong' || tagName === 'b') return `<strong>${sanitizedChildren}</strong>`;
  if (tagName === 'em' || tagName === 'i') return `<em>${sanitizedChildren}</em>`;
  if (tagName === 'div' || tagName === 'p') return `${sanitizedChildren}<br>`;
  return sanitizedChildren;
};

/**
 * Normalizes break markup so persisted shape text avoids noisy leading/trailing line tags.
 * This exists because browser contentEditable output can emit inconsistent block-break markup.
 * Tradeoff: intentional trailing blank lines are removed during normalization.
 */
const normalizeBreakMarkup = (value: string): string => {
  const withoutEdgeBreaks = value
    .replace(/^(?:<br\s*\/?>)+/gi, '')
    .replace(/(?:<br\s*\/?>)+$/gi, '');

  return withoutEdgeBreaks.replace(/(?:<br\s*\/?>){3,}/gi, '<br><br>');
};

/**
 * Collects plain text from a sanitized rich-text node tree.
 * This preserves line breaks while stripping formatting tags for label surfaces.
 * Tradeoff: non-text semantic structure is reduced to linear plain text output.
 */
const collectPlainText = (node: ChildNode): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  if (element.tagName.toLowerCase() === 'br') return '\n';
  return Array.from(element.childNodes).map(collectPlainText).join('');
};

/**
 * Converts rich-text HTML into a plain-text string for labels and bridge surfaces.
 * This keeps non-editor surfaces readable when shape text stores formatting markup.
 * Tradeoff: formatting details are dropped in plain-text extraction by design.
 */
export const extractPlainTextFromRichText = (value: string): string => {
  if (!value) return '';

  const container = document.createElement('div');
  container.innerHTML = sanitizeShapeRichText(value);
  return Array.from(container.childNodes).map(collectPlainText).join('').replace(/\u00A0/g, ' ');
};

/**
 * Restricts shape text markup to a safe, minimal rich-text subset.
 * This prevents unsupported tags/scripts from persisting in canvas element payloads.
 * Tradeoff: advanced rich text constructs are intentionally discarded in this first pass.
 */
export const sanitizeShapeRichText = (value: string): string => {
  if (!value) return '';

  const container = document.createElement('div');
  container.innerHTML = value;
  const sanitizedValue = Array.from(container.childNodes).map(sanitizeNode).join('');
  return normalizeBreakMarkup(sanitizedValue);
};

/**
 * Produces HTML suitable for static shape text rendering.
 * This applies sanitization while preserving a safe fallback label when content is empty.
 * Tradeoff: fallback text is escaped and rendered plain, not rich-formatted.
 */
export const toRenderableShapeHtml = (value: string | undefined, fallbackText: string): string => {
  const sanitized = sanitizeShapeRichText(value || '');
  if (sanitized.trim().length > 0) return sanitized;
  return escapeHtmlText(fallbackText);
};

/**
 * Determines if a canvas element kind supports inline rich-text editing.
 * This scopes the first-pass editor to standard text-bearing whiteboard primitives.
 * Tradeoff: container/card labels stay on their existing editing flows for now.
 */
export const isShapeRichTextEditableKind = (kind: CanvasElementKind): boolean =>
  EDITABLE_SHAPE_KINDS.includes(kind);

/**
 * Toggles inline emphasis formatting in the active contentEditable selection.
 * This wraps browser command behavior in a named function for consistent key handling.
 * Tradeoff: command support relies on browser execCommand behavior in contentEditable mode.
 */
export const toggleInlineStyle = (command: 'bold' | 'italic'): boolean =>
  document.execCommand(command, false);

/**
 * Inserts a soft line break at the current caret.
 * This mirrors common Shift+Enter editor behavior without exiting edit mode.
 * Tradeoff: fallback behavior depends on browser handling when insertLineBreak is unavailable.
 */
export const insertSoftLineBreak = (): boolean =>
  document.execCommand('insertLineBreak', false)
  || document.execCommand('insertHTML', false, '<br>');

/**
 * Applies indentation for the active selection in the shape editor.
 * This keeps Tab behavior consistent with common canvas text-edit interactions.
 * Tradeoff: multiline selection indentation is text-based and may simplify rich spans.
 */
export const indentSelectionLines = (): boolean =>
  document.execCommand('insertText', false, INDENT_TOKEN);

/**
 * Attempts to remove one indentation token before the caret.
 * This enables Shift+Tab outdent behavior for the common collapsed-caret path.
 * Tradeoff: outdent currently targets caret-local indentation, not arbitrary multiline selections.
 */
export const outdentSelectionLines = (): boolean => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;

  const range = selection.getRangeAt(0);
  if (!range.collapsed) return false;
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return false;

  const textNode = range.startContainer as Text;
  const caretOffset = range.startOffset;
  const nodeText = textNode.textContent || '';
  const prefixStart = caretOffset - INDENT_TOKEN.length;
  if (prefixStart < 0) return false;
  if (nodeText.slice(prefixStart, caretOffset) !== INDENT_TOKEN) return false;

  const nextText = `${nodeText.slice(0, prefixStart)}${nodeText.slice(caretOffset)}`;
  textNode.textContent = nextText;

  const nextRange = document.createRange();
  nextRange.setStart(textNode, prefixStart);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
};
