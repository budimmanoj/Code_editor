Implement a **Code Change Approval + Version History + Real-Time WebSocket Synchronization** workflow in the existing CodeRoom application.

The application already has:

* React frontend
* Spring Boot backend
* PostgreSQL
* WebSockets
* JWT authentication
* File/folder management
* Version history
* Real-time collaborative editing

Do NOT rewrite the existing architecture unnecessarily. First inspect the existing implementation and integrate this feature cleanly with the current code.

---

# PART 1 — Code Change Approval Workflow

## Goal

When a normal user modifies code in a workspace, the change must be stored as a **pending revision** and must be reviewed by an administrator before becoming the officially approved version.

The core flow must be:

```text
User edits code
      ↓
Create new revision
      ↓
Revision = PENDING
      ↓
Store in PostgreSQL
      ↓
Admin logs in
      ↓
Admin opens History / Pending Reviews
      ↓
Admin reviews diff
      ↓
Approve OR Reject
      ↓
If approved → becomes current approved version
If rejected → previous approved version remains current
```

---

# PART 2 — Do NOT overwrite the approved code

This is extremely important.

Do NOT simply do:

```text
files.content = newCode
```

when a normal user edits a file.

Instead, introduce/extend a versioning model.

Inspect the existing database schema first.

Prefer a structure conceptually like:

### files

```text
id
name
folder_id
current_version_id
...
```

### file_versions

```text
id
file_id
version_number
content
created_by
created_at
status
reviewed_by
reviewed_at
review_comment
```

Statuses:

```text
PENDING
APPROVED
REJECTED
```

Adapt the exact schema to the existing project rather than blindly creating duplicate tables.

---

# PART 3 — User edits

When a normal user changes:

```text
Main.java
```

create a new version:

```text
Version 11
Status = PENDING
Created by = current user
```

The currently approved version must remain untouched.

Example:

```text
Main.java

Version 10
✓ APPROVED
System.out.println("Hello");

Version 11
⏳ PENDING
System.out.println("Hello World");
```

The database must clearly distinguish:

```text
Current approved version
```

from:

```text
Pending user changes
```

---

# PART 4 — History UI

Extend the existing History feature.

When Admin opens History/Pending Reviews, show:

```text
Main.java

Version 11
Status: Pending Review
Changed by: User
Created: <timestamp>

[Review Changes]
```

When the admin opens the revision, display a proper code diff.

For example:

```text
- System.out.println("Hello");
+ System.out.println("Hello World");
```

Clearly distinguish:

* Added lines
* Removed lines
* Unchanged lines

Use the existing editor/diff components if available.

---

# PART 5 — Admin approval

Only users with the ADMIN role can approve or reject changes.

The backend MUST enforce this.

Do not rely only on hiding buttons in React.

Create/extend backend APIs such as:

```text
GET  /api/reviews/pending
GET  /api/reviews/{revisionId}
POST /api/reviews/{revisionId}/approve
POST /api/reviews/{revisionId}/reject
GET  /api/files/{fileId}/history
```

Adapt the endpoints to the existing API conventions.

---

## Approve

When Admin clicks:

```text
Approve
```

perform the operation transactionally:

```text
Pending version
      ↓
STATUS = APPROVED
      ↓
files.current_version_id = approved version
      ↓
Record reviewer + timestamp
```

Only after successful database commit should the system notify connected clients.

---

## Reject

When Admin clicks:

```text
Reject
```

the revision becomes:

```text
STATUS = REJECTED
```

and the previous approved version remains the current approved version.

Allow the admin to provide an optional rejection comment.

Example:

```text
Rejected

Reason:
"Please handle null input before submitting."
```

---

# PART 6 — WebSocket behavior

The existing application uses WebSockets for real-time collaboration.

Do NOT break the current WebSocket behavior.

We need to verify and, if necessary, fix synchronization.

The desired behavior is:

```text
User A
Port 3000
      │
      │ edits Main.java
      ↓
WebSocket
      ↓
Spring Boot
      ↓
WebSocket
      ↓
User B
Port 3001
```

User B must see User A's changes in real time.

---

# PART 7 — VERY IMPORTANT: Test with TWO separate users

After implementation, perform an actual multi-client WebSocket test.

Use:

```text
Browser/Client 1
Port: 3000
Account: User A
```

and:

```text
Browser/Client 2
Port: 3001
Account: User B
```

Both users must enter the SAME room/workspace.

Do not use the same account in both clients.

Use two separate authenticated accounts.

---

# PART 8 — WebSocket test scenario

Perform this exact test:

### Step 1

Start the backend.

Start frontend instance 1 on:

```text
http://localhost:3000
```

Login as:

```text
User A
```

Join the same workspace/room.

---

### Step 2

Start another frontend instance on:

```text
http://localhost:3001
```

Login as:

```text
User B
```

Join the SAME workspace/room.

---

### Step 3

Verify WebSocket connections.

Check browser DevTools → Network → WS.

Confirm both clients establish a WebSocket connection.

Verify:

```text
Client A → connected
Client B → connected
```

Also inspect WebSocket messages.

---

### Step 4

On port 3000:

Open:

```text
Main.java
```

Change:

```java
System.out.println("Hello");
```

to:

```java
System.out.println("Hello World");
```

---

### Step 5

Verify port 3001.

The change made by User A should appear in User B's editor without manually refreshing the page.

Test:

```text
User A types
      ↓
WebSocket message
      ↓
Backend
      ↓
Broadcast to room
      ↓
User B editor updates
```

---

# PART 9 — Test both directions

Do NOT only test:

```text
User A → User B
```

Also test:

```text
User B → User A
```

User B changes:

```java
System.out.println("Changed by User B");
```

and verify User A receives the change.

---

