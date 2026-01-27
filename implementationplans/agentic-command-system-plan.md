# Agentic Command System & Transcript Workflow Architecture

This document provides the detailed technical architecture for the "Command & Synthesis" phase. It connects the high-level intent (Slash Commands, Meeting Transcripts) to specific code paths, data models, and UI states.

---

## 🏗️ System Architecture

### High-Level Data Flow
```mermaid
graph TD
    User([User Input]) --> Router{Input Router}
    
    Router -- "/command" --> CommandEngine[Command Engine]
    Router -- "Transcript/Long Text" --> SynthesisEngine[Synthesis Engine]
    Router -- "Conversation" --> LLM[Gemini Agent]
    
    subgraph ReviewMode.tsx
        CommandEngine -->|Exec| LocalState[UI State Updates]
        SynthesisEngine -->|Parse| BulkDraft[Draft Ticket Batch]
    end
    
    subgraph Services
        LLM -->|Tool Call| ToolHandler[Tool Executor]
        ToolHandler -->|Emit| Actions[Pending Actions]
    end
    
    LocalState --> UI[Render Interface]
    BulkDraft --> BulkUI[BulkTaskCallout.tsx]
    Actions --> Cards[AgentTicketCard.tsx]
    
    BulkUI -->|Approve| Store[Global Store (Zustand)]
    Cards -->|Approve| Store
```

---

## 🏛️ Slash Command Engine

The `ReviewMode` component will intercept inputs starting with `/` before sending them to the LLM. This ensures deterministic, fast UI feedback.

### 1. Command Router Logic
**Location**: `components/ReviewMode.tsx` -> `handleSend()`

| Command | Arguments | Behavior | State Effect |
| :--- | :--- | :--- | :--- |
| `/task` | `[title] [priority]` | Opens creation card directly. | `setPendingActions([...propose_ticket])` |
| `/query` | `[@mention] [status]` | Filters visible tasks. | `handleQueryTasksCalls` (bypasses LLM roundtrip if possible) |
| `/edit` | `[@reference]` | Enters inline edit mode. | `setInlineEditDraft(reference)` |
| `/plan` | `[context/notes]` | Triggers Synthesis Mode. | `setProcessingTranscript(true)` -> LLM |
| `/help` | - | Shows cheat sheet. | `setMessages([...sys_msg])` |

### 2. Implementation Detail
```typescript
// Pseudo-code in ReviewMode
const handleSend = async () => {
  if (input.startsWith('/')) {
    const [cmd, ...args] = input.split(' ');
    switch(cmd) {
      case '/task': 
        // Create local optimistic pending action
        const mockCallId = generateId();
        setPendingActions(prev => [...prev, {
           id: generateId(),
           callId: mockCallId,
           name: 'propose_ticket',
           args: { title: args.join(' ') },
           status: 'PENDING'
        }]);
        return;
      // ... handle others
    }
  }
  // Fallback to LLM
}
```

---

## 🎙️ Transcript-to-Task Synthesis (Path D)

This is a specialized "High Bandwidth" mode. Instead of chatting, the machine extracts structured data from unstructured text.

### 1. Detection Heuristics
- **Explicit**: User types `/plan [paste]` or "Take these notes: [paste]".
- **Implicit**: Input length > 300 characters AND contains bullet points or timestamps.

### 2. The `propose_bulk_tasks` Tool
**Location**: `services/reviewAgent.ts`

```typescript
const PROPOSE_BULK_TASKS_TOOL = {
  name: "propose_bulk_tasks",
  description: "Generate multiple tickets at once from a meeting or plan.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: { type: Type.STRING, description: "Meeting content source or title" },
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            assigneeId: { type: Type.STRING }, // Agent tries to map user name -> ID
            priority: { type: Type.STRING, enum: ["Urgent", "High", "Medium", "Low"] }
          }
        }
      }
    }
  }
};
```

### 3. Component: `BulkTaskCallout.tsx`
A dedicated UI for reviewing 5-20 tasks at once.

**Visual Design**:
- **Compact List**: Rows instead of cards to save space.
- **Inline Specifics**: "Click to edit" fields for title and assignee.
- **Batch Controls**: "Select All", "Approve Selected" (Primary Action).

**Props Interface**:
```typescript
interface BulkTaskCalloutProps {
  origin: string;
  initialTasks: ProposedTicket[]; // Transformed from tool args
  users: User[]; // For assignee dropdown
  onApprove: (tasks: Ticket[]) => void;
  onDiscard: () => void;
}
```

**State Management**:
- `draftTasks`: Local copy of the proposals. Edits happen here.
- `selectedIds`: Set of IDs marked for approval (default all).

---

## 🧩 UX Paths & Interaction Design

### Path A: The Direct Creation (Single)
- **Trigger**: `/task Write docs`
- **Component**: `AgentTicketCard` (Existing, but refined).
- **Behavior**:
  - Shows "Proposed by Agent" badge.
  - User adjusts: Priority (default Medium), Due Date (default Today).
  - Action: "Create Ticket" (Single DB write).

### Path B: The Inline Modifier
- **Trigger**: `/edit @T-42`
- **Component**: `ReviewMode` -> `inlineEditDraft` state -> Render `InlineEditForm`.
- **Behavior**:
  - Fetches current ticket data to populate form.
  - Renders directly below the user's message.
  - Action: "Save Changes" (Single DB update).

### Path C: The Kanban Discovery
- **Trigger**: `/query @Alex`
- **Component**: `ChatKanbanCallout` (Existing).
- **Behavior**:
  - Horizontal scroll container.
  - Interactive "Status" pills on cards (Immediate DB update, no modal).

### Path D: The Bulk Synthesis
- **Trigger**: Paste transcript.
- **Component**: `BulkTaskCallout` (New).
- **Behavior**:
  - **Parsing State**: Show skeleton loader or "Reading notes..."
  - **Review State**: List of 10 items.
  - **Edit State**: User changes assignee for Item #3.
  - **Commit State**: Loop through `draftTasks` -> `addTicket` store action.

---

## 📂 Implementation Roadmap

### Phase 4.1: Foundation
- [ ] Define `propose_bulk_tasks` scheme in `reviewAgent.ts`.
- [ ] Update `ReviewMode.tsx` to handle the specific tool call response from `propose_bulk_tasks`.

### Phase 4.2: UI Components
- [ ] Create `components/BulkTaskCallout.tsx`.
  - [ ] Implement row-based layout.
  - [ ] Implement local edit state (Title, Assignee).
- [ ] Implement command parser in `ReviewMode.tsx`.

### Phase 4.3: Integration & Polish
- [ ] connect `onApprove` in Bulk component to `store.addTicket`.
- [ ] Add "Teaching" hints (e.g. "Tip: You can use `/plan` to do this next time").
- [ ] Styling cleanup: Ensure `BulkTaskCallout` looks distinct from `ChatKanbanCallout`.

## ✅ Quality Checklist
- **Idempotency**: Does clicking "Approve" twice create duplicate tickets? (Should allow only once).
- **Error Handling**: What if `assigneeId` from AI is invalid? (Fallback to Unassigned).
- **Mobile**: Does the Bulk row layout collapse gracefully on small screens?
