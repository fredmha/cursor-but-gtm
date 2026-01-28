# Planning Storage and Context Model

## Goals
- Durable, queryable history of plans and conversations.
- Fast retrieval of recent context (last 3 days, last week, last quarter).
- Simple file system layout for easy debugging.

## File System Layout (Workspace Doc Folders)
Planning lives inside the existing Docs workspace (see `components/DocsView.tsx` + `ContextDoc`/`DocFolder` in `types.ts`). We create a dedicated root folder and keep all planning artifacts as docs within it.

Root: `Docs > Planning/`

```
Docs/
  Planning/ (folder)
    Daily/
      2026-01-28 - Daily Plan (doc)
      2026-01-29 - Daily Plan (doc)
    Weekly/
      2026-W05 - Weekly Plan (doc)
    Quarterly/
      2026-Q1 - Quarterly Plan (doc)
    Sprint/
      launch-2026-q1 - Sprint Plan (doc)
    Context/
      North Star (doc)
      Org Profile (doc)
      Team Roster (doc)
    Uploads/
      Customer-Call-Notes.pdf (file doc)
      Market-Report-2026.pdf (file doc)
    Index/
      Latest Plan (doc)
      Recent Daily (doc)
      Recent Weekly (doc)
```

## Core Artifacts (Stored as Docs)
Each planning artifact is a `ContextDoc`. Content is HTML for human readability, with a structured payload embedded for machine use.

Recommended layout inside each doc:
- **Summary (HTML)**: goal, priorities, risks, decisions.
- **Structured payload**: embedded JSON block in a `<pre data-plan-json>` section.
- **Transcript summary**: compact Q/A notes (optional).

If we need strict separation, create paired docs:
- `{date} - Plan` (summary + JSON)
- `{date} - Transcript` (conversation notes)
 
## Tagging & Metadata
- Use `tags` to classify: `Planning`, `Daily`, `Weekly`, `Quarterly`, `Sprint`, plus date markers like `2026-01-28`.
- Set `isRagIndexed` on the Planning folder and specific docs to include them in retrieval.

## plan.json Schema (Sketch)
```
{
  "horizon": "daily|weekly|quarterly|sprint",
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "northStar": "string",
  "goals": [
    { "id": "g-1", "title": "...", "metric": "...", "priority": 1 }
  ],
  "tasks": [
    { "id": "t-1", "title": "...", "owner": "...", "dueDate": "...", "deps": ["t-2"] }
  ],
  "risks": [ { "id": "r-1", "title": "...", "mitigation": "..." } ],
  "assumptions": ["..."],
  "notes": "..."
}
```

## Retrieval Rules
- Daily plan: fetch last 3 days + today from `Planning/Daily`.
- Weekly plan: fetch last 2 weeks + current week from `Planning/Weekly`.
- Quarterly plan: fetch last 2 quarters + current quarter from `Planning/Quarterly`.
- Sprint plan: fetch by sprint slug from `Planning/Sprint`.
- Context docs: always include `Planning/Context` and any `Uploads` tagged as relevant.

## Data Governance
- Each write is append-only; edits create a new version with a timestamp.
- Store user confirmations in the embedded JSON payload as `confirmedBy` and `confirmedAt`.
- Do not store sensitive data unless explicitly provided by user.

