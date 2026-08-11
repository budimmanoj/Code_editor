You are working on my existing CodeRoom project, a real-time collaborative code workspace.

IMPORTANT:
Do NOT rebuild the project or replace existing functionality.
Do NOT create a separate file-management system for the AI.
Use the existing CodeRoom workspace, file/folder APIs, database, WebSocket architecture, editor state, authentication, and version-history system.

GOAL:
Transform the current AI Assistant from an independent chatbot into a workspace-aware coding assistant that can understand the CodeRoom project and safely read/create/update files.

CURRENT PROBLEM:
The AI Assistant currently works independently from the code editor.

For example:

User has:
    code.js

with actual code inside the editor.

User asks:
    "What code is present in code.js?"

The AI currently responds:
    "I don't have direct access to your local workspace or file system."

This behavior must be eliminated.

The AI should understand the CodeRoom workspace through controlled application context and APIs.

==================================================
1. FIRST: STUDY THE EXISTING CODEBASE
==================================================

Before changing anything, inspect the entire relevant architecture.

Identify:

FRONTEND:
- EditorPage
- AiPanel
- CodeMirror/editor component
- workspace/file explorer
- active file state
- file loading logic
- file creation/update/delete APIs
- WebSocket logic
- authentication
- current AI API client

BACKEND:
- AI controller
- AI service / ModelService
- file controllers/services
- folder/project/room services
- repositories
- entities
- WebSocket handlers
- authentication/JWT
- version history
- database schema

Understand how the currently opened file is represented and where its latest content comes from.

DO NOT assume the architecture.
Inspect the actual code and reuse the existing implementation.

==================================================
2. DESIGN A WORKSPACE-AWARE AI CONTEXT
==================================================

The AI request should contain enough context for the model to understand what the user is currently working on.

At minimum support:

- room/project ID
- active file ID
- active file name
- active file path
- programming language
- current file content
- current cursor/selection if useful
- workspace tree

Example:

{
  "message": "What code is present in code.js?",
  "roomId": "...",
  "activeFile": {
      "id": "...",
      "name": "code.js",
      "path": "/src/code.js",
      "language": "javascript",
      "content": "..."
  },
  "workspace": {
      "tree": [...]
  }
}

Do NOT blindly send the entire workspace on every request.

Design the context efficiently.

==================================================
3. CONTEXT STRATEGY
==================================================

Implement context levels.

LEVEL 1 — CURRENT FILE

For questions about the currently open file, send only:

- current file metadata
- current file content
- relevant selection/cursor

Example:

"What does this function do?"

→ send the relevant current file context.

LEVEL 2 — SELECTED FILES

Allow the user to explicitly reference files.

Example:

"Compare code.js and utils.js."

Only send those files.

LEVEL 3 — FOLDER

Allow AI to inspect files inside a selected folder.

Example:

"Find bugs in the authentication folder."

Retrieve only relevant files from that folder.

LEVEL 4 — WORKSPACE

For questions requiring project-wide understanding:

"Why is authentication failing?"

Allow the AI to inspect the workspace structure and retrieve relevant files.

Do NOT send huge workspaces blindly.

Use a context budget/token limit and retrieve only relevant files.

==================================================
4. AI TOOL / ACTION ARCHITECTURE
==================================================

The AI should not directly manipulate the database.

Create a controlled application-level tool/action system.

Support actions such as:

READ_FILE
LIST_FILES
READ_FOLDER
CREATE_FILE
UPDATE_FILE
DELETE_FILE
RENAME_FILE
CREATE_FOLDER

The AI should request actions through structured JSON.

Example:

{
  "action": "READ_FILE",
  "fileId": "123"
}

For creation:

{
  "action": "CREATE_FILE",
  "parentFolderId": "456",
  "fileName": "sum.cpp",
  "language": "cpp",
  "content": "..."
}

For updating:

{
  "action": "UPDATE_FILE",
  "fileId": "123",
  "content": "..."
}

The backend must validate every action.

The AI must NEVER receive unrestricted database access.

==================================================
5. FILE CREATION
==================================================

If the user says:

"Create a C++ file that calculates the sum of N numbers."

The AI should not merely return code in chat.

It should generate a structured CREATE_FILE action.

Frontend should display:

AI wants to create:

sum.cpp

[code preview]

