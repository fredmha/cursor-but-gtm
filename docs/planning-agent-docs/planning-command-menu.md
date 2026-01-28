# Slash Command Menu (Notion-Style)

## Goal
When the user types `/` in the chat input, show a contextual command menu with all planning commands and commonly used actions.

## Commands (Phase 1)
- `/start daily plan`
- `/start weekly plan`
- `/start quarterly plan`
- `/set sprint plan`
- `/plan` (bulk transcript ? tasks)
- `/task` (quick task proposal)
- `/help`

## UI Behavior
- Opens on `input.startsWith('/')` or when `/` follows whitespace.
- Filter list as the user types.
- Arrow keys navigate; Enter selects.
- Escape closes.
- Selecting a command auto-fills the input and optionally triggers execution.

## Placement
- Use the same dropdown placement as @ mention picker in `components/ReviewMode.tsx`.
- If both `/` and `@` are active, prefer the most recent trigger (cursor proximity).

## Data Source
- Command list should be a static array in `ReviewMode.tsx` or a small `constants.tsx` entry.

## Notes
- Keep the menu light; only show the 6-8 highest value commands.
- Future: support categories (Planning, Tasks, Docs) and keyboard hints.

