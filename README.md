# CodeRoom: Real-Time Collaborative Coding Environment

**CodeRoom** is a full-stack, real-time collaborative code editor designed to bridge the gap between solo development environments and synchronous pair programming. It combines the power of a modern IDE with seamless, multiplayer synchronization and integrated AI assistance.

## 🎯 Business Statement & Core Value

Traditional pair programming over screen-shares inherently limits productivity—only one person can actively write code, while others are forced into passive roles. Furthermore, developers frequently context-switch to external tools for AI assistance, disrupting their flow. 

CodeRoom solves these inefficiencies by providing a unified workspace where:
1. **Multiple engineers can write and edit code concurrently** with zero-latency synchronization.
2. **Context-aware AI** is embedded directly into the workspace, capable of reviewing code, generating tests, and proposing refactors without the developer ever leaving the editor.
3. **Strict, role-based workflows** ensure that while collaboration is fluid, structural changes and AI-generated code are gatekept by Room Admins.

## 🛠️ Technical Highlights & Engineering Challenges

This project was architected to handle complex state synchronization and concurrency—key challenges in any distributed, real-time system.

* **Optimistic Locking & Concurrency Control:** Handled race conditions during AI-proposed code merges by implementing JPA `@Version` optimistic locking. This ensures that if a human user edits a file while an Admin is simultaneously approving an AI change, the transaction safely resolves without data corruption.
* **WebSocket Synchronization State:** Implemented a robust WebSocket broadcast system that guarantees messages are only pushed to the room *after* a successful database transaction commit, preventing the broadcasting of ghost states in the event of a rollback.
* **Real-time Conflict Resolution:** Utilized Yjs (CRDT) patterns combined with debounced `CODE_UPDATE` streams to ensure true zero-latency syncing across clients without constantly hammering the backend.
* **Stateless Security:** Engineered a completely stateless authentication flow. JWTs are passed via query parameters during the WebSocket upgrade handshake, bypassing standard browser limitations for custom headers over WSS protocols.

## 🏗️ System Architecture

```text
┌─────────────────────────────────┐
│            React Client         │  Port 3000
│  CodeMirror 6 + WebSocket Sync  │
└──────────┬──────────────────────┘
           │  REST /api/*  +  WebSocket /ws/room/{id}
           ▼
┌─────────────────────────────────┐
│        Spring Boot Server       │  Port 8080
│  JPA + Security + WS Handler    │
│  Gemini AI via JDK HttpClient   │
└──────────┬──────────────────────┘
           │  JDBC
           ▼
┌─────────────────────────────────┐
│           PostgreSQL            │  Port 5432
└─────────────────────────────────┘
```

### Data Flow & Communication
* **State Sync:** Clients send localized `CODE_UPDATE` events over WebSocket. The server validates, versions, and broadcasts the event to all other clients in the room. 
* **Persistence:** To avoid database bottlenecks, edits are buffered in-memory per room and asynchronously flushed to PostgreSQL after a 3-second debounce window.
* **AI Delegation:** AI requests are handled asynchronously. The backend orchestrates the context gathering (current file, workspace tree, user intent) and streams it to Google's Gemini models, keeping the WebSocket connection open for other collaborative traffic.

## ⚙️ Tech Stack

* **Frontend:** React, CodeMirror 6, Yjs, Lucide Icons
* **Backend:** Java 21, Spring Boot (Web, Data JPA, Security, WebSocket)
* **Database:** PostgreSQL 15
* **AI Integration:** Google Gemini 2.0 Flash via native JDK 21 `HttpClient`

## ✨ Key Features

* **True Multiplayer Synchronization:** Live presence tracking, distinct cursor colors, and real-time typing indicators.
* **Intelligent AI Integration:** Ask questions, request refactors, or scan for OWASP vulnerabilities. AI code proposals are sandboxed until an Admin explicitly merges them.
* **Robust Code Editor:** CodeMirror 6 powers the editor with syntax highlighting for 10+ languages, bracket matching, code folding, and standard IDE shortcuts.
* **Workspace Management:** Create nested directories, upload full project folders, and download workspaces as ZIP archives.
* **Snapshot Versioning:** Every database write creates a version snapshot, allowing teams to instantly revert to previous states if a breaking change is merged.

## 🚀 Quick Start

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

*Note: The Spring Boot API runs on port `8080` and the PostgreSQL database operates on port `5432`.*

## 📖 API Documentation

Once the backend is running, fully interactive API documentation is available via Swagger UI at:
`http://localhost:8080/swagger-ui.html`