[Create File] [Cancel]

Only after user confirmation should the frontend/backend execute the action.

After creation:

- update workspace explorer
- persist file in PostgreSQL
- open the newly created file in the editor
- synchronize through existing WebSocket mechanisms if required
- maintain version history where appropriate

==================================================
6. FILE MODIFICATION
==================================================

If user says:

"Add error handling to code.js."

Do NOT blindly overwrite the file.

AI should generate a proposed change.

Prefer a diff-based approach:

{
  "action": "UPDATE_FILE",
  "fileId": "...",
  "changes": [
      {
          "startLine": 10,
          "endLine": 15,
          "replacement": "..."
      }
  ]
}

Frontend should show:

AI proposed changes to code.js

[diff viewer]

[Apply Changes] [Reject]

Only Apply Changes modifies the actual file.

==================================================
7. VERSION HISTORY
==================================================

Integrate AI modifications with the existing CodeRoom version-history system.

Every AI modification should be traceable.

Example:

Version 17
    ↓
AI modification
    ↓
Version 18

User must be able to revert AI-generated changes using the existing version-history mechanism.

Do NOT create a second version-history system.

==================================================
8. CHAT COMMANDS / MENTIONS
==================================================

Integrate with the existing @ mention system.

Support concepts such as:

@file
@folder
@workspace

Examples:

@file code.js explain this

@file utils.js review this

@folder auth find security problems

@workspace explain the authentication architecture

If the existing mention UI already exists, improve/integrate it instead of replacing it.

The mention dropdown must not overlap the chat input or Chat button.

==================================================
9. CURRENT FILE MUST ALWAYS BE AVAILABLE
==================================================

When the user opens:

code.js

the AI should know that:

ACTIVE FILE = code.js

If the user switches to:

hello.js

the AI context must automatically become:

ACTIVE FILE = hello.js

If the user asks:

"What code is present in this file?"

the AI should receive the currently active file content.

Do NOT hardcode file names.

==================================================
10. HANDLE EDITOR STATE CORRECTLY
==================================================

Important:

The editor may contain unsaved changes.

The AI should preferably receive the latest editor state rather than stale database content.

Design the frontend so that:

Editor state
    ↓
AI context

and not necessarily:

Database
    ↓
AI context

If the file has unsaved changes, AI should see the latest content.

After an AI modification, update:

Editor
Database
WebSocket collaboration state
Version history

consistently.

==================================================
11. SECURITY
==================================================

Never trust AI-generated file IDs, paths, folder IDs, or room IDs.

Backend must verify:

- authenticated user
- room membership
- file belongs to room
- folder belongs to room
- user has permission to modify the resource
- requested operation is allowed

Prevent:

- path traversal
- cross-room file access
- unauthorized file modification
- arbitrary database queries
- arbitrary filesystem access

The AI should only operate within the authenticated CodeRoom workspace.

==================================================
12. EFFICIENCY
==================================================

Do NOT send all files to Gemini on every message.

Use:

- active-file context
- explicit file references
- workspace tree
- selective file retrieval
- context/token limits
- relevant-file retrieval

For large projects, use a retrieval strategy.

For example:

User:
"Why is login failing?"

System:
1. inspect workspace tree
2. identify authentication-related files
3. retrieve relevant files
4. provide those files to the AI
5. generate answer

Do not send unrelated files such as:

README
images
node_modules
generated files
build output
etc.

==================================================
13. AI RESPONSE TYPES
==================================================

Design the backend response so it can distinguish between:

TEXT_RESPONSE

CODE_RESPONSE

CREATE_FILE

UPDATE_FILE

DELETE_FILE

RENAME_FILE

CREATE_FOLDER

READ_FILE

etc.

Example:

{
  "type": "TEXT_RESPONSE",
  "message": "code.js currently contains..."
}

or:

{
  "type": "ACTION",
  "action": {
      "type": "CREATE_FILE",
      "fileName": "sum.cpp",
      "content": "..."
  }
}

Do not force the frontend to parse natural-language AI responses to determine actions.

==================================================
14. EXISTING AI API
==================================================

Inspect the existing:

POST /api/ai/chat

Do not unnecessarily replace it.

Extend it to support workspace context and structured actions.

Maintain backward compatibility where practical.

If a new endpoint is genuinely required, explain why before implementing it.

