# CodeRoom: AI-Powered Collaborative Code Workspace

CodeRoom is a modern, real-time collaborative code editor with a built-in AI assistant. It allows multiple developers to work on the same codebase simultaneously while leveraging the power of generative AI to improve code quality and speed up development.

## 🚀 Key Features

### 💻 Real-Time Collaboration
- **Live Sync**: Multiple users can edit the same file in real-time with ultra-low latency via WebSockets.
- **Presence & Cursors**: See who is online in the room and view live typing indicators.
- **Workspace Explorer**: Manage files and folders with a fully functional file tree. Upload entire directories or individual files directly into the workspace.
- **Version History**: The platform automatically saves snapshots of code. View previous versions and easily revert changes.

### 🤖 Built-in AI Assistant (Powered by Gemini)
The IDE features a dedicated AI Panel that acts as your pair programmer. Available features include:
1. **Review**: Analyze code for bugs, logic errors, and best practices.
2. **Explain**: Get plain-english explanations of complex code snippets.
3. **Refactor**: Automatically restructure code to improve readability and maintainability.
4. **Debug**: Paste stack traces to identify root causes and get fixed code.
5. **Optimize**: Enhance performance and reduce algorithmic complexity.
6. **Generate**: Create boilerplate, specific functions, or algorithms from natural language prompts.
7. **Tests**: Automatically generate unit tests (e.g., JUnit, Jest, PyTest) for your code.
8. **Docs**: Generate JSDoc, JavaDoc, or Python docstrings.
9. **Commit Msg**: Automatically generate conventional Git commit messages based on recent changes.
10. **Security**: Scan your code for common vulnerabilities (SQLi, XSS, etc.).
11. **Chat**: Ask general programming questions with your current file used as context.
12. **Review Before Save**: Get a comprehensive pre-commit AI review before persisting major changes.

### 🔐 Security & Access Control
- **Role-based Access**: Room creators become `ADMIN`s and can manage code versions and participant access.
- **JWT Authentication**: Secure user login and registration system.
- **Safe WebSockets**: WebSocket connections are secured and validated via JWT tokens.

## 🛠️ Technology Stack

**Frontend:**
- React
- CodeMirror 6 (with rich extensions for autocompletion, syntax highlighting, bracket matching, and search)
- Vanilla CSS with a sleek, dark IDE aesthetic
- Custom WebSocket Client

**Backend:**
- Java 21 & Spring Boot 3.3.0
- Spring Security (JWT)
- Spring WebSocket
- PostgreSQL (Database)
- Native JDK `HttpClient` for seamless integration with the Gemini API

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- Java 21
- PostgreSQL running locally
- Gemini API Key

### Backend Setup
1. Navigate to the `server` directory.
2. Ensure your PostgreSQL database is running and credentials match your `application.properties`.
3. Set your Gemini API key in your environment variables:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```
4. Run the Spring Boot application.

### Frontend Setup
1. Navigate to the `client` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

Open your browser to `http://localhost:3000` to start collaborating!

## 📦 Project Structure
- `/client`: React frontend application containing the editor UI, file tree, AI panel, and API services.
- `/server`: Spring Boot backend handling REST endpoints, WebSocket connections, database interactions, and AI prompt orchestration.
