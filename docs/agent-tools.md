# Agent Tooling Spec: Upload-First Planning Subtools

## 1. Purpose and Scope

This document defines an upload-first tooling architecture for the planning agent. It specifies:

- How files are uploaded and converted into planning context.
- How planning subtools retrieve existing campaign hierarchy (channels, projects, docs).
- How the agent proposes modular, dependency-aware plans without auto-mutating state.
- How tools conditionally call other tools based on runtime results.

In scope:

- Tool contracts (inputs, outputs, routing behavior).
- Conditional orchestration between upload, context, topology, and planning tools.
- Propose-only action model with explicit execution boundary.

Out of scope:

- UI implementation details.
- Final execution runner implementation.
- Backend persistence (system stays local-first for v1).

## 2. Principles

1. Propose-only default
- Planning tools return proposals, never direct writes.
- Any mutation requires explicit approval and a separate apply step.

2. Work hierarchy integrity
- Tickets, plans, and docs must map to campaign hierarchy.
- Proposed actions must preserve `Campaign -> Channel/Project -> Ticket`.

3. No direct store mutation from the model
- The model emits tool calls and proposal payloads.
- UI/runner is responsible for mapping approved actions to store mutations.

4. Local-first context handling
- Uploaded files are transformed into metadata + extracted text.
- Raw binaries are not stored in `campaign` state in v1.

5. Deterministic orchestration
- Tool routing is rule-based and condition-driven.
- Errors return structured `NOOP` proposals, not hidden failures.

## 3. Canonical Types

