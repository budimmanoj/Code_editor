# CodeRoom: AI-Powered Real-Time Collaborative Workspace

**CodeRoom** is a full-stack, real-time collaborative code editor designed to bridge the gap between solo development environments and synchronous pair programming, heavily augmented with artificial intelligence. It combines the power of a modern IDE, seamless multiplayer synchronization, and an embedded, context-aware AI pairing partner.

This project showcases both **advanced full-stack distributed system architecture** and **complex AI integration engineering**.

---

## 🎯 Business Statement & Core Value

Traditional pair programming over screen-shares inherently limits productivity—only one person can actively write code, while others are forced into passive roles. Furthermore, developers frequently context-switch to external tools for AI assistance, disrupting their flow and losing project context.

CodeRoom solves these inefficiencies by providing a unified workspace where:
1. **True Multiplayer Collaboration:** Multiple engineers can write and edit code concurrently with zero-latency synchronization.
2. **Context-Aware Intelligence:** The AI inherently knows the entire workspace context, including live files and directory structures, eliminating the need to manually copy-paste code.
3. **Safe AI Delegation & Role-Based Workflows:** The AI acts as a teammate that proposes structural changes (creating multiple files, refactoring). However, strict workflows ensure that AI-generated code is sandboxed into "Proposals" and gatekept by human Room Admins before merging into the codebase.

---

## 🛠️ Technical Highlights & Engineering Challenges

This project overcomes significant challenges in both distributed real-time state synchronization and LLM orchestration:

### AI Engineering Highlights
* **Workspace Context Orchestration:** Engineered a dynamic prompt-building engine that intelligently compacts the live workspace tree and the active file's code, feeding the Gemini model highly relevant context while strictly managing token limits.
* **Structured JSON Actions & Multi-File Generation:** The AI is instructed to return strictly validated JSON payloads representing actions (`CREATE_FILE`, `UPDATE_FILE`). It can propose complex, multi-file architectural changes in a single inference pass, which the frontend parses into interactive UI cards.
* **Asynchronous AI Streaming:** AI inference is decoupled from the main WebSocket thread. The backend orchestrates requests to Google's Gemini models via asynchronous `HttpClient` calls, keeping the real-time syncing engine fluid and zero-latency.

### Full-Stack & Distributed Systems Highlights
* **Optimistic Locking & Concurrency Control:** Handled race conditions during AI-proposed code merges and human edits by implementing JPA `@Version` optimistic locking. This ensures that if a human user edits a file while an Admin is simultaneously approving an AI change, the transaction safely resolves without data corruption.
* **WebSocket Synchronization State:** Implemented a robust WebSocket broadcast system that guarantees messages are only pushed to the room *after* a successful database transaction commit, preventing the broadcasting of ghost states in the event of a rollback.
* **Real-time Conflict Resolution:** Utilized Yjs (CRDT) patterns combined with debounced `CODE_UPDATE` streams to ensure true zero-latency syncing across clients without constantly hammering the backend.
* **Stateless Security:** Engineered a completely stateless authentication flow. JWTs are passed via query parameters during the WebSocket upgrade handshake, bypassing standard browser limitations for custom headers over WSS protocols.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────┐
│            React Client         │  Port 3000
│  CodeMirror + AI Action Parser  │
└──────────┬──────────────────────┘
           │  REST /api/*  +  WebSocket /ws/room/{id}
           ▼
┌─────────────────────────────────┐
│        Spring Boot Server       │  Port 8080
│  AI Orchestration & WS Handler  │
└──────────┬──────────────────────┘
           │  JDBC
           ▼
┌─────────────────────────────────┐
│           PostgreSQL            │  Port 5432
└─────────────────────────────────┘
```

### Data Flow & Communication
* **State Sync (Full Stack):** Clients send localized `CODE_UPDATE` events over WebSocket. The server validates, versions, and broadcasts the event to all other clients in the room. 
* **Persistence (Full Stack):** To avoid database bottlenecks, edits are buffered in-memory per room and asynchronously flushed to PostgreSQL after a 3-second debounce window.
* **AI Delegation (AI):** AI requests are handled asynchronously. The backend orchestrates the context gathering (current file, workspace tree, user intent) and streams it to Google's Gemini models, keeping the WebSocket connection open for other collaborative traffic.

---

## ⚙️ Tech Stack

* **Frontend:** React, CodeMirror 6, Yjs (CRDT), Lucide Icons
* **Backend:** Java 21, Spring Boot (Web, Data JPA, Security, WebSocket)
* **Database:** PostgreSQL 15
* **AI Integration:** Google Gemini 2.0 Flash via native JDK 21 `HttpClient`, Prompt Engineering, Structured Outputs

---

## ✨ Key Features

* **Multi-File AI Generation:** The AI can generate entire feature architectures across multiple new files simultaneously, allowing users to scaffold entire components with a single prompt.
* **Intelligent AI Operations:** Pre-built AI workflows for Code Review, Refactoring, Debugging, Documentation generation, and Security vulnerability (OWASP) scanning.
* **AI Proposal Sandboxing:** AI outputs are never blindly injected. They are rendered as interactive diffs and pending files, requiring explicit Admin approval.
* **True Multiplayer Synchronization:** Live presence tracking, distinct cursor colors, real-time typing indicators, and Yjs-powered zero-latency conflict resolution.
* **Robust Code Editor:** CodeMirror 6 powers the editor with syntax highlighting for 10+ languages, bracket matching, code folding, and standard IDE shortcuts.
* **Workspace Management:** Create nested directories, upload full project folders, and download workspaces as ZIP archives.
* **Snapshot Versioning:** Every database write creates a version snapshot, allowing teams to instantly revert to previous states if a breaking change is merged.

---

## 🚀 Quick Start (Docker)

CodeRoom can be spun up quickly using Docker for local testing.

### Prerequisites
* Docker & Docker Compose
* A free Gemini API Key (from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Running the Application

1. Clone the repository and navigate into the root directory.
2. Create your environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and configure your `DB_PASSWORD` and `GEMINI_API_KEY`.
4. Start the stack:
   ```bash
   docker-compose up --build
   ```
5. Navigate to `http://localhost:3000` to access the application.

*Note: The Spring Boot API runs on port `8080` and PostgreSQL on port `5432`.*

## 📖 API Documentation
Once the backend is running, fully interactive API documentation is available via Swagger UI at:
`http://localhost:8080/swagger-ui.html`
