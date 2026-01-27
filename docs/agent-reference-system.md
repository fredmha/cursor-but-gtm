# Agent Reference System (Chief of Staff)

Purpose: Developer-first reference for how the Review Agent resolves references (tickets, docs, channels, projects, users), how the tooling works, and how to test behavior end-to-end. Use this as architecture guide + QA checklist.

---

## Architecture Overview

### Key Concepts
- References = tickets, docs, channels, projects, or users.
- Explicit references use `@token` (e.g., `@t-12`, `@growth-channel`).
- Implicit references are natural language mentions without `@`.
- Chief of Staff persona: concise, execution-focused, context-aware.

### Main Components
- `services/reviewAgent.ts`
  - Tool definitions and system instructions.
  - Defines `resolve_references` and `fetch_reference_context`.
- `components/ReviewMode.tsx`
  - Builds a unified reference index.
  - Handles `resolve_references` and `fetch_reference_context`.
  - Expands mention dropdown to include all entity types.
  - Renders final agent output.

---

## Tooling: How It Works

### 1) `resolve_references`
Purpose: Convert user input into structured IDs.

Input
```
{
  "text": "What's the status of @t-12 and the Q1 Launch project?",
  "mentionTokens": ["t-12"]
}
```

Output (example)
```
{
  "tickets": ["ticket-id-123"],
  "docs": [],
  "channels": [],
  "projects": ["project-id-456"],
  "users": [],
  "ambiguous": [],
  "unresolved": []
}
```

Resolution sources:
- Alias match (id, shortId, slugified name, compact name).
- Semantic match (normalized label appears in normalized prompt).

If multiple matches exist, `ambiguous` is filled and the agent should ask for clarification.

---

### 2) `fetch_reference_context`
Purpose: Fetch summarized entity context for accurate responses.

Input
```
{
  "tickets": ["ticket-id-123"],
  "projects": ["project-id-456"]
}
```

Output (example)
```
{
  "tickets": [
    {
      "id": "ticket-id-123",
      "shortId": "T-12",
      "title": "Launch planning",
      "status": "Todo",
      "priority": "High",
      "assigneeName": "Alex",
      "dueDate": "2026-02-10",
      "channelName": "Growth"
    }
  ],
  "projects": [
    {
      "id": "project-id-456",
      "name": "Q1 Launch",
      "status": "On Track",
      "description": "Launch GTM for Q1",
      "ownerName": "Sam"
    }
  ]
}
```

---

## Reference Indexing

Unified reference index includes:
- Tickets → `shortId`, `id`
- Docs → `shortId`, slugified title, `id`
- Channels → slugified name, `id`
- Projects → slugified name, `id`
- Users → slugified name, `id`, initials

Supports:
- Explicit `@` mention resolution.
- Implicit semantic resolution (label match).

---

## System Instructions (Agent Behavior)

Rules:
- If the user references any entity (with or without `@`), call `resolve_references`.
- If details are required, call `fetch_reference_context`.
- If ambiguous, ask a clarifying question.
- Keep responses short and action-oriented.

---

## UI Behavior (ReviewMode)

### Mention Dropdown
When typing `@`, suggestions include:
- Tickets
- Docs
- Users
- Channels
- Projects

### Pending Actions
`resolve_references` and `fetch_reference_context` are auto-handled. No approval card.

---

## Testing Guide (Behavior Checklist)

### A. Explicit @ Mentions
1. Input: `What's the status of @T-12?`
   - Expected tools: `resolve_references` → `fetch_reference_context`
   - Expected response: Ticket status, assignee, due date.

2. Input: `Summarize @Onboarding-Doc`
   - Expected tools: `resolve_references` → `fetch_reference_context`
   - Expected response: Title + short excerpt.

---

### B. Implicit References (No @)
3. Input: `What's going on in Growth Channel?`
   - Expected: channel resolved by name.
   - Response: channel summary or clarification if ambiguous.

4. Input: `Summarize Q1 Launch project`
   - Expected: project resolved by name.
   - Response: project status, owner, summary.

---

### C. Multi-Entity Queries
5. Input: `Status on @T-12 and @alex`
   - Expected: resolve both ticket and user.
   - Response: ticket status + prompt to show Alex's tasks.

6. Input: `What’s the status of T-12 and Q1 Launch?`
   - Expected: semantic resolution of ticket + project.

---

### D. Ambiguity Handling
7. Input: `Show me Alex’s tasks`
   - If multiple Alex users exist → ask to clarify.

8. Input: `Update the Growth channel`
   - If multiple channels match → ask to clarify.

---

### E. Reference Context
9. Input: `What’s due for @alex this week?`
   - Expected: resolve user → query tasks → show tasks.

10. Input: `What’s blocked on @T-12?`
   - Expected: resolve ticket → fetch context → answer with status + next step.

---

## Expected UI Cards / Models

- `show_tasks` → Ticket cards (Kanban callout)
- `propose_ticket` / `create_task` → AgentTicketCard
- `resolve_references` / `fetch_reference_context` → no UI card

---

## File References
- `services/reviewAgent.ts`
- `components/ReviewMode.tsx`
- `implementationplans/agent-reference-resolution-plan.md`
