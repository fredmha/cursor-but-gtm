import { describe, expect, it } from 'vitest';
import { CanvasTool } from '../../types';
import { getElementKindForTool, getToolbarTools } from './canvas-element-catalog';

/**
 * Asserts that toolbar tool definitions do not expose a connector entry.
 * This protects the connector-removal decision from accidental reintroduction.
 * Tradeoff: test intentionally checks for a legacy string that is no longer part of CanvasTool.
 */
const verifyToolbarExcludesConnectorTool = (): void => {
  const toolbarToolIds = getToolbarTools().map(definition => definition.tool);
  expect(toolbarToolIds).not.toContain('CONNECTOR');
};

/**
 * Asserts that unknown tool ids do not map to a creatable canvas element kind.
 * This keeps tool-to-kind mapping strict after connector removal.
 * Tradeoff: casted legacy values are used only for defensive regression coverage.
 */
const verifyLegacyConnectorToolMapsToNull = (): void => {
  const connectorTool = 'CONNECTOR' as CanvasTool;
  expect(getElementKindForTool(connectorTool)).toBeNull();
};

/**
 * Asserts that eraser is exposed in toolbar definitions.
 * This guards the dedicated pencil-eraser affordance from accidental removal.
 * Tradeoff: toolbar order is not asserted, only presence.
 */
const verifyToolbarIncludesEraserTool = (): void => {
  const toolbarToolIds = getToolbarTools().map(definition => definition.tool);
  expect(toolbarToolIds).toContain('ERASER');
};

/**
 * Asserts that eraser does not create persisted element kinds.
 * This keeps eraser in interaction-tool space rather than creation-tool space.
 * Tradeoff: cast is used to verify mapping behavior without polluting main tool-kind table.
 */
const verifyEraserToolMapsToNull = (): void => {
  const eraserTool = 'ERASER' as CanvasTool;
  expect(getElementKindForTool(eraserTool)).toBeNull();
};

describe('canvas element catalog regression', () => {
  it('excludes connector from toolbar definitions', verifyToolbarExcludesConnectorTool);
  it('does not map legacy connector tool ids to element kinds', verifyLegacyConnectorToolMapsToNull);
  it('includes eraser in toolbar definitions', verifyToolbarIncludesEraserTool);
  it('does not map eraser tool ids to element kinds', verifyEraserToolMapsToNull);
});