# PART 10 — Test simultaneous editing

Test:

```text
User A typing
+
User B typing
```

at the same time.

Check whether:

* Changes are lost
* Text gets overwritten
* Duplicate content appears
* Cursor jumps unexpectedly
* Editor becomes inconsistent
* WebSocket messages arrive out of order
* One user's changes overwrite another user's changes

If the current system does not implement a true conflict-resolution mechanism, document the limitation rather than pretending it is solved.

---

# PART 11 — WebSocket reconnection testing

Test:

```text
User A connected
User B connected
```

Then disconnect User B's network/WebSocket.

While B is disconnected:

```text
User A edits file
```

Reconnect User B.

Verify what happens.

The system should synchronize B to the latest correct state rather than leaving B with stale content.

If this is not currently supported, identify the missing mechanism and implement a clean resynchronization strategy where appropriate.

---

# PART 12 — Room isolation testing

This is critical.

Create:

```text
Room A
Room B
```

Connect users to different rooms.

Verify:

```text
User A in Room A
      ↓
Edit file
      ↓
Only Room A clients receive the update
```

A user connected to Room B must NOT receive Room A's WebSocket messages.

---

# PART 13 — Authentication and authorization

Verify:

### Normal user

Can:

```text
Edit code
Create pending revision
View their changes
View history
```

Cannot:

```text
Approve
Reject
Change review status directly
```

### Admin

Can:

```text
View pending reviews
View history
View diff
Approve
Reject
```

The backend must enforce these permissions.

Test by directly calling the APIs as a normal user, not just through the UI.

---

# PART 14 — Approval + WebSocket integration

This is extremely important.

There are two different concepts:

### Collaborative editing

```text
User A changes code
      ↓
WebSocket
      ↓
Other collaborators see the working change
```

### Official approval

```text
User submits change
      ↓
PENDING revision
      ↓
Admin reviews
      ↓
APPROVED
      ↓
Official current version changes
```

Do not mix these two concepts.

The WebSocket should synchronize the collaborative editing state according to the existing application's design, while the database must maintain the approved/pending revision state correctly.

When Admin approves a revision, broadcast an appropriate event so connected clients know that the revision has become officially approved.

---

# PART 15 — Prevent duplicate / inconsistent versions

Consider this situation:

```text
User edits
   ↓
Save request
   ↓
Network timeout
   ↓
Frontend retries
```

Make sure the same change is not accidentally stored multiple times.

Inspect the current architecture and implement idempotency/unique revision handling if required.

---

# PART 16 — Database consistency

Verify that:

```text
files.current_version_id
```

always points to the correct approved version.

Example:

```text
Version 10 → APPROVED
Version 11 → PENDING
```

Then:

```text
current_version_id = 10
```

After Admin approves Version 11:

```text
Version 10 → APPROVED
Version 11 → APPROVED

current_version_id = 11
```

If Version 11 is rejected:

```text
Version 10 → APPROVED
Version 11 → REJECTED

current_version_id = 10
```

Never point the current approved version to a rejected or pending revision.

Use transactions where necessary.

---

# PART 17 — Test cases

Perform and document at least these tests.

### Approval

```text
1. User edits file
2. Pending version created
3. Admin sees pending review
4. Admin opens history
5. Admin sees correct diff
6. Admin approves
7. Current version changes
8. Other clients receive approval update
```

### Rejection

```text
1. User edits file
2. Pending version created
3. Admin rejects
4. Rejection reason saved
5. Approved version remains unchanged
6. User sees rejection status
```

### WebSocket

```text
1. User A → User B
2. User B → User A
3. Simultaneous edits
4. Reconnect
5. Room isolation
6. Multiple users
7. WebSocket disconnect
8. WebSocket reconnect
```

### Authorization

```text
1. Normal user attempts approve API → 403
2. Normal user attempts reject API → 403
3. Admin approve → success
4. Admin reject → success
```

### Database

```text
1. Pending revision does not replace approved version
2. Approved revision becomes current
3. Rejected revision never becomes current
4. History remains immutable
5. No duplicate revisions
6. Correct reviewer is recorded
```

---

# PART 18 — Performance / room entry

Also investigate the issue where:

```text
Login
  ↓
Enter room
  ↓
UI takes time before becoming interactive
```

Do NOT assume the cause.

Measure the room-entry flow.

Check whether the frontend is downloading the contents of every file immediately.

Prefer:

```text
Enter room
   ↓
Load room metadata
   ↓
Load file/folder tree
   ↓
Render UI immediately
   ↓
Load file content lazily when a file is opened
```

Do not load hundreds of file contents unnecessarily when the user only needs the file tree.

Measure:

* API response time
* Number of API requests
* Total response payload size
* Database query time
* Frontend processing time
* React rendering time
* WebSocket connection time

Identify the actual bottleneck before changing the architecture.

---

# Final requirements

Before making changes:

1. Inspect the existing codebase.
2. Understand the current file/version/history implementation.
3. Understand the current WebSocket implementation.
4. Understand the JWT/role implementation.
5. Understand the current database schema.
6. Understand how room joining works.
7. Identify existing APIs before creating new ones.

Then implement the feature incrementally.

Do not break:

* Existing authentication
* Existing room functionality
* Existing file/folder management
* Existing WebSocket collaboration
* Existing version history
* Existing editor behavior

At the end, provide:

```text
1. Files modified
2. Database changes
3. API changes
4. WebSocket changes
5. Frontend changes
6. Approval workflow
7. Rejection workflow
8. WebSocket test results for ports 3000 and 3001
9. Room isolation test results
10. Reconnection test results
11. Authorization test results
12. Performance findings for room entry
13. Remaining limitations
```

Do not claim a test passed unless you actually executed it and verified the result.
