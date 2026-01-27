# Agent Reference Resolution Plan (2026-01-27)

Goal: When users talk to the Review Agent (Chief of Staff), they can reference tickets, docs, channels, projects, and team members with or without @, and the agent can gather the right context to answer accurately.

## Scope
- Resolve references in user prompts (explicit @mentions and unmentioned natural language).
- Add tools + UI handlers so the agent can fetch the right data before answering.
- Keep the agent’s “Chief of Staff” behavior: concise, execution-focused, and context-aware.

---

## Phase 1 — Data Indexing + Mention Capture

### 1.1 Build Unified Reference Index
- Create a helper that aggregates:
  - Tickets (id, shortId, title, status, dueDate, assigneeId)
  - Docs (id, shortId, title)
  - Channels (id, name)
  - Projects (id, name, status)
  - Users (id, name)
- Normalize into a common structure:
  - `type`, `id`, `label`, `aliases[]`, `shortId?`

### 1.2 Improve In-Message Mention Parsing
- Extend current `@` parsing to resolve:
  - Tickets (shortId or id)
  - Docs (shortId or id)
  - Users (by name or id)
  - Channels / Projects (by name or id)
- Support multi-mention in a single prompt.

---

## Phase 2 — New Agent Tools

### 2.1 Add a General “resolve_references” Tool
Add a tool the agent can call with raw user input and get back structured references.

**Example response:**
```
{
  "tickets": ["T-102", "ticket-id-123"],
  "docs": ["DOC-17"],
  "channels": ["channel-id-1"],
  "projects": ["project-id-2"],
  "users": ["user-id-3"]
}
```

### 2.2 Add a “fetch_reference_context” Tool
Takes reference ids and returns detail snippets (titles, summaries, statuses, due dates).
This lets the agent respond correctly even if the user only says “@alex and @T-102”.

---

## Phase 3 — Agent Instructions + Behavior

### 3.1 Update System Instructions
- If user mentions @references, always call `resolve_references`.
- If references are detected, call `fetch_reference_context` before responding.
- If no explicit @references, attempt semantic resolution for:
  - Tickets by title
  - Users by name
  - Channels/Projects by name
- If ambiguous, ask a clarifying question.

### 3.2 Chief of Staff Answering Style
- Summarize the relevant context.
- Provide next steps / options.
- Keep responses short and action-oriented.

---

## Phase 4 — UI + ReviewMode Integration

### 4.1 Tool Call Handling
- Add new tool handlers in `ReviewMode.tsx`:
  - `resolve_references`
  - `fetch_reference_context`
- Return data through tool response messages so the model can answer correctly.

### 4.2 Inline Mention Suggestions
- Extend mention dropdown to include:
  - Docs
  - Channels
  - Projects
  - Users

---

## Verification Plan

### Manual Tests
1. “What’s the status of @T-12 and @Onboarding Doc?”
   - Expect: agent calls resolve + fetch, then summarizes.

2. “Show me everything @Alex owns this week.”
   - Expect: agent resolves Alex, queries tasks, summarizes.

3. “What’s going on in Growth Channel?”
   - Expect: agent resolves channel by name and pulls context.

4. “Update the Q1 Launch project status?”
   - Expect: agent resolves project by name or asks clarification if multiple.

---

## Files Likely to Change
- `services/reviewAgent.ts` (tool definitions + system instructions)
- `components/ReviewMode.tsx` (tool handling + mention parsing)
- `docs/agent-commands.md` (document new reference patterns)
