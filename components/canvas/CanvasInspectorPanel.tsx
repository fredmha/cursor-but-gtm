import React from 'react';
import { CanvasElement, CanvasEmailBlock, EmailBlockType } from '../../types';
import {
  clampNumber,
  EMAIL_BLOCK_ALIGNMENTS,
  EmailBlockMetrics,
  EMAIL_BLOCK_TYPES,
  TicketRef
} from './canvas-core';
import { canAssignParentForKind, getCanvasKindStyleDefaults, supportsPlainTextEditing } from './canvas-element-catalog';
import {
  getFloatingPanelClassName,
  isPrimitiveShapeKind,
  PRIMITIVE_FILL_PALETTE,
  PRIMITIVE_STROKE_PALETTE,
  SHAPE_STROKE_WIDTH_OPTIONS
} from './canvas-theme';
import { ContainerOption } from './useCanvasController';

type CanvasInspectorPanelProps = {
  selectedElement: CanvasElement;
  selectedNodeParentId?: string;
  selectedIsEmailCard: boolean;
  emailSubject: string;
  panelIsBlockMode: boolean;
  panelEmailBlocks: CanvasEmailBlock[];
  requiredEmailBodyBlockId: string | null;
  activeBlockId: string | null;
  activeSelectedBlock: CanvasEmailBlock | undefined;
  activeSelectedBlockMetrics: EmailBlockMetrics | null;
  containerOptions: ContainerOption[];
  linkedTicketIdsForSelection: string[];
  hasTicketLinkOwnerForSelection: boolean;
  ticketById: Map<string, TicketRef>;
  blockLimits: {
    minHeight: number;
    maxHeight: number;
    minFontSize: number;
    maxFontSize: number;
    maxPadding: number;
    maxMarginBottom: number;
  };
  onDeleteSelection: () => void;
  onSetActiveBlockId: (blockId: string | null) => void;
  onSelectPanelBlock: (blockId: string) => void;
  onAddEmailBlock: (type: EmailBlockType) => void;
  onUpdateEmailSubject: (subject: string) => void;
  onUpdateEmailBlock: (blockId: string, updater: (block: CanvasEmailBlock) => CanvasEmailBlock) => void;
  onDeleteEmailBlock: (blockId: string) => void;
  onHandleEmailBlockUpload: (blockId: string, file: File) => void;
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void;
  onAssignSelectedParent: (parentId?: string) => void;
  onOpenLinkPanel: () => void;
};

type PrimitiveShapeStyleControlsProps = {
  selectedElement: CanvasElement;
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void;
};

/**
 * Validates whether a string can be consumed by `input[type="color"]`.
 * This prevents invalid persisted colors from breaking native color picker controls.
 * Tradeoff: only hex notation is accepted for picker fallback compatibility.
 */
const isHexColorValue = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

/**
 * Resolves a stable hex color value for native color picker controls.
 * Invalid or missing values fall back to the provided default color.
 * Tradeoff: shorthand hex and non-hex color strings are normalized by fallback.
 */
const toColorPickerValue = (value: string | undefined, fallback: string): string =>
  value && isHexColorValue(value) ? value : fallback;

/**
 * Applies a fill-color update to the selected element style.
 * Keeping style updates in named helpers avoids duplicated updater closures.
 * Tradeoff: helper assumes caller already validated target element scope.
 */
const updateSelectedFillColor = (
  nextFill: string,
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void
): void => {
  onUpdateSelectedElement(element => ({
    ...element,
    style: { ...(element.style || {}), fill: nextFill }
  }));
};

/**
 * Applies a stroke-color update to the selected element style.
 * Centralizing this logic keeps color controls and picker input behavior aligned.
 * Tradeoff: updater always preserves existing stroke width and typography values.
 */
const updateSelectedStrokeColor = (
  nextStroke: string,
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void
): void => {
  onUpdateSelectedElement(element => ({
    ...element,
    style: { ...(element.style || {}), stroke: nextStroke }
  }));
};

/**
 * Applies a stroke-width update to the selected element style.
 * Explicit clamping keeps persisted style values within a usable range for shapes.
 * Tradeoff: widths outside the supported range are coerced to nearest bounds.
 */
const updateSelectedStrokeWidth = (
  nextWidth: number,
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void
): void => {
  const boundedWidth = clampNumber(nextWidth, 1, 12);
  onUpdateSelectedElement(element => ({
    ...element,
    style: { ...(element.style || {}), strokeWidth: boundedWidth }
  }));
};

