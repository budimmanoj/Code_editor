# CodeRoom — Real-Time Collaborative Code Editor

> A production-quality, full-stack collaborative code editor built with **Spring Boot**, **React**, **WebSockets**, and **Gemini AI**.

---

## ✨ Features

### Real-Time Collaboration
- **Live code sync** — changes broadcast instantly via WebSocket (no polling)
- **Typing indicators** — see who is editing right now
- **Presence system** — live online/offline status for every participant
- **Cursor colors** — each user gets a unique cursor color in the participants panel

### Code Editor
- **CodeMirror 6** with syntax highlighting for 10+ languages (JavaScript, Python, Java, C++, Rust, HTML, CSS, TypeScript, SQL, Markdown)
- **Auto-complete**, **bracket matching**, **code folding**
- **Find & replace** (`Ctrl+F`)
- **Keyboard shortcuts** (`Ctrl+S` to save, `Ctrl+\`` for AI panel)
- **Tab ↔ spaces**, indent on input

### AI Assistant (Gemini)
- **Explain** — plain-language explanation of any code
- **Refactor** — improve code quality automatically
- **Debug** — diagnose errors with optional stack trace
- **Generate** — generate code from a natural-language prompt
- **Review** — comprehensive bug and security review before saving
- **Tests** — auto-generate unit tests
- **Optimize** — performance improvements
- **Docs** — generate JSDoc / docstrings
- **Commit Message** — generate a Git commit message
- **Security Scan** — dedicated OWASP-style vulnerability scan
- **Chat** — free-form conversation with your code as context

### Workspace Management
- **File tree** — create, rename, delete, nested folders
- **Upload files or entire folders** (binary files automatically skipped)
- **Download** individual files or the entire workspace as a **ZIP**
- **Version history** — every save creates a snapshot; revert to any version
- **Admin review workflow** — admins can mark versions REVIEWED or NO_CHANGE

