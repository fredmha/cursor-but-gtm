# ARCHITECTURE.md
# Last updated: [DATE]
# Owner: Fred Harris

## What this project is

A canvas-based GTM coordination app. Teams design artefacts (emails, ads, flows)
on a visual canvas, then link them to structured tickets/deliverables in a database.
The canvas is for creating. The database is for tracking. The link between them is
the core product.

## What should exist (and nothing else)

- Canvas — the visual workspace where artefacts are created
- Execution tab — the structured database of tickets/deliverables
- The bridge between them — linking artefacts to tickets



## Project structure

[AGENT: Fill this in by running `tree -I 'node_modules|.git|.next|dist' --dirsfirst`
and annotating each folder/file with a one-line description of what it does.]

## Core modules

[AGENT: For each major folder/module, document:]
- What it does (one sentence)
- Key files and what each one is responsible for
- Public API — what other modules import from it
- Internal only — what stays private to this module

## Key functions registry

[AGENT: List the most important functions in the codebase. For each:]
- Function name
- File path
- What it does (one sentence)
- What calls it
- What it calls

This is the map I use to understand diffs. Keep it updated.

## Dependency rules

[AGENT: Document which modules are allowed to import from which.
Flag any current violations.]

## Tech stack

[AGENT: List every major dependency from package.json with:]
- What it is
- Why it's used
- Whether it's essential or could be removed

## Known issues and debt

[AGENT: Be honest. List:]
- Files that are too big and need splitting
- Dead code or unused features
- Duplicate logic
- Things in the wrong place
- Missing tests
- Anything that's going to bite us later

## Code style rules

These are non-negotiable. Every contributor (human or AI) follows them.

1. Everything lives in named functions. No anonymous inline logic. All variables are clearly named
2. Every function gets a JSDoc comment: what it does, why it exists, tradeoffs.
3. Functions longer than 30 lines get split.
4. Comments explain decisions and tradeoffs, not what the code does.
5. When reading a diff, you should see exactly which functions were impacted.
6. No `any` types. TypeScript strict mode.
7. One concern per file. If a file does two unrelated things, split it.

