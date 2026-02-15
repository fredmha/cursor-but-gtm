import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Campaign, CanvasElement } from '../types';
import { CanvasView } from './CanvasView';
import { CanvasController, useCanvasController } from './canvas/useCanvasController';

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  ),
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="react-flow-background" />
}));

vi.mock('./canvas/CanvasInspectorPanel', () => ({
  CanvasInspectorPanel: () => <div data-testid="canvas-inspector-panel" />
}));

vi.mock('./canvas/CanvasToolbar', () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />
}));

vi.mock('./canvas/CanvasTicketLinkModal', () => ({
  CanvasTicketLinkModal: () => null
}));

vi.mock('./canvas/useCanvasController', () => ({
  useCanvasController: vi.fn()
}));

type ControllerFixtureOverrides = {
  selectedElement?: CanvasElement;
  selectedIsEmailCard?: boolean;
};

/**
 * Creates a campaign fixture with only required fields for controller truthiness.
 * This keeps tests focused on inspector visibility instead of campaign construction.
 * Tradeoff: fixture omits optional campaign data that does not affect CanvasView rendering.
 */
const createCampaignFixture = (): Campaign => ({
  id: 'campaign-1',
  name: 'Campaign',
  objective: 'Objective',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  status: 'Planning',
  channels: [],
  projects: [],
  principles: []
});

/**
 * Creates a canvas element fixture for selection-state rendering tests.
 * Centralizing element shape avoids duplicated boilerplate across scenarios.
 * Tradeoff: defaults are generic and scenario-specific fields must be overridden by kind.
 */
const createElementFixture = (kind: CanvasElement['kind']): CanvasElement => ({
  id: `${kind.toLowerCase()}-1`,
  kind,
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  zIndex: 1,
  text: kind === 'EMAIL_CARD' ? 'Email Card' : '',
  style: {
    fill: '#ffffff',
    stroke: '#0f172a',
    strokeWidth: 1,
    fontSize: 14,
    fontFamily: 'Inter'
  },
  emailTemplate: kind === 'EMAIL_CARD' ? { version: 1, subject: 'Subject line...', blocks: [] } : undefined,
  stroke: kind === 'PENCIL' ? { points: [{ x: 0, y: 0 }, { x: 12, y: 6 }] } : undefined
});

/**
 * Builds a complete controller fixture while allowing scenario-level selection overrides.
 * Keeping this helper centralized minimizes test drift as CanvasView dependencies evolve.
 * Tradeoff: function returns a casted fixture because tests only exercise a narrow behavior slice.
 */
const createControllerFixture = (overrides: ControllerFixtureOverrides = {}): CanvasController => {
  const selectedElement = overrides.selectedElement;
  const selectedIsEmailCard = overrides.selectedIsEmailCard ?? (selectedElement?.kind === 'EMAIL_CARD');

  const controllerFixture = {
    campaign: createCampaignFixture(),
    nodes: [],
    nodeTypes: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    tool: 'SELECT',
    eraserMode: 'WHOLE_STROKE',
    eraserSize: 16,
    spacePan: false,
    rfInstance: null,
    historyVersion: 0,
    linkPanelOpen: false,
    linkSearch: '',
    draftLinkedTicketIds: [],
    filteredTickets: [],
    selectedNode: undefined,
    selectedElement,
    selectedIsEmailCard,
    selectedEmailSubject: '',
    panelIsBlockMode: false,
    panelEmailBlocks: [],
    requiredEmailBodyBlockId: null,
    activeSelectedBlock: undefined,
    activeSelectedBlockMetrics: null,
    activeBlockId: null,
    freehandDraft: null,
    containerOptions: [],
    linkedTicketIdsForSelection: [],
    hasTicketLinkOwnerForSelection: false,
    ticketById: new Map(),
    canUndo: false,
    canRedo: false,
    canGroupSelection: false,
    setRfInstance: vi.fn(),
    setTool: vi.fn(),
    setEraserMode: vi.fn(),
    setEraserSize: vi.fn(),
    setLinkPanelOpen: vi.fn(),
    setLinkSearch: vi.fn(),
    setDraftLinkedTicketIds: vi.fn(),
    setActiveBlockId: vi.fn(),
    onNodesChange: vi.fn(),
    onPaneClick: vi.fn(),
    onPencilPointerDown: vi.fn(),
    onPencilPointerMove: vi.fn(),
    onPencilPointerUp: vi.fn(),
    onPencilPointerCancel: vi.fn(),
    onEraserPointerDown: vi.fn(),
    onEraserPointerMove: vi.fn(),
    onEraserPointerUp: vi.fn(),
    onEraserPointerCancel: vi.fn(),
    onMoveEnd: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    removeSelection: vi.fn(),
    groupSelectionIntoContainer: vi.fn(),
    addEmailBlock: vi.fn(),
    updateEmailSubject: vi.fn(),
    updateEmailBlock: vi.fn(),
    deleteEmailBlock: vi.fn(),
    handleEmailBlockUpload: vi.fn(),
    updateSelectedElement: vi.fn(),
    assignSelectedParent: vi.fn(),
    openLinkPanel: vi.fn(),
    saveTicketLinks: vi.fn(),
    selectPanelBlock: vi.fn(),
    resetViewport: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    blockTypeOptions: ['H1', 'H2', 'H3', 'BODY', 'IMAGE'],
    blockLimits: {
      minHeight: 40,
      maxHeight: 400,
      minFontSize: 10,
      maxFontSize: 56,
      maxPadding: 48,
      maxMarginBottom: 72
    }
  };

  return controllerFixture as unknown as CanvasController;
};

