# Planning Agent Workflow Overview

## Purpose
Deliver an agentic planning workflow for 1-50 person SaaS teams that turns intent into executed plans. The system uses Notion-style slash commands in chat to run structured SOPs, capture context, identify blockers, and produce plans aligned to a user-defined north star objective.

## Primary Commands
- `/start daily plan`
- `/start weekly plan`
- `/start quarterly plan`
- `/set sprint plan` (context binding for a launch or sprint, e.g., 4-week launch prep)

## Core Outcomes
- A clear plan with goals, tasks, owners, and dates.
- Confirmed blockers and dependencies.
- A bounded backlog aligned to goals (no orphan tasks).
- Stored context for retrieval and continuity.

## Non-Goals
- Automatic task updates without explicit user confirmation.
- Replacing existing PM tools. This complements and syncs with them.

## Key Principles
- Context before planning: the agent must confirm status and resolve blockers.
- Alignment: tasks must ladder up to goals and the north star objective.
- Persistence: each session writes a durable record to the Planning folder in Docs.
- Agentic assistance: research, synthesis, and consistency checks are delegated to subagents.

## Planning Readiness Gate (Shared)
The agent should only propose a plan after:
1) The user has confirmed current state (completed, in progress, blocked).
2) Major blockers and dependencies are surfaced.
3) The backlog is reconciled (remove or re-scope tasks that do not support goals).
4) The time horizon and capacity assumptions are explicit.

## Context Sources (Priority Order)
1) User-provided goals and north star objective.
2) Previous plans and recent session summaries.
3) Active tasks, projects, and team members.
4) Uploaded files and external references.
5) Web research (only when needed and approved by user settings).

## Artifacts Produced Per Session
- Plan summary (human readable)
- Structured plan data (JSON)
- Conversation transcript (for traceability)
- Blockers and risks log

## High-Level Flow
1) Command invoked -> run SOP.
2) Gather context + confirm current state.
3) Identify gaps, blockers, and dependencies.
4) Draft plan -> review with user -> finalize.
5) Persist to planning file system.

