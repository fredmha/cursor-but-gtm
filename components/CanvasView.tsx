import React from 'react';
import { Background, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasStrokePoint, CanvasViewport } from '../types';
import { CanvasInspectorPanel } from './canvas/CanvasInspectorPanel';
import { CanvasTicketLinkModal } from './canvas/CanvasTicketLinkModal';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { getCanvasBoardStyle } from './canvas/canvas-theme';
import { useCanvasController } from './canvas/useCanvasController';

type FreehandDraftOverlayProps = {
  points: CanvasStrokePoint[];
  viewport: CanvasViewport;
};

type PencilCaptureLayerProps = {
  enabled: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
};

/**
 * Determines whether the inspector should render for the current selection.
 * Pencil strokes remain inspector-free to keep freehand interactions lightweight.
 * Tradeoff: pencil styling stays constrained to current draw defaults.
 */
const shouldShowInspector = (selectedKind: string | undefined): boolean =>
  !!selectedKind && selectedKind !== 'PENCIL';

/**
 * Converts a flow-space point into screen-space point for draft stroke preview.
 * Keeping conversion isolated avoids repeating viewport math around canvas render code.
 * Tradeoff: preview assumes a single viewport transform and no nested pane scaling.
 */
const toScreenPoint = (point: CanvasStrokePoint, viewport: CanvasViewport): CanvasStrokePoint => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y
});

/**
 * Builds SVG polyline point strings for freehand draft rendering.
 * This keeps preview formatting deterministic and easy to reuse in tests.
 * Tradeoff: string construction on every pointer move is less optimal than memoized path segments.
 */
const toDraftPolylinePoints = (points: CanvasStrokePoint[], viewport: CanvasViewport): string =>
  points.map(point => {
    const screenPoint = toScreenPoint(point, viewport);
    return `${screenPoint.x},${screenPoint.y}`;
  }).join(' ');

/**
 * Builds draft-circle props for one-point freehand previews.
 * This keeps click-only pencil input visually responsive before stroke commit.
 * Tradeoff: preview circle radius is fixed and not pressure-sensitive.
 */
const toDraftCircle = (
  points: CanvasStrokePoint[],
  viewport: CanvasViewport
): { cx: number; cy: number; r: number } | null => {
  if (points.length !== 1) return null;
  const screenPoint = toScreenPoint(points[0], viewport);
  return { cx: screenPoint.x, cy: screenPoint.y, r: 1.25 };
};

/**
 * Visualizes in-progress freehand drawing above the ReactFlow pane.
 * This preserves immediate drawing feedback before the stroke is persisted as a node.
 * Tradeoff: draft overlay is not part of scene history until stroke commit.
 */
const FreehandDraftOverlay: React.FC<FreehandDraftOverlayProps> = ({ points, viewport }) => {
  if (points.length === 0) return null;
  const circleDraft = toDraftCircle(points, viewport);

  return (
    <svg className="absolute inset-0 z-10 pointer-events-none">
      {circleDraft && (
        <circle
          cx={circleDraft.cx}
          cy={circleDraft.cy}
          r={circleDraft.r}
          fill="#334155"
        />
      )}
      <polyline
        points={toDraftPolylinePoints(points, viewport)}
        fill="none"
        stroke="#334155"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Releases pointer capture when this layer currently owns the pointer.
 * This keeps capture lifecycle balanced and avoids leaking capture ownership between strokes.
 * Tradeoff: explicit release is defensive because browsers also release on pointer up.
 */
const releasePointerCaptureIfHeld = (
  event: React.PointerEvent<HTMLDivElement>
): void => {
  const currentTarget = event.currentTarget;
  if (!currentTarget.hasPointerCapture(event.pointerId)) return;
  currentTarget.releasePointerCapture(event.pointerId);
};

/**
 * Provides a full-canvas pointer capture surface while pencil mode is active.
 * This ensures strokes remain continuous over nodes, edges, and pane background.
 * Tradeoff: while enabled, normal node interaction is intentionally blocked in favor of drawing.
 */
const PencilCaptureLayer: React.FC<PencilCaptureLayerProps> = ({
  enabled,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}) => {
  if (!enabled) return null;

  /**
   * Captures pointer ownership before delegating draw-start handling to controller logic.
   * Capture guarantees move/up delivery even when the pointer leaves underlying canvas content.
   * Tradeoff: capture setup adds a small pointerdown cost to improve draw reliability.
   */
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onPointerDown(event);
  };

  /**
   * Releases pointer capture after draw-end dispatch.
   * This prevents stale ownership from blocking later pointer interactions.
   * Tradeoff: explicit release duplicates browser defaults for robustness.
   */
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    onPointerUp(event);
    releasePointerCaptureIfHeld(event);
  };

  /**
   * Releases pointer capture after draw-cancel dispatch.
   * This aligns cancel cleanup semantics with normal pointer-up completion flow.
   * Tradeoff: cancel and end paths both perform release checks for deterministic cleanup.
   */
  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    onPointerCancel(event);
    releasePointerCaptureIfHeld(event);
  };

  return (
    <div
      data-testid="pencil-capture-layer"
      className="absolute inset-0 z-[15] cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
};

