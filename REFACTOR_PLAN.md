# Planning Agent Refactor Plan

Date: 2026-02-03
Owner: user
Goal: reduce scope to a planning-only agent that manages user-assigned tasks.

## Product Definition (First Principles)
Core user needs:
- Create a task assigned to the user.
- Edit a task assigned to the user.
- Delete a task assigned to the user.
- Show tasks currently in the user log. (kanban, inline modals, existing functionality is here, please do not delete)
- Summarize current task status/progress.

Non-goals (explicitly out of scope for this refactor):
- Multi-user task assignment, delegation, or permissions.
- Project management features (backlogs, sprints, milestones, dependencies).
- Knowledge base, document management, or external integrations.
- Assistant personas, routing, or multi-agent orchestration.
- Planning docs, SOPs, or implementation guides beyond this plan.

## Target Data Model (Minimal)
Task
- id (string)
- title (string)
- status (enum: todo | doing | blocked | done)
- createdAt (ISO string)
- updatedAt (ISO string)
- notes (optional string)

TaskLog
- tasks (array of Task)

## Functional Scope
1) Create task
- Input: title, optional notes
- Output: new task in log

2) Edit task
- Editable fields: title, status, notes
- Output: task updated in log

3) Delete task
- Input: task id
- Output: task removed from log

4) Show tasks
- Output: list of tasks in log

5) Summarize tasks
- Output: counts by status + short list of key tasks (doing/blocked)

## Refactor Strategy
Phase 1: Inventory
- Identify existing task data store(s) and UI surfaces.
- Identify any existing task CRUD handlers.
- Preserve only code paths supporting the five core functions.

Phase 2: Strip & Consolidate
- Remove non-essential features, flows, and UI that do not support core scope. (slash commands and workflows - just need core functionality)
- Consolidate task state to a single source of truth.
- Ensure task CRUD functions are minimal and explicit.

Phase 3: Rebuild Core UX
- Task list view (with filters by status).
- Simple task detail/edit form.
- Delete confirmation.
- Summary panel (counts + key tasks).

Phase 4: Hardening
- Add minimal validation (title required).
- Basic empty/error states.
- One lightweight persistence strategy (existing store if already present).

## Acceptance Criteria
- User can create, edit, delete tasks that are assigned to them.
- User can view a list of current tasks.
- User can view a summary of current tasks.
- No other features remain in UI or code paths.

## File/Docs Policy
- All planning or implementation docs outside this plan should remain deleted.
- This plan is the only planning artifact until core functionality is stable.
