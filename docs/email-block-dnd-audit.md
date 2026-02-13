# Email Block DnD Bug Audit

## Baseline issues identified

1. Drag/drop relied on native HTML5 events and midpoint math, which was sensitive to nested inputs/textarea focus and produced inconsistent target resolution.
2. Block order was implicit (array index only) with no persisted `order`, so legacy/invalid payloads could drift after normalization.
3. `H3` was unsupported in `EmailBlockType` and block defaults, preventing complete heading-layer workflows.
4. Block row/input sizing allowed overflow edge cases in narrow card widths because rows were missing explicit `min-w-0`/`box-border` constraints.

## Refactor actions shipped

1. Replaced native block DnD path with `dnd-kit` sortable behavior in `CanvasElementNode`.
2. Added explicit `order` to `CanvasEmailBlock`, with deterministic normalization and contiguous reindexing.
3. Added first-class `H3` support across types/constants/default metrics/creation flow.
4. Hardened layout classes for text/image/edit controls to improve responsive behavior inside constrained card widths.

## Validation matrix

1. Drag block down across multiple rows: target order updates correctly.
2. Drag block up to first position: index becomes `0` and reindex is contiguous.
3. Drag while focused in active text field: reorder still resolves and input remains editable after drop.
4. Save/reload scene with existing blocks: normalized ordering remains stable via `order`.
5. Legacy blocks without `order`: migration fallback assigns deterministic `0..n-1`.
6. Heading coverage: `H1`, `H2`, and `H3` all render/edit/reorder in the same flow.
