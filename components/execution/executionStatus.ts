import { TicketStatus } from '../../types';

/**
 * Purpose:
 * - Execution-table status policy for UI options and commit safety.
 *
 * Must not contain:
 * - store updates
 * - rendering logic
 */
export const EXECUTION_STATUS_OPTIONS: TicketStatus[] = [
  TicketStatus.Todo,
  TicketStatus.InProgress,
  TicketStatus.Done
];

export const isExecutionStatus = (status: TicketStatus): boolean =>
  EXECUTION_STATUS_OPTIONS.includes(status);

export const isLegacyExecutionStatus = (status: TicketStatus): boolean =>
  !isExecutionStatus(status);

/**
 * Returns select options for a status editor cell.
 *
 * Invariant:
 * - Legacy values are preserved in the dropdown so opening edit mode never silently remaps data.
 */
export const getStatusSelectOptions = (currentStatus: TicketStatus): TicketStatus[] => {
  if (isExecutionStatus(currentStatus)) return EXECUTION_STATUS_OPTIONS;
  return [currentStatus, ...EXECUTION_STATUS_OPTIONS].filter((status, index, values) => values.indexOf(status) === index);
};

/**
 * Resolves whether a status draft can be committed.
 *
 * Rules:
 * - Any explicit 3-state selection is accepted.
 * - Re-selecting the current legacy value is treated as no-op (null).
 * - Any other value is rejected to avoid accidental coercion.
 */
export const resolveStatusCommit = (originalStatus: TicketStatus, draftValue: string): TicketStatus | null => {
  if (isExecutionStatus(draftValue as TicketStatus)) return draftValue as TicketStatus;
  if (draftValue === originalStatus && isLegacyExecutionStatus(originalStatus)) return null;
  return null;
};