/**
 * Renders CanvasView with the provided controller fixture using the mocked controller hook.
 * This helper isolates hook stubbing so each test can focus on one visibility assertion.
 * Tradeoff: tests validate rendered output rather than inspecting internal branch conditions directly.
 */
const renderWithControllerFixture = (controller: CanvasController): void => {
  vi.mocked(useCanvasController).mockReturnValue(controller);
  render(<CanvasView />);
};

/**
 * Asserts that primitive shape selections render the inspector panel.
 * This verifies shape styling controls are reachable without opening email-card mode.
 * Tradeoff: behavior assumes inspector excludes only explicitly unsupported kinds.
 */
const verifyRectangleSelectionShowsInspector = (): void => {
  renderWithControllerFixture(createControllerFixture({
    selectedElement: createElementFixture('RECTANGLE'),
    selectedIsEmailCard: false
  }));

  expect(screen.getByTestId('canvas-inspector-panel')).toBeInTheDocument();
};

/**
 * Asserts that pencil selections do not render the inspector panel.
 * This guards against regressions where freehand nodes incorrectly receive email-card controls.
 * Tradeoff: pencil metadata changes remain unavailable in the inspector by design.
 */
const verifyPencilSelectionHidesInspector = (): void => {
  renderWithControllerFixture(createControllerFixture({
    selectedElement: createElementFixture('PENCIL'),
    selectedIsEmailCard: false
  }));

  expect(screen.queryByTestId('canvas-inspector-panel')).not.toBeInTheDocument();
};

/**
 * Asserts that email-card selections render the inspector panel.
 * This is the core regression guard for the inverted visibility condition.
 * Tradeoff: assumes controller exposes `selectedIsEmailCard` consistently with selected element kind.
 */
const verifyEmailCardSelectionShowsInspector = (): void => {
  renderWithControllerFixture(createControllerFixture({
    selectedElement: createElementFixture('EMAIL_CARD'),
    selectedIsEmailCard: true
  }));

  expect(screen.getByTestId('canvas-inspector-panel')).toBeInTheDocument();
};

/**
 * Asserts that no selection renders no inspector.
 * This preserves baseline behavior for idle canvas state.
 * Tradeoff: test does not assert fallback UI beyond inspector absence.
 */
const verifyNoSelectionHidesInspector = (): void => {
  renderWithControllerFixture(createControllerFixture({
    selectedElement: undefined,
    selectedIsEmailCard: false
  }));

  expect(screen.queryByTestId('canvas-inspector-panel')).not.toBeInTheDocument();
};

/**
 * Asserts that pencil mode mounts the capture layer used for reliable freehand input.
 * This guards the full-surface drawing behavior over nodes and pane background.
 * Tradeoff: test validates layer presence, not low-level pointer capture mechanics.
 */
const verifyPencilModeShowsCaptureLayer = (): void => {
  const controller = createControllerFixture();
  controller.tool = 'PENCIL';

  renderWithControllerFixture(controller);
  expect(screen.getByTestId('pencil-capture-layer')).toBeInTheDocument();
};

/**
 * Asserts that non-pencil modes do not mount the pointer capture layer.
 * This preserves default select/drag interaction when drawing is not active.
 * Tradeoff: mode coverage focuses on SELECT as the representative non-drawing state.
 */
const verifySelectModeHidesCaptureLayer = (): void => {
  const controller = createControllerFixture();
  controller.tool = 'SELECT';

  renderWithControllerFixture(controller);
  expect(screen.queryByTestId('pencil-capture-layer')).not.toBeInTheDocument();
};

/**
 * Asserts that eraser mode mounts the shared draw capture layer.
 * This guards against regressions where erasing fails to capture pointer events over the full canvas.
 * Tradeoff: test verifies mount state but not mode-specific pointer dispatching.
 */
const verifyEraserModeShowsCaptureLayer = (): void => {
  const controller = createControllerFixture();
  controller.tool = 'ERASER';

  renderWithControllerFixture(controller);
  expect(screen.getByTestId('pencil-capture-layer')).toBeInTheDocument();
};

describe('CanvasView inspector visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows inspector for rectangle selections', verifyRectangleSelectionShowsInspector);
  it('hides inspector for pencil selections', verifyPencilSelectionHidesInspector);
  it('shows inspector for email-card selections', verifyEmailCardSelectionShowsInspector);
  it('hides inspector when there is no selection', verifyNoSelectionHidesInspector);
  it('shows capture layer in pencil mode', verifyPencilModeShowsCaptureLayer);
  it('shows capture layer in eraser mode', verifyEraserModeShowsCaptureLayer);
  it('hides capture layer outside pencil mode', verifySelectModeHidesCaptureLayer);
});
