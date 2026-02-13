import React from 'react';
import { Background, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasInspectorPanel } from './canvas/CanvasInspectorPanel';
import { CanvasTicketLinkModal } from './canvas/CanvasTicketLinkModal';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { useCanvasController } from './canvas/useCanvasController';

/**
 * Canvas workspace orchestration component.
 * Inputs: none (reads state via controller hook).
 * Output: full canvas workspace UI.
 * Invariant: business logic remains in controller, render composition stays thin.
 */
const CanvasWorkspace: React.FC = () => {
  const controller = useCanvasController();

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

      {controller.selectedElement && (
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
        onSetTool={controller.setTool}
        onUndo={controller.undo}
        onRedo={controller.redo}
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
        onClose={() => controller.setLinkPanelOpen(false)}
        onSearchChange={controller.setLinkSearch}
        onToggleTicket={(ticketId, checked) => {
          controller.setDraftLinkedTicketIds(previousIds => {
            if (checked) return [...previousIds, ticketId];
            return previousIds.filter(id => id !== ticketId);
          });
        }}
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
