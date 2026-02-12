# AI Companion Design

## Purpose

AI in GTM OS is designed to accelerate planning and execution quality, not replace operator judgment.

## Current AI jobs

1. Task agent in Review
- Helps users list, create, update, and delete tasks conversationally.

2. Strategy onboarding support
- Helps generate initial campaign structure from business context.

3. Channel planning support
- Helps turn channel strategy into concrete execution tasks.

4. Weekly action idea generation
- Proposes next actions from strategic intent and recent slippage.

## Product principles for AI behavior

1. Actionable output over generic advice
- Responses should end in concrete next steps.

2. Context-aware assistance
- AI should use current campaign context, not generic templates only.

3. Human control boundary
- AI should support decisions; users remain decision owner.

4. Continuous alignment
- AI recommendations should stay tied to objective, channels, and projects.

## Current design tension

The product direction favors "propose first, approve before commit" for AI actions.
Some current flows execute directly.
This is a key product decision area for trust and control.

## Iteration opportunities

1. Approval UX
- Standardize proposal and approval patterns across AI flows.

2. Explainability
- Require AI to state rationale for major suggested actions.

3. Session memory quality
- Improve continuity between planning, execution, and review sessions.
