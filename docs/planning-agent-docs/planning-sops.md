# Planning SOPs (Daily, Weekly, Quarterly, Sprint)

## Shared SOP: Session Initialization
1) Identify the command, horizon, and owner(s).
2) Load recent plans for the same horizon (from Docs > Planning/*).
3) Load active tasks, projects, and team roster from the in-app data model.
4) Ask only for missing context (capacity changes, blockers, or constraints not found in data).
5) Summarize retrieved context before proposing priorities.

### Canonical queries to run (in-app data)
- Daily plans (previous 2-3 days): Docs in Planning/Daily, sorted by lastUpdated.
- Weekly plan (current week): Docs in Planning/Weekly for the current week range.
- Quarterly plan (current quarter): Docs in Planning/Quarterly for the current quarter range.
- Tasks: tickets in status In Progress or Todo, sorted by priority and due date.
- Blockers: tickets in status Blocked or Backlog with dependency notes.
- Projects/Channels: active projects and channel lists for alignment.

## Shared SOP: Readiness Gate
- Confirm status changes from the previous plan (done, in progress, blocked).
- Surface blockers and dependencies.
- Reconcile backlog with goals (remove or re-scope misaligned items).
- Confirm capacity and time horizon assumptions.

## Shared SOP: Confirmation Rules
- Do not create or update tasks without explicit user confirmation.
- Always show the proposed plan before saving.

---

# /start daily plan
Purpose: Keep daily execution simple, reduce friction, and feed weekly planning with accurate status.

## Phase 1: Context Gathering (agentic)
1) Load previous 2-3 daily plans (date-verified).
2) Load current weekly plan and quarterly plan for alignment.
3) Load active tasks (In Progress + Todo) and due today/overdue.
4) Load meetings/time blocks if available; otherwise ask for the top time constraints.

## Phase 2: Task Status Reconciliation (HITL)
1) Identify tasks completed since the last daily plan.
2) Flag tasks that appear complete but are still open.
3) Ask for approval to mark status changes.
4) If blocked by dependency, set to Waiting/On Hold and note the blocker.

## Phase 3: Priority Assessment & Planning
1) Propose top 3 priorities based on tasks + weekly goals.
2) Create today’s Daily Plan doc (mandatory) in Docs > Planning/Daily.
3) Include sections:
   - Top 3 priorities
   - Other priorities
   - Brain dump
   - North Star check-in
   - Tasks created/updated
   - End of day review (empty)
4) Present the plan summary in chat and ask for confirmation.

## Phase 4: Execution Support
- Append user notes to the Daily Plan doc throughout the day.
- Update progress on priorities during check-ins.

---

# /start weekly plan
Purpose: Align the week to goals, ensure dependencies are covered, and balance workload.

## Steps
1) Load last week’s plan, outcomes, and unresolved items.
2) Identify carryovers and ask for close/rescope decisions.
3) Confirm the week’s objective and key milestones.
4) Review team capacity and availability.
5) Propose weekly goals and tasks by owner.
6) Validate dependencies across teams.
7) Summarize and confirm before saving.

---

# /start quarterly plan
Purpose: Set strategic goals, define initiatives, and sequence execution for the quarter.

## Steps
1) Load previous quarter summary and current roadmap.
2) Ask for the north star objective and success metrics.
3) Review market context, product roadmap, and constraints.
4) Draft initiatives and map to goals and metrics.
5) Define milestones by month.
6) Identify resourcing gaps and hiring/outsourcing needs.
7) Summarize and confirm before saving.

---

# /set sprint plan
Purpose: Bind the agent to a specific launch or sprint context and prepare a focused plan.

## Steps
1) Collect sprint/launch details (timeline, definition of done).
2) Load related previous plans and active projects.
3) Identify critical path work and dependencies.
4) Propose sprint goals and backlog.
5) Confirm scope and freeze changes.
6) Summarize and confirm before saving.
