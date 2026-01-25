# ReviewMode Inline Ticket Edit Modal Plan (2026-01-25)

## Goal
When a user references a ticket with `@` and includes an editing request (e.g., `@T-1 please change name to ticket2`), show an inline ticket-edit modal that previews the requested changes, and allow the user to type `approve` to apply them.

## Constraints / Notes
- Preserve existing Review Agent tool-call approvals.
- Reuse `TicketModal` where possible.
- Keep behavior scoped to `components/ReviewMode.tsx` and avoid breaking other ticket flows.
- Mention suggestions currently depend on `show_tasks` callouts; we will support `@ticketId` or `@shortId` even without mention suggestions.

## Implementation Steps
1. Add ticket-mention parsing and edit-intent detection in `ReviewMode`.
2. Resolve `@` mentions to a concrete ticket across channels/projects (by `shortId` or `id`).
3. Add lightweight edit parsing for common edits:
   - Title: "change name/title to ...", "rename to ...".
   - Description: "change/update description to ...".
   - Priority: "set priority to ...".
4. Introduce new state for inline edit proposals:
   - Proposed ticket reference.
   - Proposed partial updates.
   - Whether inline edit modal is showing.
5. Intercept `handleSend`:
   - If message includes `@ticket` + edit intent with parseable updates, open inline modal instead of sending to the model.
   - Store the original request text for display/context.
6. Modal UX:
   - Reuse `TicketModal` with `initialData` composed from the ticket plus proposed updates.
   - On save, do NOT immediately persist; instead set a pending inline proposal and prompt user to type `approve`.
7. Approval flow:
   - If inline proposal is pending and user types `approve`, apply updates via existing `updateTicket` / `updateProjectTicket` logic.
   - If user types `cancel`/`dismiss`, clear the inline proposal.
8. Chat feedback:
   - Add a system/model-style message describing what changed after approval.
   - Add a model-style prompt after modal save telling the user to type `approve`.

## Validation
- Manual checks in Review Mode:
  - `@T-1 please change name to Ticket 2` opens modal with updated title.
  - Clicking Save prompts for approval.
  - Typing `approve` updates the ticket title.
  - Typing `cancel` clears the pending edit.
  - Normal messages still go to the model.
