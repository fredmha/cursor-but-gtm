# Agentic Command System for GTM Chief of Staff

This plan enables natural language task management through the Review Agent, transforming it into a true "Chief of Staff" that can interpret commands like *"create a task called bingbong about a calendar invite system rotational, goes for 4 weeks starting today"* and automatically populate descriptions, dates, and other fields.

---

## 📋 Task Checklist

### Phase 1: Core Command Infrastructure
- [X] Enhance `propose_ticket` tool to include `startDate`, `dueDate`, `assigneeId` parameters
- [X] Enhance `create_task` tool to include date parameters and AI-generated descriptions
- [X] Update system instructions to parse natural language dates/durations
- [X] Update `AgentTicketCard.tsx` to display dates when available
- [ ] Create `docs/agent-commands.md` - Semantic command reference for the agent

### Phase 2: New Agent Commands
- [X] Add `query_tasks` tool - View tasks with filters (user, date range, status)
- [X] Add `move_task_status` tool - Move task between statuses directly
- [X] Add `update_task` tool - Modify task properties (title, description, dates, priority)
- [ ] Add `delete_task` tool - Delete a task with confirmation
- [X] Update system instructions with new command capabilities

### Phase 3: Enhanced Natural Language Parsing
- [ ] Improve date extraction (relative: "today", "tomorrow", "next week", absolute: "Jan 27")
- [ ] Improve duration parsing ("4 weeks", "2 days")
- [X] User name resolution from natural language
- [ ] Multi-user task queries ("show me user1's tasks")

---

## 🛠️ Technical Details

### Agent Tool Enhancements
We are moving from basic task creation to full lifecycle management. The agent can now:
- **Query**: Filters tasks by assignee, status, or date range.
- **Update**: Modifies specific fields on existing tickets.
- **Move**: Transitions tickets through the Kanban board.

### UI Improvements
- **AgentTicketCard**: Now supports `startDate` and `dueDate` inputs.
- **ReviewMode**: Logic added to handle multi-step tool calls (e.g., query then show) and deduplicate repeated AI proposals.

---

## ✅ Verification Plan

### Test Scenarios
1. **Creation**: "Create task 'Audit' starting today for 3 days" -> Should show card with Jan 27 to Jan 30.
2. **Assignment**: "Assign 'Audit' to Growth Lead" -> Should update card with correct assignee ID.
3. **Query**: "Show me my tasks for tomorrow" -> Should filter and display relevant cards.
4. **Update**: "Move 'Audit' to In Progress" -> Should show status transition card.

---

## 🚀 Nex Steps
1. Finalize the `delete_task` handler in `ReviewMode.tsx`.
2. Document the supported command patterns in `docs/agent-commands.md`.
3. Enhance the natural language parsing for more complex multi-user queries.
