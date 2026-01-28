# Planning SOPs (Daily, Weekly, Quarterly, Sprint)

## Shared SOP: Session Initialization
1) Identify command, horizon, and owner(s).
2) Load previous plan(s) for the same horizon.
3) Load active tasks, projects, and team roster.
4) Ask for any new constraints or changes (scope, capacity, deadlines).
5) Request missing context or uploads (docs, spreadsheets, notes) when needed.

## Shared SOP: Readiness Gate
- Confirm last session status changes (done, in progress, blocked).
- Surface blockers and dependencies.
- Reconcile backlog with goals (remove or re-scope misaligned items).
- Confirm available capacity (people, hours, budget).

## Shared SOP: Planning Output
- Goals (3-7, prioritized, time-bounded).
- Tasks per goal (owner, due date, dependencies).
- Risks and mitigations.
- Success criteria and check-ins.

---

## /start daily plan
Purpose: Focus on today's execution, unblock work, and align the day to weekly goals.

### Steps
1) Load yesterday's plan and today’s due tasks.
2) Ask for status updates on overdue or in-progress items.
3) Ask: "Any new blockers since last check-in?"
4) Confirm today's capacity (focus time, meetings, out of office).
5) Propose the top 3 priorities.
6) Confirm updates and schedule next check-in.

### Required Prompts
- "What changed since yesterday?"
- "What is the single most important outcome today?"
- "What is blocked and who can unblock it?"

### Outputs
- 3-5 priority tasks
- Blocker list with owners
- End-of-day check-in reminder

---

## /start weekly plan
Purpose: Align the week to goals, ensure dependencies are covered, and balance workload.

### Steps
1) Load last week’s plan, outcomes, and unresolved items.
2) Identify carryovers and ask for close/rescope decisions.
3) Confirm the week's objective and key milestones.
4) Review team capacity and availability.
5) Draft weekly goals and task breakdown by owner.
6) Validate dependencies across teams.
7) Confirm and store the weekly plan.

### Required Prompts
- "What must be true by Friday to call this week a win?"
- "Which tasks are at risk due to dependencies or staffing?"
- "What should be de-scoped to protect focus?"

### Outputs
- Weekly goals (3-5)
- Task list per owner with dates
- Risk and dependency list

---

## /start quarterly plan
Purpose: Set strategic goals, define initiatives, and sequence execution for the quarter.

### Steps
1) Load previous quarter summary and current roadmap.
2) Ask for the north star objective and success metrics.
3) Review market context, product roadmap, and constraints.
4) Draft initiatives and map to goals and metrics.
5) Define milestones by month.
6) Identify resourcing gaps and hiring/outsourcing needs.
7) Confirm and store the quarterly plan.

### Required Prompts
- "What are the top 3 outcomes this quarter?"
- "Which metric is the single source of truth for success?"
- "What tradeoffs are we willing to make?"

### Outputs
- Quarterly objectives with metrics
- Initiative map and monthly milestones
- Resourcing plan and risks

---

## /set sprint plan
Purpose: Bind the agent to a specific launch or sprint context and prepare a focused plan.

### Steps
1) Collect sprint/launch details (timeline, definition of done).
2) Load related previous plans and active projects.
3) Identify critical path work and dependencies.
4) Propose sprint goals and backlog.
5) Confirm scope and freeze changes.
6) Store sprint context and plan artifacts.

### Required Prompts
- "What is the launch date and definition of done?"
- "Which dependencies could slip the launch?"
- "Who owns each milestone?"

### Outputs
- Sprint goals and backlog
- Critical path and milestones
- Communication and status cadence

---

## Escalation Rules
- If ambiguity exists in goals or ownership, ask clarifying questions.
- If blockers are external, log them and propose an escalation path.
- If scope exceeds capacity, require explicit de-scope decisions.

## Confirmation Rules
- Do not write tasks or updates without explicit user confirmation.
- Always summarize the proposed plan before saving.

