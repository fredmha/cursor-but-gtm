# AGENTS.md

## Before you do anything
1. Read ARCHITECTURE.md for codebase context.
2. Read the relevant spec in /specs if one exists for this task.
3. If neither exists, ask before proceeding.

## Boundaries
- Only the canvas, execution tab, and bridge between them are in scope.
- Do not create new top-level folders without asking.
- Do not modify files outside the module you're working in.
- If a task touches more than one module, flag it and get approval.

## Planning (mandatory before code)
- Every task starts with a plan. No code until the plan is approved.
- Plans must include: files affected, functions impacted, approach in
  plain English, tradeoffs, and second-order effects.

## Code style
- Everything lives in named functions. No anonymous inline logic.
- Every function gets a JSDoc comment: what it does, why it exists, tradeoffs.
- Functions longer than 30 lines get split.
- Comments explain decisions and tradeoffs, not what the code does.
- No `any` types. TypeScript strict mode.
- One concern per file.
- All variables are clearly named.

## After implementation
- Run typecheck and tests after every change.
- Use conventional commits: feat:, fix:, refactor:
- Flag anything broken before moving to the next task.