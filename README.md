# Video Processing Backend

This repository contains a Node.js backend application for video processing as part of an assignment for Move37. It supports features like video upload, trimming, rendering, undo/redo, versioning, and caching using Redis. The backend is built with tools like Sequelize for database management, Bull for job queues, and FFmpeg for video processing.

---

## Features

### Core

- **Upload and manage videos** (per-project UUID, versioned)
- **Trim video clips** and save as a new version
- **Add subtitles** with FFmpeg filters, saved as a new version
- **Render videos asynchronously** using a background job queue (Bull + Redis)
- **Prune old versions** on render, keeping only the final output

### Optional (toggleable)

- **User authentication** for secure and private video access  
- **Undo/Redo** edits via version chain (previous/next links)
- **Refresh** to fetch the current version at any time
- **API Rate Limiting** to prevent abuse  
- **Access Logging** of IP‐addresses and route usage  
- **Role Middleware** for route-level permissions  

---

## Prerequisites

- **Node.js** (v16+ recommended)  
- **Redis** (local or cloud)  
- **PostgreSQL**  
- **FFmpeg**  

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=3000

# Database (PostgreSQL)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=video_processing
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # omit if none

# JWT
JWT_SECRET=your_jwt_secret

# FFmpeg probe location
FFPROBE_LOCATION_ON_DISK=/usr/local/bin/ffprobe
```


### 4. Start Redis

```bash
redis-server
```

_or with Docker_

```bash
docker run --name redis-server -p 6379:6379 -d redis
```


### 5. FFmpeg Installation

- **macOS**:  
  ```bash
  brew install ffmpeg
  ```

- **Linux**:  
  ```bash
  sudo apt update
  sudo apt install ffmpeg
  ```

- **Windows**:  
  ```bash
  winget install "FFmpeg (Essentials Build)
  ```
Then locate ffprobe using appropriate command, in windows its:
  ```bash
  where ffprobe
  ```
put that location in env file



### 6. Run the Application

```bash
npm start
```

> The server listens on `http://localhost:3000`.

---

## API Endpoints

### 1. Upload Video

```http
POST /api/videos/upload
Content-Type: multipart/form-data

Form Data:
- video: (File) Video to upload.
- isPublic: (String) (optional) "true" or "false" (default: true, login required for "false").
```

_Response_  
```json
{ "message": "Video uploaded", "video": { /* version 1 record */ } }
```

### 2. Trim Video

```http
POST /api/videos/:projectId/trim
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)

Body:
{ "start": 10, "end": 20 }
```

_Response_  
```json
{ "message": "Trimmed", "video": { /* new version record */ } }
```

### 3. Add Subtitles

```http
POST /api/videos/:projectId/subtitles
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)

Body:
{
  "subtitles": [
    { "text": "Hello Move37!", "start": 0, "end": 3 },
    { "text": "Welcome to the video", "start": 4, "end": 6 },
    { "text": "Enjoy watching!", "start": 7, "end": 10 }
  ]
}
```

_Response_  
```json
{ "message": "Subtitled", "video": { /* new version record */ } }
```

### 4. Undo Last Action

```http
POST /api/videos/:projectId/undo
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)
```

_Response_  
```json
{ "message": "Undone", "video": { /* previous version record */ } }
```

### 5. Redo Last Undone Action

```http
POST /api/videos/:projectId/redo
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)
```

_Response_  
```json
{ "message": "Redone", "video": { /* next version record */ } }
```

### 6. Refresh Current Version

```http
GET /api/videos/:projectId/refresh
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)
```

_Response_  
```json
{ "message": "Refreshed", "video": { /* current version record */ } }
```

### 7. Render Final Video

```http
POST /api/videos/:projectId/render
Content-Type: application/json
authorization: <token without "Bearer"> (required for private video)
```

_Response_  
```json
{ "message": "Render queued", "jobId": "<bull-job-id>" }
```

### 8. Download Final Video

```http
GET /api/videos/:projectId/download
authorization: <token without "Bearer"> (required for private video)
```

> Streams the final rendered file.

---

## Debugging Tips

- **Redis**:  
  ```bash
  redis-cli ping
  ```
- **FFmpeg**:  
  ```bash
  ffmpeg -version

---

## Contributing

Private for now.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE).