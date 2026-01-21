# Implementation Plan: Docs Upgrade (Folders & Rich Text)

## 1. Objective
Transform the `DocsView` from a flat, category-based markdown viewer into a hierarchical Knowledge Base with dynamic folders and a visual Rich Text Editor (WYSIWYG).

## 2. Data Architecture Changes (`types.ts`)

### A. New Interface: `DocFolder`
We need to store folder metadata.
```typescript
export interface DocFolder {
  id: string;
  name: string;
  createdAt: string;
}
```

### B. Update `ContextDoc`
Remove the hardcoded `DocType` dependency for organization and rely on `folderId`.
```typescript
export interface ContextDoc {
  // Existing fields
  id: string;
  title: string;
  content: string; // Will now store HTML string instead of Markdown
  lastUpdated: string;
  isAiGenerated: boolean;
  
  // New/Updated fields
  folderId?: string; // If null, lives in root "Unsorted"
  // type: DocType; // Keep for legacy compatibility/metadata, but UI will rely on folders
}
```

### C. Update `Campaign`
Add the folders collection.
```typescript
export interface Campaign {
  // ... existing fields
  docFolders: DocFolder[];
}
```

## 3. Store Logic (`store.tsx`)

### A. State Initialization
*   Initialize `docFolders` in the campaign state.
*   Migration: If existing docs use `type`, we can auto-create folders for "Strategy", "Persona", etc., on first load, or just start fresh.

### B. New Actions
*   `addFolder(name: string)`
*   `deleteFolder(folderId: string)`: Should probably move docs to root or delete them. Let's move them to root to be safe.
*   `renameFolder(folderId: string, name: string)`
*   `moveDoc(docId: string, folderId: string | undefined)`

## 4. UI Component Refactor

### A. Sidebar (`DocsSidebar`)
*   **Remove**: Fixed `DOC_TYPES` mapping.
*   **Add**: Dynamic Folder List.
    *   "Folders" section with `+` button.
    *   Expandable/Collapsible is implied, but flat list of folders is easier for MVP.
    *   Dragging docs between folders (or a "Move" menu option).
*   **Visuals**: Use the new "Harvey" light aesthetic. Clean list items.

### B. Editor (`RichTextEditor`)
Instead of a raw `textarea`, we will implement a custom `ContentEditable` component to avoid heavy dependencies like Draft.js or Quill which might break in the ESM environment without a bundler.

*   **Toolbar**:
    *   Formatting: Bold, Italic, Underline.
    *   Structure: H1, H2, Bullet List, Numbered List.
    *   Visuals: Floating or Sticky top bar.
*   **Canvas**:
    *   A4-like paper centering (max-width container).
    *   Typography: `prose` styling from Tailwind.

## 5. Execution Steps
1.  **Update `types.ts`**: Add `DocFolder` and update `ContextDoc`.
2.  **Update `store.tsx`**: Add folder actions and update state handling.
3.  **Create `components/RichTextEditor.tsx`**: A reusable WYSIWYG component.
4.  **Refactor `components/DocsView.tsx`**: Implement the new Sidebar and integrate the Editor.
