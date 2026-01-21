# Implementation Plan: Doc Templates

## 1. Templates Definition (`templates.ts`)
Create a new file containing rich HTML strings for:
- **Ideal Customer Profile (ICP)**: Includes tables for demographics and sections for pains/gains.
- **Cold Email Sequence**: Structured 3-part email flow with placeholders.

## 2. DocsView Enhancements (`components/DocsView.tsx`)
- **Add Template Trigger**: Introduce a generic "Templates" icon button in the sidebar header.
- **Dropdown Menu**: Create a simple state-driven dropdown to select a template.
- **Instantiation Logic**: When a template is selected, create a new `ContextDoc` with the template's HTML content pre-filled.

## 3. Editor Compatibility
Ensure `RichTextEditor` handles the injected HTML (tables, lists) correctly immediately upon load (already handled by previous rich text upgrade).