### Rooms
- Create rooms with a unique 8-character **invite code**
- Share the invite code; teammates join instantly
- Role-based access: **ADMIN** vs **MEMBER**
- Profile page shows all your rooms

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│            React Client          │  Port 3000
│  CodeMirror 6 + WebSocket client │
└──────────┬──────────────────────┘
           │  REST /api/*  +  WebSocket /ws/room/{id}
           ▼
┌─────────────────────────────────┐
│        Spring Boot Server        │  Port 8080
│  JPA + Security + WS Handler    │
│  Gemini AI via JDK HttpClient   │
└──────────┬──────────────────────┘
           │  JDBC
           ▼
┌─────────────────────────────────┐
│           PostgreSQL             │  Port 5432
└─────────────────────────────────┘
```

### WebSocket Protocol

All messages are JSON with a `type` field:

| Direction | Type | Description |
|-----------|------|-------------|
| Server → Client | `PRESENCE_INIT` | List of already-connected users when you join |
| Server → Client | `USER_JOINED` | A participant connected |
| Server → Client | `USER_LEFT` | A participant disconnected |
| Client → Server | `CODE_UPDATE` | Send a code change (debounced 500 ms) |
| Server → Other Clients | `CODE_UPDATE` | Broadcast the change |
| Client → Server | `CURSOR_UPDATE` | Cursor position {line, col} |
| Server → Other Clients | `CURSOR_UPDATE` | Broadcast cursor position |
| Client → Server | `TYPING` | Typing started/stopped |
| Server → Other Clients | `TYPING` | Broadcast typing status |

The server auto-saves code to PostgreSQL 3 seconds after the last `CODE_UPDATE`.

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- **Java 21** (`java -version`)
- **Maven 3.9+** (`mvn -version`)
- **Node.js 18+** (`node -version`)
- **PostgreSQL 15+** running locally

### 1. Database setup

```sql
CREATE DATABASE coder_editor;
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD and GEMINI_API_KEY at minimum
```

Or just set environment variables directly in your shell.

### 3. Start the backend

```bash
cd server
# Set env vars (or they will use defaults from application.properties)
$env:GEMINI_API_KEY="your-key-here"   # Windows PowerShell
mvn spring-boot:run
```

Backend starts on **http://localhost:8080**  
Swagger UI: **http://localhost:8080/swagger-ui.html**

### 4. Start the frontend

```bash
cd client
npm install
npm start
```

Frontend starts on **http://localhost:3000**

---

## 🐳 Docker (Recommended)

The easiest way to run the full stack:

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set DB_PASSWORD and GEMINI_API_KEY

# 2. Start everything
docker-compose up --build

# 3. Open the app
# http://localhost:3000
```

Services:
| Service | URL |
|---------|-----|
| React App | http://localhost:3000 |
| Spring Boot API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| PostgreSQL | localhost:5432 |

To stop: `docker-compose down`  
To wipe data: `docker-compose down -v`

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/coder_editor` | JDBC connection string |
| `DB_USER` | `postgres` | Database username |
| `DB_PASSWORD` | `hema143` | Database password (**change in prod!**) |
| `JWT_SECRET` | *(long default)* | JWT signing secret (≥ 32 chars, **change in prod!**) |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime in ms (24h) |
| `GEMINI_API_KEY` | *(empty)* | Gemini API key — AI features disabled if blank |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins |
| `PORT` | `8080` | Server port |

---

## 📁 Project Structure

```
codeEditor/
├── docker-compose.yml
├── .env.example
├── server/                     # Spring Boot (Java 21)
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/dev/manoj/demo/
│       ├── ai/                 # Gemini AI integration
│       │   ├── AiProvider.java
│       │   ├── GeminiProvider.java
│       │   └── AiService.java
│       ├── controllers/        # REST + AI controllers
│       ├── websocket/          # WS handler, JWT interceptor, config
│       ├── service/            # Business logic
│       ├── model/              # JPA entities
│       ├── dto/                # Request/response DTOs
│       ├── security/           # JWT auth filter, config
│       └── repository/         # Spring Data JPA repos
└── client/                     # React (CRA)
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/
        │   └── client.js       # REST + WS base URLs
        ├── websocket/
        │   └── RoomSocket.js   # WebSocket client
        ├── components/
        │   ├── CodeEditor.jsx  # CodeMirror 6 editor
        │   ├── AiPanel.jsx     # Tabbed AI assistant panel
        │   ├── FileTree.jsx    # File explorer
        │   └── Participants.jsx # Live presence panel
        └── pages/
            ├── AuthPage.jsx    # Login / register
            ├── LobbyPage.jsx   # Room create/join/profile
            └── EditorPage.jsx  # Main workspace
```

---

## 🔑 Getting a Gemini API Key

1. Go to **https://aistudio.google.com/app/apikey**
2. Click **Create API Key**
3. Copy the key and set `GEMINI_API_KEY=your-key` in `.env`
4. Restart the server

AI features will gracefully show an error message if the key is not set.

---

## 🛡️ Security Notes

- JWT tokens are **stateless** — no server-side session storage
- WebSocket authentication is done via JWT **query parameter** during the upgrade handshake (browsers cannot send custom headers during WS upgrades)
- Passwords are hashed with **BCrypt**
- All workspace endpoints validate room membership before serving data
- PostgreSQL null bytes (`\u0000`) are stripped before storage to prevent JDBC errors
- CORS is configurable via `cors.allowed-origins`

---

## 📝 API Reference

Full interactive docs at **http://localhost:8080/swagger-ui.html** when the server is running.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users/register` | Create account |
| `POST` | `/api/users/login` | Login, returns JWT |
| `POST` | `/api/rooms/create` | Create a room |
| `POST` | `/api/rooms/join` | Join via invite code |
| `GET` | `/api/workspace/{roomId}/fileTree` | Get file tree |
| `GET` | `/api/workspace/{roomId}/fileNode/{id}` | Get file content |
| `PUT` | `/api/code/update` | Save file content |
| `GET` | `/api/code/versions/{roomId}/{fileId}` | Version history |
| `POST` | `/api/ai/explain` | AI: explain code |
| `POST` | `/api/ai/refactor` | AI: refactor code |
| `POST` | `/api/ai/review` | AI: code review |
| `POST` | `/api/ai/chat` | AI: free-form chat |
| `WS` | `/ws/room/{roomId}?token=JWT` | WebSocket connection |
