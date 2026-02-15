import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasEmailBlock, CanvasElement } from '../../types';
import { CanvasInspectorPanel } from './CanvasInspectorPanel';

type InspectorProps = React.ComponentProps<typeof CanvasInspectorPanel>;

/**
 * Creates a deterministic canvas element fixture for inspector tests.
 * Centralized fixtures keep updater assertions stable across style-control scenarios.
 * Tradeoff: uncommon element fields are omitted unless a test explicitly overrides them.
 */
const createElementFixture = (
  kind: CanvasElement['kind'],
  overrides: Partial<CanvasElement> = {}
): CanvasElement => ({
  id: `${kind.toLowerCase()}-1`,
  kind,
  x: 0,
  y: 0,
  width: 240,
  height: 160,
  zIndex: 1,
  text: 'Shape label',
  style: {
    fill: '#dbeafe',
    stroke: '#1d4ed8',
    strokeWidth: 2,
    fontSize: 14,
    fontFamily: 'Inter'
  },
  ...overrides
});

/**
 * Returns a complete inspector props object with no-op callbacks.
 * This allows focused tests to override only the callback under assertion.
 * Tradeoff: returned props are intentionally verbose to avoid hidden defaults.
 */
const createInspectorProps = (overrides: Partial<InspectorProps> = {}): InspectorProps => ({
  selectedElement: createElementFixture('RECTANGLE'),
  selectedNodeParentId: undefined,
  selectedIsEmailCard: false,
  emailSubject: '',
  panelIsBlockMode: false,
  panelEmailBlocks: [],
  requiredEmailBodyBlockId: null,
  activeBlockId: null,
  activeSelectedBlock: undefined,
  activeSelectedBlockMetrics: null,
  containerOptions: [],
  linkedTicketIdsForSelection: [],
  hasTicketLinkOwnerForSelection: false,
  ticketById: new Map(),
  blockLimits: {
    minHeight: 32,
    maxHeight: 420,
    minFontSize: 10,
    maxFontSize: 48,
    maxPadding: 24,
    maxMarginBottom: 48
  },
  onDeleteSelection: vi.fn(),
  onSetActiveBlockId: vi.fn(),
  onSelectPanelBlock: vi.fn(),
  onAddEmailBlock: vi.fn(),
  onUpdateEmailSubject: vi.fn(),
  onUpdateEmailBlock: vi.fn(),
  onDeleteEmailBlock: vi.fn(),
  onHandleEmailBlockUpload: vi.fn(),
  onUpdateSelectedElement: vi.fn(),
  onAssignSelectedParent: vi.fn(),
  onOpenLinkPanel: vi.fn(),
  ...overrides
});

/**
 * Applies the latest style updater callback to a source element.
 * This helper lets tests validate resulting style payloads without store dependencies.
 * Tradeoff: tests assume the last callback invocation corresponds to the targeted interaction.
 */
const applyLastElementUpdater = (
  onUpdateSelectedElement: ReturnType<typeof vi.fn>,
  sourceElement: CanvasElement
): CanvasElement => {
  const lastCall = onUpdateSelectedElement.mock.calls.at(-1);
  const updater = lastCall?.[0] as ((element: CanvasElement) => CanvasElement) | undefined;
  if (!updater) return sourceElement;
  return updater(sourceElement);
};

/**
 * Creates a deterministic email block fixture for email-card inspector tests.
 * Shared fixture defaults keep email-card coverage concise while preserving explicit overrides.
 * Tradeoff: uncommon block metrics remain implicit unless a test overrides them.
 */
const createEmailBlockFixture = (
  overrides: Partial<CanvasEmailBlock> = {}
): CanvasEmailBlock => ({
  id: 'email-block-1',
  order: 0,
  type: 'BODY',
  align: 'left',
  text: 'Body copy',
  imageUrl: '',
  heightPx: 88,
  fontSizePx: 16,
  paddingY: 8,
  paddingX: 10,
  marginBottomPx: 8,
  ...overrides
});

/**
 * Creates a deterministic email-card element fixture for inspector tests.
 * This centralizes email-template wiring so tests only specify scenario-specific differences.
 * Tradeoff: fixture keeps style defaults from generic element helper for consistency.
 */
const createEmailCardElementFixture = (
  overrides: Partial<CanvasElement> = {}
): CanvasElement => {
  const emailBlock = createEmailBlockFixture();

  return createElementFixture('EMAIL_CARD', {
    width: 460,
    height: 320,
    text: 'Email Card',
    emailTemplate: {
      version: 1,
      subject: 'Subject line...',
      blocks: [emailBlock]
    },
    ...overrides
  });
};

/**
 * Builds inspector props for email-card block-edit mode.
 * This keeps repeated setup deterministic while preserving easy per-test override control.
 * Tradeoff: helper assumes a single active block selection for focused assertions.
 */
const createEmailCardBlockModeProps = (
  blockOverrides: Partial<CanvasEmailBlock> = {},
  overrides: Partial<InspectorProps> = {}
): InspectorProps => {
  const activeSelectedBlock = createEmailBlockFixture(blockOverrides);

  return createInspectorProps({
    selectedElement: createEmailCardElementFixture({
      emailTemplate: {
        version: 1,
        subject: 'Subject line...',
        blocks: [activeSelectedBlock]
      }
    }),
    selectedIsEmailCard: true,
    emailSubject: 'Subject line...',
    panelIsBlockMode: true,
    panelEmailBlocks: [activeSelectedBlock],
    requiredEmailBodyBlockId: null,
    activeBlockId: activeSelectedBlock.id,
    activeSelectedBlock,
    activeSelectedBlockMetrics: {
      heightPx: activeSelectedBlock.heightPx || 88,
      fontSizePx: activeSelectedBlock.fontSizePx || 16,
      paddingY: activeSelectedBlock.paddingY || 8,
      paddingX: activeSelectedBlock.paddingX || 10,
      marginBottomPx: activeSelectedBlock.marginBottomPx || 8
    },
    ...overrides
  });
};

