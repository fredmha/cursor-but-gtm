import React from 'react';
import { Background, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasStrokePoint, CanvasViewport } from '../types';
import { CanvasInspectorPanel } from './canvas/CanvasInspectorPanel';
import { CanvasTicketLinkModal } from './canvas/CanvasTicketLinkModal';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { useCanvasController } from './canvas/useCanvasController';

type FreehandDraftOverlayProps = {
  points: CanvasStrokePoint[];
  viewport: CanvasViewport;
};

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
 * Visualizes in-progress freehand drawing above the ReactFlow pane.
 * This preserves immediate drawing feedback before the stroke is persisted as a node.
 * Tradeoff: draft overlay is not part of scene history until stroke commit.
 */
const FreehandDraftOverlay: React.FC<FreehandDraftOverlayProps> = ({ points, viewport }) => {
  if (points.length < 2) return null;

  return (
    <svg className="absolute inset-0 z-10 pointer-events-none">
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

  if (!controller.campaign) {
    return (
      <div className="h-full flex items-center justify-center bg-white border border-zinc-100 rounded-xl">
        <p className="text-sm text-zinc-500">Initialize a campaign to use the canvas.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-50 relative">
      <ReactFlow
        nodes={controller.nodes}
        edges={controller.edges}
        nodeTypes={controller.nodeTypes}
        onNodesChange={controller.onNodesChange}
        onEdgesChange={controller.onEdgesChange}
        onConnect={controller.onConnect}
        onPaneClick={controller.onPaneClick}
        onPaneMouseMove={controller.onPaneMouseMove}
        onPaneMouseLeave={controller.onPaneMouseLeave}
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
        <Background gap={24} color="#e4e4e7" />
      </ReactFlow>

      <FreehandDraftOverlay points={controller.freehandDraft?.points || []} viewport={controller.viewport} />

      {controller.selectedElement && !controller.selectedIsEmailCard && (
        <CanvasInspectorPanel
          selectedElement={controller.selectedElement}
          selectedNodeParentId={controller.selectedNode?.parentId}
          selectedIsEmailCard={controller.selectedIsEmailCard}
          panelIsBlockMode={controller.panelIsBlockMode}
          panelEmailBlocks={controller.panelEmailBlocks}
          activeBlockId={controller.activeBlockId}
          activeSelectedBlock={controller.activeSelectedBlock}
          activeSelectedBlockMetrics={controller.activeSelectedBlockMetrics}
          containerOptions={controller.containerOptions}
          linkedTicketIdsForSelection={controller.linkedTicketIdsForSelection}
          ticketById={controller.ticketById}
          blockLimits={controller.blockLimits}
          onDeleteSelection={controller.removeSelection}
          onSetActiveBlockId={controller.setActiveBlockId}
          onSelectPanelBlock={controller.selectPanelBlock}
          onAddEmailBlock={controller.addEmailBlock}
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
        onSetTool={controller.setTool}
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
        hasSelectedNode={!!controller.selectedNode}
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