/**
 * Renders one palette chip button for color controls.
 * A named helper keeps chip rendering deterministic across fill and stroke rows.
 * Tradeoff: chip visuals are intentionally compact and rely on tooltip text for clarity.
 */
const ColorChipButton: React.FC<{
  color: string;
  selected: boolean;
  onClick: () => void;
  title: string;
}> = ({ color, selected, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`h-6 w-6 rounded-md border transition-shadow ${selected ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-sm' : 'border-zinc-200 hover:ring-1 hover:ring-zinc-300'}`}
    style={{ backgroundColor: color }}
  />
);

/**
 * Primitive shape style controls for fill, stroke, and stroke width.
 * This mirrors modern board tooling with quick chips plus custom picker precision.
 * Tradeoff: controls are intentionally limited to primitive shapes for scope safety.
 */
const PrimitiveShapeStyleControls: React.FC<PrimitiveShapeStyleControlsProps> = ({
  selectedElement,
  onUpdateSelectedElement
}) => {
  const styleDefaults = getCanvasKindStyleDefaults(selectedElement.kind);
  const fillColor = toColorPickerValue(selectedElement.style?.fill, styleDefaults.fill);
  const strokeColor = toColorPickerValue(selectedElement.style?.stroke, styleDefaults.stroke);
  const strokeWidth = selectedElement.style?.strokeWidth ?? styleDefaults.strokeWidth;

  /**
   * Applies one of the preset fill colors from the quick palette.
   * The preset path optimizes for fast iteration while preserving a coherent board palette.
   * Tradeoff: chips are opinionated and may not match every brand palette exactly.
   */
  const applyPresetFillColor = (nextColor: string): void =>
    updateSelectedFillColor(nextColor, onUpdateSelectedElement);

  /**
   * Applies one of the preset stroke colors from the quick palette.
   * This keeps outline styling in lockstep with fill-color iteration workflow.
   * Tradeoff: stroke palette remains finite unless user switches to custom picker input.
   */
  const applyPresetStrokeColor = (nextColor: string): void =>
    updateSelectedStrokeColor(nextColor, onUpdateSelectedElement);

  /**
   * Applies custom fill color from native picker input.
   * Native color picking offers precision while still funneling through shared update helpers.
   * Tradeoff: browser picker UX differs slightly between operating systems.
   */
  const handleFillColorPickerChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    updateSelectedFillColor(event.target.value, onUpdateSelectedElement);

  /**
   * Applies custom stroke color from native picker input.
   * Shared updater logic keeps picker and chip interactions behaviorally identical.
   * Tradeoff: input accepts only hex output from the native picker.
   */
  const handleStrokeColorPickerChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    updateSelectedStrokeColor(event.target.value, onUpdateSelectedElement);

  /**
   * Applies stroke width updates from numeric input.
   * Explicit parsing and clamping avoid invalid persisted style payloads.
   * Tradeoff: fractional widths are rounded by browser numeric input semantics.
   */
  const handleStrokeWidthInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const parsedWidth = Number(event.target.value) || 1;
    updateSelectedStrokeWidth(parsedWidth, onUpdateSelectedElement);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Fill</label>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {PRIMITIVE_FILL_PALETTE.map(color => (
            <ColorChipButton
              key={`fill-${color}`}
              color={color}
              selected={fillColor.toLowerCase() === color.toLowerCase()}
              onClick={() => applyPresetFillColor(color)}
              title={`Fill ${color}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fillColor}
            data-testid="shape-fill-picker"
            className="h-8 w-10 rounded border border-zinc-200 bg-white p-0.5"
            onChange={handleFillColorPickerChange}
          />
          <span className="text-[11px] font-mono text-zinc-500">{fillColor}</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Stroke</label>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {PRIMITIVE_STROKE_PALETTE.map(color => (
            <ColorChipButton
              key={`stroke-${color}`}
              color={color}
              selected={strokeColor.toLowerCase() === color.toLowerCase()}
              onClick={() => applyPresetStrokeColor(color)}
              title={`Stroke ${color}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strokeColor}
            data-testid="shape-stroke-picker"
            className="h-8 w-10 rounded border border-zinc-200 bg-white p-0.5"
            onChange={handleStrokeColorPickerChange}
          />
          <span className="text-[11px] font-mono text-zinc-500">{strokeColor}</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Stroke Width</label>
        <div className="grid grid-cols-5 gap-1 mb-2">
          {SHAPE_STROKE_WIDTH_OPTIONS.map(widthOption => (
            <button
              key={`stroke-width-${widthOption}`}
              type="button"
              onClick={() => updateSelectedStrokeWidth(widthOption, onUpdateSelectedElement)}
              className={`h-7 rounded border text-[11px] font-semibold ${strokeWidth === widthOption ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
            >
              {widthOption}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          max={12}
          step={1}
          data-testid="shape-stroke-width-input"
          value={strokeWidth}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
          onChange={handleStrokeWidthInputChange}
        />
      </div>
    </div>
  );
};

/**
 * Right-side inspector panel for selected canvas element.
 * Inputs: selected model data and callbacks.
 * Output: editor panel UI.
 * Invariant: no direct store mutation; all changes flow through controller callbacks.
 */
export const CanvasInspectorPanel: React.FC<CanvasInspectorPanelProps> = ({
  selectedElement,
  selectedNodeParentId,
  selectedIsEmailCard,
  panelIsBlockMode,
  panelEmailBlocks,
  requiredEmailBodyBlockId,
  activeBlockId,
  activeSelectedBlock,
  activeSelectedBlockMetrics,
  containerOptions,
  linkedTicketIdsForSelection,
  hasTicketLinkOwnerForSelection,
  ticketById,
  blockLimits,
  onDeleteSelection,
  onSetActiveBlockId,
  onSelectPanelBlock,
  onAddEmailBlock,
  onUpdateEmailBlock,
  onDeleteEmailBlock,
  onUpdateSelectedElement,
  onAssignSelectedParent,
  onOpenLinkPanel
}) => {
  const primitiveShapeSelection = isPrimitiveShapeKind(selectedElement.kind);
  const selectedProtectedBodyBlock = !!activeSelectedBlock
    && !!requiredEmailBodyBlockId
    && activeSelectedBlock.id === requiredEmailBodyBlockId;

  return (
  <div className={`absolute top-4 right-4 z-20 w-[320px] rounded-2xl p-3.5 space-y-3 ${getFloatingPanelClassName()}`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">Selection</span>
      <button onClick={onDeleteSelection} className="text-xs text-red-600 hover:text-red-700">Delete</button>
    </div>

    {selectedIsEmailCard ? (
      panelIsBlockMode && activeSelectedBlock ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-zinc-500">Block Editor</label>
            <button
              onClick={() => onSetActiveBlockId(null)}
              className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
            >
              Back to card
            </button>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">{activeSelectedBlock.type}</div>

          <div className="flex items-center rounded border border-zinc-200 overflow-hidden">
            {EMAIL_BLOCK_ALIGNMENTS.map(align => (
              <button
                key={align}
                onClick={() => onUpdateEmailBlock(activeSelectedBlock.id, current => ({ ...current, align }))}
                className={`flex-1 px-1.5 py-1 text-[10px] font-semibold ${activeSelectedBlock.align === align ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                title={`Align ${align}`}
              >
                {align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}
              </button>
            ))}
          </div>

          {activeSelectedBlock.type !== 'IMAGE' && (
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Font Size</label>
              <input
                data-testid="email-block-font-size-input"
                type="number"
                value={activeSelectedBlockMetrics?.fontSizePx ?? blockLimits.minFontSize}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => {
                  const value = clampNumber(Number(event.target.value) || blockLimits.minFontSize, blockLimits.minFontSize, blockLimits.maxFontSize);
                  onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, fontSizePx: value }));
                }}
              />
            </div>
          )}

          <button
            onClick={() => {
              if (selectedProtectedBodyBlock) return;
              onDeleteEmailBlock(activeSelectedBlock.id);
              onSetActiveBlockId(null);
            }}
            disabled={selectedProtectedBodyBlock}
            className={`w-full rounded border px-2 py-1 text-[11px] font-semibold ${selectedProtectedBodyBlock ? 'border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            {selectedProtectedBodyBlock ? 'Last BODY Block (Cannot Delete)' : 'Delete Block'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-zinc-500">Email Builder</label>
            <span className="text-[10px] text-zinc-400">{panelEmailBlocks.length} blocks</span>
          </div>
          <div className="text-[10px] text-zinc-400">Click a block in canvas to edit it.</div>

          <div className="grid grid-cols-2 gap-1">
            {EMAIL_BLOCK_TYPES.map(type => (
              <button
                key={type}
                onClick={() => onAddEmailBlock(type)}
                className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Add {type}
              </button>
            ))}
          </div>

          <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
            {panelEmailBlocks.length === 0 && (
              <div className="rounded border border-dashed border-zinc-200 p-3 text-xs text-zinc-400 text-center">
                Add blocks to build this email.
              </div>
            )}
            {panelEmailBlocks.map(block => (
              <button
                key={block.id}
                onClick={() => onSelectPanelBlock(block.id)}
                className={`w-full rounded border px-2 py-1.5 text-left text-xs ${activeBlockId === block.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-zinc-200 hover:bg-zinc-50'}`}
              >
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">
                  {block.type} #{block.order + 1}{requiredEmailBodyBlockId === block.id ? ' (Last BODY)' : ''}
                </span>
                <div className="truncate text-zinc-600 mt-1">
                  {block.type === 'IMAGE'
                    ? (block.imageUrl ? 'Image block' : 'Image placeholder')
                    : ((block.text || '').trim() || `${block.type} text`)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    ) : supportsPlainTextEditing(selectedElement.kind) ? (
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Text</label>
        <textarea
          value={selectedElement.text || ''}
          rows={3}
          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-800"
          onChange={event => onUpdateSelectedElement(element => ({ ...element, text: event.target.value }))}
        />
      </div>
    ) : (
      <div className="text-xs text-zinc-500">
        This element does not support inline text. Add a Text node to annotate it.
      </div>
    )}

    {!selectedIsEmailCard && (
      <>
        {primitiveShapeSelection ? (
          <PrimitiveShapeStyleControls
            selectedElement={selectedElement}
            onUpdateSelectedElement={onUpdateSelectedElement}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Fill</label>
              <input
                type="text"
                value={selectedElement.style?.fill || ''}
                placeholder="#ffffff"
                className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                onChange={event => onUpdateSelectedElement(element => ({
                  ...element,
                  style: { ...(element.style || {}), fill: event.target.value || undefined }
                }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Stroke</label>
              <input
                type="text"
                value={selectedElement.style?.stroke || ''}
                placeholder="#334155"
                className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                onChange={event => onUpdateSelectedElement(element => ({
                  ...element,
                  style: { ...(element.style || {}), stroke: event.target.value || undefined }
                }))}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Width</label>
            <input
              type="number"
              value={selectedElement.width}
              className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              onChange={event => onUpdateSelectedElement(element => ({ ...element, width: Math.max(120, Number(event.target.value) || 120) }))}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Height</label>
            <input
              type="number"
              value={selectedElement.height}
              className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              onChange={event => onUpdateSelectedElement(element => ({ ...element, height: Math.max(80, Number(event.target.value) || 80) }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdateSelectedElement(element => ({ ...element, zIndex: Math.max(0, element.zIndex - 1) }))}
            className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Back
          </button>
          <button
            onClick={() => onUpdateSelectedElement(element => ({ ...element, zIndex: element.zIndex + 1 }))}
            className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Front
          </button>
        </div>
      </>
    )}

    {canAssignParentForKind(selectedElement.kind) && (
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Container</label>
        <select
          value={selectedNodeParentId || ''}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
          onChange={event => onAssignSelectedParent(event.target.value || undefined)}
        >
          <option value="">No container</option>
          {containerOptions.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
    )}

    <div className="border-t border-zinc-100 pt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ticket Links</span>
        <button
          onClick={onOpenLinkPanel}
          disabled={!hasTicketLinkOwnerForSelection}
          className={`text-xs ${hasTicketLinkOwnerForSelection ? 'text-indigo-600 hover:text-indigo-700' : 'text-zinc-300 cursor-not-allowed'}`}
        >
          Manage
        </button>
      </div>
      {!hasTicketLinkOwnerForSelection && (
        <div className="text-[11px] text-zinc-400 mb-1">Assign this element to a container to link tickets.</div>
      )}
      <div className="flex flex-wrap gap-1">
        {linkedTicketIdsForSelection.length === 0 && <span className="text-xs text-zinc-400">No links</span>}
        {linkedTicketIdsForSelection.map(ticketId => {
          const ticket = ticketById.get(ticketId);
          return (
            <span key={ticketId} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px]">
              {ticket ? ticket.shortId : ticketId.slice(0, 8)}
            </span>
          );
        })}
      </div>
    </div>
  </div>
  );
};