==================================================
15. GEMINI INTEGRATION
==================================================

Use the existing Gemini integration.

Do not create another Gemini client if one already exists.

Inspect the existing ModelService and configuration.

Use the currently supported Gemini model and API format.

Keep Gemini-specific logic isolated inside the AI service layer.

The rest of CodeRoom should not depend directly on Gemini APIs.

==================================================
16. ERROR HANDLING
==================================================

Handle:

- Gemini unavailable
- invalid model
- API timeout
- rate limit
- malformed AI action
- file not found
- permission denied
- stale editor state
- WebSocket synchronization failure

The UI should show meaningful errors.

Never expose API keys or internal backend details.

==================================================
17. UI/UX
==================================================

The AI should feel integrated into the editor.

Example:

User:
"What code is in this file?"

AI:
"`code.js` currently contains a JavaScript function that..."

User:
"Create a function to calculate factorial."

AI:
"Here's the proposed change."

[View Diff]

[Apply]

User:
"Create a new file called factorial.cpp."

AI:
"Create `factorial.cpp`?"

[Create File]

The AI panel should visually distinguish:

- normal answers
- code blocks
- file creation
- file modifications
- errors
- action confirmations

==================================================
18. DO NOT BREAK EXISTING FEATURES
==================================================

Existing functionality must continue working:

- authentication
- rooms
- collaboration
- WebSockets
- file explorer
- folders
- CodeMirror
- file CRUD
- version history
- presence
- typing indicators
- AI chat
- existing REST APIs

Before modifying an existing service/component, understand how it is currently used.

==================================================
19. IMPLEMENTATION PROCESS
==================================================

Follow this order:

STEP 1:
Inspect the existing project architecture.

STEP 2:
Identify existing file/workspace state flow.

STEP 3:
Design the AI context contract.

STEP 4:
Implement current-file context first.

STEP 5:
Test:
"What code is present in the currently opened file?"

STEP 6:
Implement workspace/file retrieval.

STEP 7:
Implement structured AI actions.

STEP 8:
Implement CREATE_FILE with confirmation.

STEP 9:
Implement UPDATE_FILE with diff + confirmation.

STEP 10:
Integrate version history.

STEP 11:
Test WebSocket synchronization.

STEP 12:
Test permissions/security.

STEP 13:
Run the complete frontend and backend.

==================================================
20. TEST CASES
==================================================

You MUST verify these cases:

1.
Open code.js.

Ask:
"What code is present in this file?"

Expected:
AI correctly describes actual code.js content.

2.
Switch to hello.js.

Ask:
"What is this file doing?"

Expected:
AI uses hello.js, NOT code.js.

3.
Ask:
"Explain the function on line 20."

Expected:
AI uses current file context.

4.
Ask:
"Create sum.cpp that calculates the sum of N numbers."

Expected:
AI proposes CREATE_FILE.

5.
Click Create.

Expected:
File appears in explorer and opens in editor.

6.
Ask:
"Add error handling to this file."

Expected:
AI proposes a diff.

7.
Reject the change.

Expected:
File remains unchanged.

8.
Apply the change.

Expected:
Editor, database, WebSocket state and version history remain consistent.

9.
Ask:
"Compare code.js and utils.js."

Expected:
Only those relevant files are provided.

10.
Ask:
"Find authentication problems in the project."

Expected:
AI retrieves relevant project files instead of receiving the entire workspace blindly.

==================================================
FINAL REQUIREMENT
==================================================

Do not just make the chatbot receive a giant string containing all files.

Build a clean, scalable "AI Workspace Context + Controlled Tool Execution" architecture.

The final system should behave like:

CodeRoom Editor
      ↕
Workspace State
      ↕
AI Context Manager
      ↕
AI Service / Gemini
      ↕
Structured Tool Actions
      ↕
CodeRoom File/Folder Services
      ↕
PostgreSQL + WebSocket + Version History

The AI is an assistant INSIDE CodeRoom, not a separate chatbot.

Before finishing, provide:

1. Files changed
2. Architecture implemented
3. API changes
4. AI context format
5. Supported AI actions
6. Security considerations
7. How file creation/update works
8. How version history is preserved
9. Tests performed
10. Any remaining limitations

Do not claim something is implemented unless you actually implemented and tested it.