/**
 * Updates the ticket-link modal draft ids using immutable list operations.
 * Isolating this avoids anonymous inline list mutation logic in the JSX tree.
 * Tradeoff: helper depends on controller setter shape and is kept local to this file.
 */
const updateDraftTicketIds = (
  ticketId: string,
  checked: boolean,
  setDraftLinkedTicketIds: (updater: (previousIds: string[]) => string[]) => void
): void => {
  setDraftLinkedTicketIds(previousIds => {
    if (checked) return [...previousIds, ticketId];
    return previousIds.filter(id => id !== ticketId);
  });
};

/**
 * Canvas workspace orchestration component.
 * Inputs: none (reads state via controller hook).
 * Output: full canvas workspace UI.
 * Invariant: business logic remains in controller, render composition stays thin.
 */
const CanvasWorkspace: React.FC = () => {
  const controller = useCanvasController();
  const closeLinkPanel = (): void => controller.setLinkPanelOpen(false);
  const handleToggleLinkTicket = (ticketId: string, checked: boolean): void =>
    updateDraftTicketIds(ticketId, checked, controller.setDraftLinkedTicketIds);
  const inspectorVisible = shouldShowInspector(controller.selectedElement?.kind);
  const drawCaptureLayerEnabled = controller.tool === 'PENCIL' || controller.tool === 'ERASER';

  /**
   * Routes pointer-down capture events to the active draw tool handler.
   * This preserves one shared full-surface capture layer for both drawing and erasing tools.
   * Tradeoff: mode branching adds one dispatch check per capture event.
   */
  const handleDrawPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (controller.tool === 'ERASER') {
      controller.onEraserPointerDown(event);
      return;
    }

    controller.onPencilPointerDown(event);
  };

  /**
   * Routes pointer-move capture events to the active draw tool handler.
   * Shared move routing keeps capture behavior consistent between pencil and eraser modes.
   * Tradeoff: non-draw tools no-op because capture layer is disabled outside draw modes.
   */
  const handleDrawPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (controller.tool === 'ERASER') {
      controller.onEraserPointerMove(event);
      return;
    }

    controller.onPencilPointerMove(event);
  };

  /**
   * Routes pointer-up capture events to the active draw tool handler.
   * This ensures each draw mode closes its gesture lifecycle through controller ownership checks.
   * Tradeoff: pointer-up dispatch relies on current tool state at event time.
   */
  const handleDrawPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (controller.tool === 'ERASER') {
      controller.onEraserPointerUp(event);
      return;
    }

    controller.onPencilPointerUp(event);
  };

  /**
   * Routes pointer-cancel capture events to the active draw tool handler.
   * A shared cancel path avoids stranded pointer refs across tool-specific controllers.
   * Tradeoff: cancellation semantics remain tool-specific after routing.
   */
  const handleDrawPointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (controller.tool === 'ERASER') {
      controller.onEraserPointerCancel(event);
      return;
    }

    controller.onPencilPointerCancel(event);
  };

  if (!controller.campaign) {
    return (
      <div className="h-full flex items-center justify-center bg-white border border-zinc-100 rounded-xl">
        <p className="text-sm text-zinc-500">Initialize a campaign to use the canvas.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden" style={getCanvasBoardStyle()}>
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.96))]" />
      <ReactFlow
        className="!bg-transparent"
        nodes={controller.nodes}
        nodeTypes={controller.nodeTypes}
        onNodesChange={controller.onNodesChange}
        onPaneClick={controller.onPaneClick}
        onInit={controller.setRfInstance}
        onMoveEnd={controller.onMoveEnd}
        defaultViewport={controller.viewport}
        panOnDrag={controller.tool === 'HAND' || controller.spacePan}
        nodesDraggable={controller.tool === 'SELECT' && !controller.spacePan}
        selectionOnDrag={controller.tool === 'SELECT' && !controller.spacePan}
        fitView={false}
        minZoom={0.2}
        maxZoom={3}
      >
        <Background gap={24} color="#cbd5e1" />
      </ReactFlow>

      <PencilCaptureLayer
        enabled={drawCaptureLayerEnabled}
        onPointerDown={handleDrawPointerDown}
        onPointerMove={handleDrawPointerMove}
        onPointerUp={handleDrawPointerUp}
        onPointerCancel={handleDrawPointerCancel}
      />

      <FreehandDraftOverlay points={controller.freehandDraft?.points || []} viewport={controller.viewport} />

      {controller.selectedElement && inspectorVisible && (
        <CanvasInspectorPanel
          selectedElement={controller.selectedElement}
          selectedNodeParentId={controller.selectedNode?.parentId}
          selectedIsEmailCard={controller.selectedIsEmailCard}
          emailSubject={controller.selectedEmailSubject}
          panelIsBlockMode={controller.panelIsBlockMode}
          panelEmailBlocks={controller.panelEmailBlocks}
          requiredEmailBodyBlockId={controller.requiredEmailBodyBlockId}
          activeBlockId={controller.activeBlockId}
          activeSelectedBlock={controller.activeSelectedBlock}
          activeSelectedBlockMetrics={controller.activeSelectedBlockMetrics}
          containerOptions={controller.containerOptions}
          linkedTicketIdsForSelection={controller.linkedTicketIdsForSelection}
          hasTicketLinkOwnerForSelection={controller.hasTicketLinkOwnerForSelection}
          ticketById={controller.ticketById}
          blockLimits={controller.blockLimits}
          onDeleteSelection={controller.removeSelection}
          onSetActiveBlockId={controller.setActiveBlockId}
          onSelectPanelBlock={controller.selectPanelBlock}
          onAddEmailBlock={controller.addEmailBlock}
          onUpdateEmailSubject={controller.updateEmailSubject}
          onUpdateEmailBlock={controller.updateEmailBlock}
          onDeleteEmailBlock={controller.deleteEmailBlock}
          onHandleEmailBlockUpload={controller.handleEmailBlockUpload}
          onUpdateSelectedElement={controller.updateSelectedElement}
          onAssignSelectedParent={controller.assignSelectedParent}
          onOpenLinkPanel={controller.openLinkPanel}
        />
      )}

      <CanvasToolbar
        tool={controller.tool}
        canUndo={controller.canUndo}
        canRedo={controller.canRedo}
        canGroupSelection={controller.canGroupSelection}
        eraserMode={controller.eraserMode}
        eraserSize={controller.eraserSize}
        onSetTool={controller.setTool}
        onSetEraserMode={controller.setEraserMode}
        onSetEraserSize={controller.setEraserSize}
        onUndo={controller.undo}
        onRedo={controller.redo}
        onGroupSelection={controller.groupSelectionIntoContainer}
        onZoomIn={controller.zoomIn}
        onZoomOut={controller.zoomOut}
        onResetView={controller.resetViewport}
        onDeleteSelection={controller.removeSelection}
      />

      <CanvasTicketLinkModal
        open={controller.linkPanelOpen}
        hasSelectedLinkOwner={controller.hasTicketLinkOwnerForSelection}
        search={controller.linkSearch}
        tickets={controller.filteredTickets}
        draftLinkedTicketIds={controller.draftLinkedTicketIds}
        onClose={closeLinkPanel}
        onSearchChange={controller.setLinkSearch}
        onToggleTicket={handleToggleLinkTicket}
        onSave={controller.saveTicketLinks}
      />

      <span className="sr-only">history:{controller.historyVersion}</span>
    </div>
  );
};

export const CanvasView: React.FC = () => (
  <ReactFlowProvider>
    <CanvasWorkspace />
  </ReactFlowProvider>
);