```ts
type ProposedActionType =
  | 'CREATE_CHANNEL'
  | 'CREATE_PROJECT'
  | 'CREATE_DOC'
  | 'CREATE_PLAN_MODULE'
  | 'LINK_DOC'
  | 'NOOP';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface UploadedContextAsset {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO timestamp
  source: 'UPLOAD' | 'PASTE' | 'EXTERNAL_IMPORT';
  status: 'UPLOADED' | 'EXTRACTED' | 'FAILED';
  hash: string; // dedupe key
  textContent?: string;
  summary?: string;
  tags?: string[];
  linkedDocId?: string;
  linkedChannelId?: string;
  linkedProjectId?: string;
}

interface PlanningContextSnapshot {
  campaignId: string;
  objective: string;
  channels: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  docs: Array<{ id: string; title: string; tags?: string[]; channelId?: string }>;
  gaps: {
    missingChannels: string[];
    missingProjects: string[];
    missingDocs: string[];
  };
}

interface ProposedAction {
  id: string;
  type: ProposedActionType;
  reason: string;
  confidence: number; // 0..1
  riskLevel: RiskLevel;
  dependencies: string[]; // action IDs
  payload: Record<string, unknown>;
}

interface PlanModule {
  id: string;
  name: string;
  objective: string;
  contextRefs: string[]; // asset IDs, doc IDs, channel/project IDs
  actions: ProposedAction[];
  status: 'DRAFT' | 'READY' | 'BLOCKED';
}

interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

## 4. Tool Function Catalog

## 4.1 Upload and Docs Tools

### `upload_context_file(input)`

Purpose:
- Ingest a user-selected file and create an upload asset record.

Input:
- `fileName`, `mimeType`, `sizeBytes`, `binaryRef` (opaque file handle), `source`.

Output:
- `ToolResult<UploadedContextAsset>` with `status: 'UPLOADED'`.

Rules:
- Reject unsupported MIME.
- Reject files over max size.
- Return duplicate marker if hash already exists.

### `extract_upload_context(input)`

Purpose:
- Parse uploaded file into normalized text and summary.

Input:
- `assetId`, optional parse options.

Output:
- `ToolResult<{ assetId: string; extractedText: string; summary: string; entities: string[] }>`

Rules:
- On parser failure, set asset status `FAILED`.
- Do not create docs in this step.

### `register_context_doc(input)`

Purpose:
- Produce a proposal for persisting extracted upload as a context doc.

Input:
- `assetId`, `title`, optional `channelHint`, `projectHint`, `tags`.

Output:
- `ToolResult<{ proposedAction: ProposedAction }>`

Rules:
- This is propose-only in default flow.
- Proposed payload must map to `ContextDoc` shape.

## 4.2 Planning Topology Tools

### `get_planning_topology(input)`

Purpose:
- Retrieve current hierarchy and planning surface from campaign state.

Input:
- Optional filters (`channelIds`, `projectIds`, `includeDocs`).

Output:
- `ToolResult<PlanningContextSnapshot>`

### `detect_planning_gaps(input)`

Purpose:
- Compare intent + uploaded context to existing topology and detect missing structure.

Input:
- `snapshot`, `intent`, optional `assetIds`.

Output:
- `ToolResult<{ gaps: PlanningContextSnapshot['gaps']; recommendedActions: ProposedAction[] }>`

Rules:
- Missing structure must be returned as proposals, not writes.

### `build_modular_plan(input)`

Purpose:
- Build module-based plan blocks anchored to existing or proposed hierarchy nodes.

Input:
- `snapshot`, `intent`, `constraints`, optional `assetIds`.

Output:
- `ToolResult<{ modules: PlanModule[] }>`

## 4.3 Proposal and Approval Tools

### `propose_plan_actions(input)`

Purpose:
- Convert gaps and modules into ordered proposed actions with dependencies.

Input:
- `gaps`, `modules`.

Output:
- `ToolResult<{ actions: ProposedAction[] }>`

### `review_proposed_actions(input)`

Purpose:
- Capture user approvals/rejections and annotate rationale.

Input:
- `actions`, `userDecisions`.

Output:
- `ToolResult<{ approved: string[]; rejected: string[]; notes?: string }>`

### `apply_approved_actions(input)`

Purpose:
- Execute only approved action IDs.

Input:
- `approvedActionIds`, `allActions`.

Output:
- `ToolResult<{ createdIds: string[]; failed: Array<{ actionId: string; reason: string }> }>`

Rule:
- Never called automatically by planning flow.
- Requires explicit user confirmation boundary.

## 4.4 Compatibility Mapping with Existing Planning Contract

Current spec placeholders in `services/planningAgent.ts` can map as:

- `upload_context` -> `upload_context_file` + `extract_upload_context`
- `load_plans` -> `get_planning_topology` + `build_modular_plan`
- `save_plan` -> `apply_approved_actions` (after confirmation only)
- `list_tasks` -> read-only task context helper for module generation
- `list_team` -> read-only staffing context helper

## 5. Conditional Orchestration Graph

## 5.1 Primary Flow

1. Intake
- Trigger: user uploads a file or asks planning from context.
- Call: `upload_context_file` (if new upload) or skip to topology if no file.

2. Extraction
- Condition: upload succeeded and MIME supported.
- Call: `extract_upload_context`.
- Else: return `NOOP` proposal with recovery guidance.

3. Topology retrieval
- Call: `get_planning_topology`.

4. Gap detection
- Call: `detect_planning_gaps` using topology + extracted context + user intent.

5. Module generation
- Call: `build_modular_plan`.

6. Proposal generation
- Call: `propose_plan_actions`.

7. Review and commit boundary
- Call: `review_proposed_actions`.
- Optional and explicit only: `apply_approved_actions`.

## 5.2 Routing Rules

1. If file unsupported or oversized:
- Stop upload path.
- Emit `NOOP` proposal with `riskLevel: LOW`, include allowed file guidance.

2. If extracted context strongly maps to existing channel/project:
- Prefer `LINK_DOC` and `CREATE_PLAN_MODULE`.
- Avoid `CREATE_CHANNEL` or `CREATE_PROJECT`.

3. If required channel/project is missing:
- Emit `CREATE_CHANNEL` or `CREATE_PROJECT` proposal first.
- Dependent module actions reference missing-node action IDs in `dependencies`.

4. If confidence is below threshold (`< 0.6`):
- Emit clarifying proposal bundle with alternatives, no apply step.

## 6. Upload Lifecycle (Focus)

## 6.1 Supported File Types (v1)

Allowed extensions and MIME classes:

- `.md`, `.txt` -> text
- `.json` -> structured text
- `.csv` -> tabular text
- `.docx` -> parsed text through adapter

Explicitly excluded in this spec phase:

- Raw binary persistence for images, PDFs, and arbitrary binary blobs.
- Existing `CanvasEditor` image upload behavior remains unchanged.

## 6.2 Validation Defaults

- Max file size per upload: 5 MB
- Max cumulative upload size per planning session: 20 MB
- Duplicate detection key: `sha256(name + size + normalizedContentSnippet)`
- Reject empty extracted text after parsing

## 6.3 Storage Strategy

For each accepted upload:

- Persist upload metadata in upload context memory/state.
- Persist extracted text and summary only.
- Optionally propose doc registration into `campaign.docs` as `ContextDoc`.

No raw binary is persisted in `campaign` localStorage in v1.

## 6.4 Mapping to Current App Data Model

When action is approved, runner maps proposal payloads to store actions:

- `CREATE_DOC` -> `addDoc(...)`
- `LINK_DOC` -> `updateDoc(...)` and optional `linkDocToTicket(...)` if ticket target exists
- Channel/project creation proposals map to `addChannel(...)` or `addProject(...)`

All mutations must occur in store actions, never inside model/tool logic.

## 7. Planning Lifecycle (Topology, Gaps, Modular Plans)

## 7.1 Topology Retrieval

`get_planning_topology` reads:

- `campaign.objective`
- `campaign.channels`
- `campaign.projects`
- `campaign.docs`

Output includes a normalized snapshot plus `gaps` scaffold.

## 7.2 Gap Detection

`detect_planning_gaps` evaluates:

- Missing contexts required by intent (example: asks for a lifecycle plan but no lifecycle channel exists).
- Missing project containers for finite initiatives.
- Missing docs needed for traceability.

Every gap must become a proposal, not a mutation.

## 7.3 Modular Plan Build

`build_modular_plan` creates modules that are:

- Scoped: one objective per module.
- Referenced: each module points to source context refs.
- Dependency-aware: modules can be `BLOCKED` until parent structure is approved.

## 7.4 Action Proposals

`propose_plan_actions` returns ordered actions:

1. Structure creation (`CREATE_CHANNEL`, `CREATE_PROJECT`)
2. Context registration (`CREATE_DOC`, `LINK_DOC`)
3. Plan units (`CREATE_PLAN_MODULE`)

Dependency order must be explicit through `dependencies`.

## 8. Approval and Execution Boundary

Default behavior:

- Planning session ends with proposal set and rationale.
- No automatic writes occur.

Execution behavior (separate step):

- User approves action IDs.
- Runner calls `apply_approved_actions`.
- Runner performs idempotent application and returns created IDs/failures.

Safety gates:

- Reject apply call if no explicit approval payload present.
- Reject any non-approved action in execution payload.
- Log action-to-store mapping for traceability.

## 9. Failure Modes and Recovery

1. Unsupported file type
- Return structured error `UNSUPPORTED_FILE_TYPE`.
- Recovery: ask for supported format or text paste.

2. Size limit exceeded
- Return `FILE_TOO_LARGE`.
- Recovery: split file, trim appendices, or upload summary.

3. Parse failure
- Return `PARSE_FAILED` + parser diagnostics.
- Recovery: retry with plain text export.

4. Duplicate upload
- Return `DUPLICATE_ASSET`.
- Recovery: reuse existing asset reference.

5. Topology unavailable
- Return `TOPOLOGY_UNAVAILABLE`.
- Recovery: rehydrate campaign state and retry.

6. Low-confidence planning inference
- Return `LOW_CONFIDENCE` proposal bundle.
- Recovery: request intent clarification before new proposals.

7. Partial apply failure
- Return failed action list with reasons.
- Recovery: retry only failed actions after dependency check.

## 10. Acceptance Tests

1. Upload success path
- Given a valid `.md` file under 5 MB
- When upload and extraction run
- Then asset status is `EXTRACTED` and `CREATE_DOC` proposal is produced

2. Unsupported file rejection
- Given an unsupported MIME
- When upload runs
- Then flow returns `UNSUPPORTED_FILE_TYPE` and no mutation proposal

3. Oversized file rejection
- Given a 9 MB file
- When upload runs
- Then flow returns `FILE_TOO_LARGE` and suggests split strategy

4. Complete topology planning
- Given intent that maps to existing channel/project
- When planning runs
- Then actions include module and doc-link proposals, no structure creation

5. Missing topology planning
- Given intent requiring absent channel/project
- When planning runs
- Then proposals include `CREATE_CHANNEL`/`CREATE_PROJECT` before module actions

6. Approval boundary enforcement
- Given only proposed actions and no approvals
- When planning flow finishes
- Then no store mutation is executed

7. Explicit apply execution
- Given approved action IDs
- When execution step runs
- Then only approved actions are applied and result reports created IDs

8. Conflict handling
- Given upload context conflicts with existing channel naming/ownership
- When gap detection runs
- Then proposals include alternatives and risk annotations

## Assumptions and Defaults

1. App remains local-first and state remains in React store + localStorage.
2. Planning tools remain contract-first until a dedicated planning runner is wired.
3. Default mode is propose-only with explicit approval for execution.
4. Upload persistence is metadata + extracted text, not raw binary.
5. Existing canvas image upload behavior is unchanged by this spec.
