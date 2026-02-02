# Slash Command Menu (Agentic)

## Goal
When the user types `/` in the chat input, show a contextual command menu with planning commands that trigger agentic workflows (context retrieval + recommendations + confirmation), not just static prompts.

## Commands (Phase 1)
- `/start daily plan`
- `/start weekly plan`
- `/start quarterly plan`
- `/set sprint plan`
- `/plan` (bulk transcript -> tasks)
- `/task` (quick task proposal)
- `/help`

## Aliases (Natural Language)
Accept semantic triggers and map to the same workflow:
- "Let's do daily planning" -> `/start daily plan`
- "Weekly plan" -> `/start weekly plan`
- "Quarterly planning" -> `/start quarterly plan`
- "Set sprint plan" -> `/set sprint plan`

## Agentic Behavior (Required)
When any planning command is invoked:
1) Load relevant context automatically (recent plans, current tasks, active projects).
2) Summarize and propose priorities based on data.
3) Ask only the minimal questions needed to fill gaps.
4) Require explicit confirmation before writing tasks or persisting plans.

## UI Behavior
- Opens on `input.startsWith('/')` or when `/` follows whitespace.
- Filter list as the user types.
- Arrow keys navigate; Enter selects.
- Escape closes.
- Selecting a command auto-fills the input and can trigger execution.

## Placement
- Use the same dropdown placement as @ mention picker in `components/ReviewMode.tsx`.
- If both `/` and `@` are active, prefer the most recent trigger (cursor proximity).

## Data Source
- Command list should be a static array in `ReviewMode.tsx` or a small `constants.tsx` entry.

## Notes
- Keep the menu light; only show the 6-8 highest value commands.
- Future: support categories (Planning, Tasks, Docs) and keyboard hints.

