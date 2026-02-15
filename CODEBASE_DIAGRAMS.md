# GTM OS - Flowchart Diagram Pack

This is a diagram-first map of the codebase using flowcharts, sequence diagrams, and state diagrams.

## Rendered Visual Assets (PNG)

- `C:\Users\fredm\.cursor\projects\c-Users-fredm-cursor-but-gtm-2\assets\gtm-system-architecture.png`
- `C:\Users\fredm\.cursor\projects\c-Users-fredm-cursor-but-gtm-2\assets\gtm-runtime-sequence.png`
- `C:\Users\fredm\.cursor\projects\c-Users-fredm-cursor-but-gtm-2\assets\gtm-bridge-sync-flow.png`

Component-level index: `diagrams/README.md`

## 1) System Flow (Top Level)

```mermaid
flowchart TB
    index["index.tsx"] --> app["App.tsx"]
    app --> storeProvider["StoreProvider (store.tsx)"]
    storeProvider --> layout["MainLayout"]

    layout --> campaignCheck{"campaign exists?"}
    campaignCheck -->|No| blank["Blank Slate: Initialize Workspace"]
    campaignCheck -->|Yes| viewSwitch{"currentView"}

    viewSwitch -->|EXECUTION| execution["ExecutionBoard.tsx"]
    viewSwitch -->|CANVAS| canvas["CanvasView.tsx"]
```

## 2) Module Dependency Flow

```mermaid
flowchart LR
    subgraph AppLayer
      A["App.tsx"]
      B["constants.tsx"]
      C["types.ts"]
    end

    subgraph StateLayer
      D["store.tsx"]
    end

    subgraph ExecutionLayer
      E["ExecutionBoard.tsx"]
      F["execution/useExecutionController.ts"]
      G["execution/execution-columns.tsx"]
      H["execution/useExecutionCellEditor.ts"]
      I["execution/execution-core.ts"]
      J["execution/executionStatus.ts"]
      K["execution/ExecutionComponentsModal.tsx"]
    end

    subgraph CanvasLayer
      L["CanvasView.tsx"]
      M["canvas/useCanvasController.tsx"]
      N["canvas/canvas-core.ts"]
      O["canvas/CanvasElementNode.tsx"]
      P["canvas/CanvasInspectorPanel.tsx"]
      Q["canvas/CanvasToolbar.tsx"]
      R["canvas/CanvasTicketLinkModal.tsx"]
    end

    A --> D
    A --> E
    A --> L
    A --> B
    D --> C

    E --> F
    F --> G
    F --> H
    G --> I
    G --> J
    F --> K
    F --> D

    L --> M
    M --> N
    M --> O
    M --> P
    M --> Q
    M --> R
    M --> D
```

## 3) Execution Runtime Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant EB as ExecutionBoard
    participant EC as useExecutionController
    participant CE as useExecutionCellEditor
    participant ST as store.tsx

    U->>EB: Open Execution view
    EB->>EC: Initialize controller
    EC->>ST: getExecutionRows()
    ST-->>EC: ticket rows
    EC-->>EB: rows + columns

    U->>EB: Edit cell / add row / link components
    EB->>EC: row action
    EC->>CE: startEditing/commitDraft (cell edits)
    CE->>ST: updateExecutionRow(ticketId, updates)
    ST-->>CE: updated campaign state
    CE-->>EC: editing state cleared
    EC-->>EB: rerender table
```

## 4) Canvas Runtime Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant CV as CanvasView
    participant CC as useCanvasController
    participant CORE as canvas-core.ts
    participant ST as store.tsx

    U->>CV: Open Canvas view
    CV->>CC: Initialize controller
    CC->>CORE: mapSceneToState(campaign.canvasScene)
    CORE-->>CC: nodes + edges + ticketLinks + viewport
    CC-->>CV: ReactFlow props

    U->>CV: Drag/resize/connect/edit block
    CV->>CC: onNodesChange/onEdgesChange/etc.
    CC->>CC: scheduleCommit()
    CC->>CORE: buildScene(nodes, edges, links, viewport)
    CORE-->>CC: CanvasScene v2
    CC->>ST: updateCanvasScene(scene)
    ST-->>CC: campaign updated
```

## 5) Bridge Sync Flow (Canvas Links <-> Ticket Links)

```mermaid
flowchart TB
    subgraph Canvas
      A["CanvasTicketLinkModal save"]
      B["useCanvasController.saveTicketLinks"]
    end

    subgraph Execution
      C["ExecutionComponentsModal save"]
      D["useExecutionController.saveComponentsLinks"]
    end

    subgraph StoreBridge["store.tsx"]
      E["updateCanvasScene(scene)"]
      F["updateExecutionRow(ticketId,{canvasItemIds})"]
      G["relations: TICKET_LINK[]"]
      H["ticket.canvasItemIds[]"]
    end

    A --> B --> E
    E --> G
    E --> H

    C --> D --> F
    F --> H
    F --> G
```