describe('CanvasInspectorPanel primitive style controls', () => {
  it('shows chip and picker controls for primitive shape selections', () => {
    render(<CanvasInspectorPanel {...createInspectorProps()} />);

    expect(screen.getByTestId('shape-fill-picker')).toBeInTheDocument();
    expect(screen.getByTestId('shape-stroke-picker')).toBeInTheDocument();
    expect(screen.getByTestId('shape-stroke-width-input')).toBeInTheDocument();
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('Height')).toBeInTheDocument();
  });

  it('applies selected fill chip color through element updater callback', () => {
    const onUpdateSelectedElement = vi.fn();
    const selectedElement = createElementFixture('RECTANGLE');

    render(
      <CanvasInspectorPanel
        {...createInspectorProps({ selectedElement, onUpdateSelectedElement })}
      />
    );

    fireEvent.click(screen.getByTitle('Fill #dcfce7'));
    const updatedElement = applyLastElementUpdater(onUpdateSelectedElement, selectedElement);

    expect(updatedElement.style?.fill).toBe('#dcfce7');
  });

  it('applies stroke-width input changes through element updater callback', () => {
    const onUpdateSelectedElement = vi.fn();
    const selectedElement = createElementFixture('ELLIPSE');

    render(
      <CanvasInspectorPanel
        {...createInspectorProps({ selectedElement, onUpdateSelectedElement })}
      />
    );

    fireEvent.change(screen.getByTestId('shape-stroke-width-input'), {
      target: { value: '6' }
    });
    const updatedElement = applyLastElementUpdater(onUpdateSelectedElement, selectedElement);

    expect(updatedElement.style?.strokeWidth).toBe(6);
  });
});

describe('CanvasInspectorPanel email-card constraints', () => {
  it('shows only block organization controls for text blocks in email-card block mode', () => {
    render(<CanvasInspectorPanel {...createEmailCardBlockModeProps()} />);

    expect(screen.getByText('Block Editor')).toBeInTheDocument();
    expect(screen.getByTitle('Align left')).toBeInTheDocument();
    expect(screen.getByTestId('email-block-font-size-input')).toBeInTheDocument();

    expect(screen.queryByText('Subject Line (Required)')).not.toBeInTheDocument();
    expect(screen.queryByText('Height')).not.toBeInTheDocument();
    expect(screen.queryByText('Pad X')).not.toBeInTheDocument();
    expect(screen.queryByText('Pad Y')).not.toBeInTheDocument();
    expect(screen.queryByText('Spacing')).not.toBeInTheDocument();
    expect(screen.queryByText('Width')).not.toBeInTheDocument();
    expect(screen.queryByText('Front')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-fill-picker')).not.toBeInTheDocument();
  });

  it('shows alignment but hides font size for image blocks in email-card block mode', () => {
    render(
      <CanvasInspectorPanel
        {...createEmailCardBlockModeProps({
          id: 'image-block-1',
          type: 'IMAGE',
          text: '',
          imageUrl: 'https://example.com/image.png'
        })}
      />
    );

    expect(screen.getByText('Block Editor')).toBeInTheDocument();
    expect(screen.getByTitle('Align center')).toBeInTheDocument();
    expect(screen.queryByTestId('email-block-font-size-input')).not.toBeInTheDocument();
  });

  it('disables delete only when selected block is the last body block', () => {
    const lastBodyBlock = createEmailBlockFixture({ id: 'body-last', type: 'BODY' });

    render(
      <CanvasInspectorPanel
        {...createEmailCardBlockModeProps(
          { id: 'body-last', type: 'BODY' },
          {
            panelEmailBlocks: [lastBodyBlock],
            requiredEmailBodyBlockId: 'body-last'
          }
        )}
      />
    );

    expect(screen.getByText('Last BODY Block (Cannot Delete)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last BODY Block (Cannot Delete)' })).toBeDisabled();
  });

  it('keeps delete enabled when selected body is not the protected last body', () => {
    render(
      <CanvasInspectorPanel
        {...createEmailCardBlockModeProps(
          { id: 'body-a', type: 'BODY' },
          {
            panelEmailBlocks: [
              createEmailBlockFixture({ id: 'body-a', type: 'BODY' }),
              createEmailBlockFixture({ id: 'body-b', type: 'BODY', order: 1, text: 'Secondary body' })
            ],
            requiredEmailBodyBlockId: null
          }
        )}
      />
    );

    expect(screen.getByRole('button', { name: 'Delete Block' })).toBeEnabled();
  });

  it('keeps container and ticket links sections visible for email-card selections', () => {
    const emailBlock = createEmailBlockFixture();

    render(
      <CanvasInspectorPanel
        {...createInspectorProps({
          selectedElement: createEmailCardElementFixture({
            emailTemplate: {
              version: 1,
              subject: 'Subject line...',
              blocks: [emailBlock]
            }
          }),
          selectedIsEmailCard: true,
          emailSubject: 'Subject line...',
          panelIsBlockMode: false,
          panelEmailBlocks: [emailBlock],
          requiredEmailBodyBlockId: emailBlock.id,
          containerOptions: [{ id: 'container-1', label: 'Hero cluster' }]
        })}
      />
    );

    expect(screen.getByText('Container')).toBeInTheDocument();
    expect(screen.getByText('Ticket Links')).toBeInTheDocument();
  });
});
