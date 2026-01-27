# Agentic Command System for GTM Chief of Staff

This plan enables natural language task management through the Review Agent, transforming it into a true "Chief of Staff" that can interpret commands like *"create a task called bingbong about a calendar invite system rotational, goes for 4 weeks starting today"* and automatically populate descriptions, dates, and other fields.

---

## Task Checklist

### Phase 1: Core Command Infrastructure
- [ ] Create `docs/agent-commands.md` - Semantic command reference for the agent
- [ ] Enhance `propose_ticket` tool to include `startDate`, `dueDate`, `assigneeId` parameters
- [ ] Enhance `create_task` tool to include date parameters and AI-generated descriptions
- [ ] Update system instructions to parse natural language dates/durations
- [ ] Update `AgentTicketCard.tsx` to display dates when available

### Phase 2: New Agent Commands
- [ ] Add `query_tasks` tool - View tasks with filters (user, date range, status)
- [ ] Add `move_task_status` tool - Move task between statuses directly
- [ ] Add `update_task` tool - Modify task properties (title, description, dates, priority)
- [ ] Add `delete_task` tool - Delete a task with confirmation
- [ ] Update system instructions with new command capabilities

### Phase 3: Enhanced Natural Language Parsing
- [ ] Improve date extraction (relative: "today", "tomorrow", "next week", absolute: "Jan 27")
- [ ] Improve duration parsing ("4 weeks", "2 days")
- [ ] User name resolution from natural language
- [ ] Multi-user task queries ("show me user1's tasks")

### Verification
- [ ] Test task creation with dates via chat
- [ ] Test task queries via chat
- [ ] Test status changes via chat
- [ ] Test task updates via chat

---

## User Issue

The current `propose_ticket` command created the task "bingbong" but:
1. ❌ No AI-generated description (should be: "Calendar invite system rotational")
2. ❌ No dates visible (should be: Start: 2026-01-27, End: 2026-02-24)

---

## Proposed Changes

### Component 1: Agent Tool Definitions

#### [MODIFY] [reviewAgent.ts](file:///c:/Users/fredm/cursor-but-gtm-1/services/reviewAgent.ts)

**Enhance existing tools with date and assignment parameters:**

```diff
 const PROPOSE_TICKET_TOOL = {
   name: "propose_ticket",
   description: "Propose creating a new execution ticket.",
   parameters: {
     type: Type.OBJECT,
     properties: {
       title: { type: Type.STRING },
       channelId: { type: Type.STRING },
       projectId: { type: Type.STRING },
       description: { type: Type.STRING },
-      priority: { type: Type.STRING, enum: ["Urgent", "High", "Medium", "Low"] }
+      priority: { type: Type.STRING, enum: ["Urgent", "High", "Medium", "Low"] },
+      startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD) for task start." },
+      dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD) for task due date." },
+      assigneeId: { type: Type.STRING, description: "User ID to assign the task to." }
     },
     required: ["title"]
   }
 };
```

**Add new tools for complete task management:**

- **`query_tasks`**: Filter tasks by user, date range, status
- **`update_task`**: Modify task properties (title, description, dates, priority, assignee)
- **`delete_task`**: Remove a task with confirmation

**Update system instructions to:**
1. Parse relative dates ("today", "tomorrow", "next week", "in 4 weeks")
2. Extract durations and calculate end dates
3. Generate AI descriptions from user context
4. Resolve user names to IDs

---

### Component 2: Agent Ticket Card UI

#### [MODIFY] [AgentTicketCard.tsx](file:///c:/Users/fredm/cursor-but-gtm-1/components/AgentTicketCard.tsx)

Add date inputs to the proposed ticket card:

```diff
 interface AgentTicketCardProps {
   actionId: string;
   args: {
     title: string;
     description?: string;
     priority?: string;
     channelId?: string;
     projectId?: string;
     assigneeId?: string;
+    startDate?: string;
+    dueDate?: string;
   };
   ...
 }
```

Add date display/edit controls below the priority selector.

---

### Component 3: Action Handler

#### [MODIFY] [ReviewMode.tsx](file:///c:/Users/fredm/cursor-but-gtm-1/components/ReviewMode.tsx)

Update action handler to pass dates when creating tickets:

```diff
 else if (name === 'propose_ticket' || name === 'create_task') {
-  const { title, description, channelId, projectId, priority } = args;
+  const { title, description, channelId, projectId, priority, startDate, dueDate, assigneeId } = args;
   const newTicket = {
     id: generateId(),
     shortId: `T-${Math.floor(Math.random() * 1000)}`,
     title,
     description: description || '',
     priority: priority || 'Medium',
     status: TicketStatus.Todo,
-    assigneeId: currentUser.id,
-    createdAt: new Date().toISOString()
+    assigneeId: assigneeId || currentUser.id,
+    createdAt: new Date().toISOString(),
+    startDate: startDate || undefined,
+    dueDate: dueDate || undefined
   };
```

---

### Component 4: Agent Command Reference Document

#### [NEW] [agent-commands.md](file:///c:/Users/fredm/cursor-but-gtm-1/docs/agent-commands.md)

Create a semantic command reference that documents all supported natural language patterns:

```markdown
# GTM Chief of Staff - Command Reference

## Task Creation
- "create a task called X about Y"
- "add task X starting today for 4 weeks"
- "new task: X - assign to Growth Lead"

## Task Queries
- "show me my tasks for today"
- "what's on my plate this week?"
- "show me user1's tasks for today"

## Task Updates
- "move task X to In Progress"
- "change the due date of task X to next Friday"
- "update the description of task X to Y"
- "rename task X to Y"

## Task Deletion
- "delete task X"
- "remove task X from the board"
```

---

## Verification Plan

### Manual Testing (Browser)

Since this is a chat-based feature, verification requires using the live application:

1. **Start the dev server**: `npm-run-0dev`
2. **Navigate to Review Mode** via the sidebar
3. **Test each command pattern**:

| Test | Command | Expected Result |
|------|---------|-----------------|
| Create with dates | "create a task called Demo about testing, starts today for 2 weeks" | Ticket card shows title, description, and dates (Jan 27 - Feb 10) |
| Create with assignee | "create task X and assign to Growth Lead" | Ticket card shows assignee dropdown set to Growth Lead |
| Query tasks | "show me my tasks for this week" | Tasks filtered and displayed as cards |
| Update status | "move Demo to In Progress" | Status change card appears |
| Update dates | "change Demo's due date to Feb 1" | Reschedule action appears |

---

## Implementation Order

1. **Start with `reviewAgent.ts`** - Add date parameters to tools and update system instructions
2. **Update `AgentTicketCard.tsx`** - Add date inputs to the UI
3. **Update `ReviewMode.tsx`** - Pass dates through when creating tickets
4. **Create `agent-commands.md`** - Document all supported commands
5. **Test each command pattern** via live browser testing