## 6) Canvas Element Render Flow

```mermaid
flowchart TB
    node["CanvasElementNode"] --> kindCheck{"element.kind"}
    kindCheck -->|CONTAINER| containerView["Container card render"]
    kindCheck -->|EMAIL_CARD| emailPath["emailTemplate.blocks"]

    emailPath --> hasBlocks{"blocks.length > 0"}
    hasBlocks -->|No| fallback["Static text fallback"]
    hasBlocks -->|Yes| dnd["DndContext + SortableContext"]
    dnd --> rowMap["map(block => SortableEmailRow)"]
    rowMap --> rowType{"block.type"}
    rowType -->|IMAGE| imageRow["image/url placeholder render"]
    rowType -->|BODY| bodyRow["textarea or read-only text"]
    rowType -->|H1/H2/H3| headingRow["input or read-only heading"]
```

## 7) Email Block Lifecycle Flow

```mermaid
flowchart LR
    add["addEmailBlock(type)"] --> updateTemplate["updateSelectedEmailTemplate(...)"]
    updateTemplate --> ensure["ensureEmailTemplate()"]
    updateTemplate --> normalize["normalizeEmailBlockOrder()"]
    updateTemplate --> label["deriveEmailCardLabel()"]
    updateTemplate --> commit["scheduleCommit()"]

    edit["updateEmailBlock(blockId, updater)"] --> updateTemplate
    delete["deleteEmailBlock(blockId)"] --> updateTemplate
    reorder["onEmailBlockReorder(...)"] --> move["moveBlockById()"] --> updateTemplate
```

## 8) Store Domain Function Flow

```mermaid
flowchart TB
    subgraph Provider
      SP["StoreProvider"]
      US["useStore"]
    end

    subgraph ExecutionFns
      GER["getExecutionRows"]
      AER["addExecutionRow"]
      UER["updateExecutionRow"]
      DER["deleteExecutionRow"]
    end

    subgraph CanvasFns
      UCS["updateCanvasScene"]
      GCT["getCanvasTicketLinks"]
      GET["getCanvasElementsLinkedToTicket"]
      GCC["getCanvasChildren"]
    end

    subgraph EntityFns
      CH["Channel ops"]
      PR["Project ops"]
      TK["Ticket ops"]
      USR["User ops"]
    end

    SP --> GER
    SP --> AER
    SP --> UER
    SP --> DER
    SP --> UCS
    SP --> GCT
    SP --> GET
    SP --> GCC
    SP --> CH
    SP --> PR
    SP --> TK
    SP --> USR
    US --> SP
```

## 9) App View State Diagram

```mermaid
stateDiagram-v2
    [*] --> NoCampaign
    NoCampaign --> Workspace: Initialize Workspace

    Workspace --> ExecutionView: setCurrentView(EXECUTION)
    Workspace --> CanvasView: setCurrentView(CANVAS)

    ExecutionView --> CanvasView: switch view
    CanvasView --> ExecutionView: switch view
```

## 10) Function Call Graph (Controller-Level)

```mermaid
flowchart TB
    subgraph ExecutionController["useExecutionController.ts"]
      EC["useExecutionController"]
      E1["handleAddRow"]
      E2["openComponentsEditor"]
      E3["closeComponentsEditor"]
      E4["saveComponentsLinks"]
    end

    subgraph CanvasController["useCanvasController.tsx"]
      CC["useCanvasController"]
      C1["createElementFromTool"]
      C2["updateSelectedElement"]
      C3["updateSelectedEmailTemplate"]
      C4["onNodesChange/onEdgesChange/onConnect"]
      C5["saveTicketLinks"]
      C6["undo/redo"]
      C7["resetViewport"]
    end

    subgraph Store["store.tsx"]
      S1["addExecutionRow"]
      S2["updateExecutionRow"]
      S3["updateCanvasScene"]
    end

    EC --> E1 --> S1
    EC --> E4 --> S2
    EC --> E2
    EC --> E3

    CC --> C1
    CC --> C2
    CC --> C3
    CC --> C4 --> S3
    CC --> C5 --> S3
    CC --> C6
    CC --> C7
```

## 11) Optional Full Function Index (Reference Table)

- The full named function list is available from source inspection and can be exported into CSV/JSON if you want this as a machine-readable artifact.
