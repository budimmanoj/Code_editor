give me the prompt for giving it to ai for end to end working of this project 

{\textbf{Real-Time Collaborative Code Workspace} \textbar\ \emph{React.js, Spring Boot, WebSockets, PostgreSQL} \href{https://github.com/budimmanoj/Code_editor}{\raisebox{-0.1\height}\faGithub}}{May 2026}
\resumeItemListStart
    \resumeItem{Built a real-time collaborative code editor using React.js, Spring Boot, WebSockets, and CodeMirror, enabling simultaneous multi-user code editing with low-latency synchronization.}
    \resumeItem{Designed a secure workspace management system with JWT authentication, role-based access, REST APIs, and PostgreSQL for persistent storage of users, projects, files, and folders.}
    \resumeItem{Integrated multi-language editing, version history, and code review workflows using a modular architecture for scalable collaborative development.}
\resumeItemListEnd

If you're using Claude Code or Gemini CLI/Antigravity to finish a half-built project, you want the AI to behave like a senior software engineer, not just generate code. The prompt should instruct it to analyze the existing codebase, preserve architecture, implement missing features, fix bugs, and verify everything end-to-end.

Use this:

Prompt

You are a Senior Full-Stack Software Engineer with expertise in React.js, Spring Boot, WebSockets, PostgreSQL, JWT Authentication, CodeMirror, distributed systems, and software architecture.

I have an existing partially completed project. Your task is NOT to rewrite it from scratch.

Your goal is to complete, improve, and productionize the existing application while preserving the current architecture wherever possible.

Project Goal

Build a production-quality Real-Time Collaborative Code Workspace similar to VS Code Live Share or a lightweight Google Docs for code.

Target technologies:

React.js
Spring Boot
WebSockets (STOMP/SockJS)
PostgreSQL
JWT Authentication
Spring Security
CodeMirror
Maven
JPA/Hibernate
Expected Features
Authentication

Implement complete authentication.

Register
Login
JWT Authentication
Refresh token (if needed)
Logout
Password encryption
Spring Security
Protected routes
Token expiration handling
Workspace Management

Users should be able to

Create workspace
Join workspace
Delete workspace
Invite users
Manage members
Owner/Admin/User roles
Leave workspace
File System

Support

Nested folders
Files
Rename
Delete
Move
Create
Persistent storage
Tree structure

Exactly like a lightweight VS Code Explorer.

Real-Time Collaboration

Do NOT use polling.

Replace any existing polling implementation with WebSockets.

Implement

instant code synchronization
multiple users editing simultaneously
automatic reconnect
typing indicators
online users
user join notifications
user leave notifications

Edits should appear instantly.

Conflict Handling

Implement a basic concurrent editing strategy.

If Operational Transformation or CRDT is too large, implement a clean architecture that allows it to be added later.

Do NOT leave race conditions.

Code Editor

Use CodeMirror.

Support

multiple languages
syntax highlighting
themes
auto closing brackets
line numbers
search
formatting shortcuts
keyboard shortcuts
Version History

Implement

save snapshots
view previous versions
restore version
timestamps
author information
Code Review

Implement

approval workflow
comments
review status
pending approvals
Presence

Show

users online
active editor
typing
currently opened file
REST APIs

Design clean REST APIs for

Authentication

Workspace

Files

Folders

Users

History

Reviews

Everything should follow REST conventions.

Database

Use PostgreSQL.

Design normalized tables.

Include

Users

Workspace

Members

Projects

Folders

Files

VersionHistory

Reviews

Comments

Everything should use proper foreign keys.

Backend

Use

Spring Boot

Spring Security

JPA

Hibernate

DTOs

Services

Repositories

Controllers

Exception handling

Validation

Global Exception Handler

Logging

Configuration classes

Keep code modular.

Frontend

React.js

Modern component structure.

Reusable components.

Proper hooks.

Context API or Redux if required.

Responsive UI.

Clean folder structure.

Proper loading states.

Error handling.

Toast notifications.

WebSocket Architecture

Design scalable WebSocket architecture.

Separate

Events

Handlers

Messaging

Synchronization

Presence

Notifications

No duplicate events.

No unnecessary broadcasts.

Performance

Optimize

database queries

rendering

WebSocket traffic

API calls

Avoid unnecessary rerenders.

Security

JWT

Authorization

Input validation

SQL Injection prevention

XSS prevention

CSRF considerations

Role validation

Secure WebSocket endpoints

Error Handling

Application should never crash because of common user mistakes.

Handle

invalid tokens

disconnected users

network failures

duplicate workspace names

missing files

simultaneous deletes

stale edits

UI/UX

Professional IDE-like interface.

Dark theme.

Resizable panels.

Explorer

Editor

Members

Activity

Review panel

Responsive layout.

AI Features (Bonus)

If architecture permits, implement:

AI code review
Code explanation
Bug detection
Code optimization suggestions
Automatic documentation generation
Commit message generation
Syntax error explanation

Design these as modular services so different LLM providers can be plugged in later.

Code Quality

Follow SOLID principles.

Avoid duplicated logic.

Refactor bad code.

Improve naming.

Remove dead code.

Write maintainable code.

Testing

Verify

authentication

workspace creation

real-time collaboration

editing

database persistence

WebSockets

version history

review workflow

JWT validation

Fix every bug encountered.

Final Deliverable

Do not stop after generating code.

Instead:

Analyze the entire repository.
Identify incomplete features.
Identify bugs.
Fix compilation errors.
Fix runtime errors.
Complete every missing feature.
Improve project architecture where necessary.
Ensure backend and frontend integrate correctly.
Verify every feature works end-to-end.
Test the application locally until it runs without errors.
Resolve every issue you encounter before moving on.
Continue autonomously until the project is fully functional.

If there are multiple implementation options, choose the one that results in the most maintainable, scalable, and production-ready application.

Treat this as if you are the sole engineer responsible for shipping this project. Do not leave placeholders, TODOs, stub implementations, or partially completed features. The final result should be something I can confidently showcase on my resume and GitHub as a polished, end-to-end real-time collaborative code editor.



Yes. If this is going on your **resume**, adding practical AI features will make it stand out much more than just saying "AI-powered." The key is to make the AI features **useful** rather than gimmicky.

Add this section to your prompt:

---

# AI-Powered Developer Assistant

Implement a modular AI assistant integrated directly into the editor.

The AI should be optional and accessible through dedicated buttons, a side panel, or a floating assistant so it never interrupts normal coding.

The AI architecture must be provider-agnostic so different LLMs (Gemini, OpenAI, Claude, Ollama, etc.) can be plugged in by simply changing the backend configuration.

Use streaming responses where possible.

---

## AI Features

Implement the following AI capabilities.

### 1. AI Code Review

Add a **"Review Code"** button.

When clicked:

* Analyze the currently opened file.
* Detect

  * bad coding practices
  * code smells
  * duplicated logic
  * security issues
  * performance problems
  * naming issues
  * readability
  * maintainability
* Display suggestions in a side panel.
* Allow users to accept or ignore each suggestion.

---

### 2. AI Debugger

Add a **"Debug"** button.

The AI should

* analyze compile/runtime errors
* explain the error in simple language
* identify probable root causes
* highlight the problematic code
* suggest fixes
* generate corrected code

If stack traces are available, analyze them automatically.

---

### 3. Explain Code

Add an **"Explain"** button.

When users select code,

the AI explains

* what the code does
* time complexity
* space complexity
* algorithm
* logic flow
* potential improvements

---

### 4. Optimize Code

Add an **"Optimize"** button.

The AI should

* reduce complexity
* improve readability
* improve performance
* suggest modern language features
* simplify nested logic

Provide a side-by-side comparison before applying changes.

---

### 5. Generate Documentation

Add a **"Generate Docs"** button.

Automatically generate

* function documentation
* JavaDoc
* API descriptions
* README sections
* inline comments

---

### 6. Bug Detection

Implement continuous bug detection.

When the user clicks **Analyze Code**

AI checks for

* null pointer risks
* index out of bounds
* infinite loops
* race conditions
* SQL injection
* XSS
* unsafe API usage
* memory leaks
* concurrency issues

Display severity levels.

---

### 7. Fix with AI

Whenever AI detects an issue,

display

```
⚠ Problem Found

Explanation

[Fix Automatically]

[Ignore]

[Show Reason]
```

If the user clicks **Fix Automatically**

generate a patch

preview changes

allow Accept or Reject.

---

### 8. AI Chat Assistant

Include an AI chat panel.

Users can ask

* Explain this function
* Why is this code failing?
* Generate unit tests
* Improve this API
* Refactor this class
* Convert Java to Python
* Explain SQL query
* Explain regex
* Generate documentation

The chat should automatically include the currently opened file as context.

---

### 9. AI Code Completion

Implement optional AI autocomplete.

While typing,

allow users to press

```
Ctrl + Space
```

to request

* next line prediction
* function completion
* boilerplate generation

---

### 10. Generate Unit Tests

Add a button

```
Generate Tests
```

Generate

* JUnit tests
* React Testing Library tests
* edge cases
* assertions
* mocks

---

### 11. Commit Message Generator

After code changes,

AI can generate

```
feat:

fix:

refactor:

docs:

test:
```

style commit messages.

---

### 12. README Generator

Generate project documentation automatically from the workspace.

---

### 13. Smart Error Assistant

Whenever compilation fails,

automatically show

```
What happened

Why it happened

How to fix it

Suggested code
```

---

### 14. AI Refactor

Allow users to select code and choose

* Extract Method
* Rename Variables
* Split Large Function
* Remove Duplicate Code
* Apply SOLID principles
* Improve Design Patterns

---

### 15. Security Scanner

Add

```
Scan Security
```

AI checks for

* SQL Injection
* XSS
* CSRF
* JWT misuse
* insecure authentication
* hardcoded secrets
* exposed API keys
* insecure dependencies

---

### 16. Complexity Analyzer

Analyze

* Cyclomatic Complexity
* Code Duplication
* Maintainability Index
* Performance Bottlenecks

Display a report.

---

### 17. AI Architecture Advisor

Analyze the entire project and suggest

* folder improvements
* package restructuring
* design patterns
* dependency cleanup
* modularization

---

## UI

Design a professional IDE-like interface.

Toolbar:

```
Save

Review Code

Debug

Explain

Optimize

Generate Docs

Generate Tests

Security Scan

Analyze

AI Chat
```

Each feature should open inside a collapsible right-side panel.

---

## Backend Architecture

Implement an AI service layer.

```
AIController

AIService

PromptBuilder

ContextBuilder

LLMProvider

GeminiProvider

OpenAIProvider

ClaudeProvider

OllamaProvider
```

The provider should be configurable using environment variables.

Never hardcode API keys.

---

## Future Proofing

The AI module must be completely independent of the editor logic so additional models or tools can be integrated later without modifying the rest of the application.

---

### One more feature that would make this project exceptional

Ask the AI to implement **"Review before Commit"**.

Whenever the user clicks **Commit** or **Create Pull Request**, the AI automatically performs:

* ✅ Code Review
* 🐞 Bug Detection
* 🔒 Security Scan
* ⚡ Performance Analysis
* 📊 Code Quality Score (0–100)
* 💡 Improvement Suggestions

Only after the review does it allow the user to proceed. This mimics AI-assisted workflows in modern developer tools and makes the project significantly more impressive for recruiters and interviewers.
