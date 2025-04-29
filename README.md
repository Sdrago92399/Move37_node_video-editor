# Video Processing Backend

This repository contains a Node.js backend application for video processing as part of an assignment for Move37. It supports features like video upload, trimming, rendering, and caching using Redis which were required by the assignment as well as some additional fully optional features that I thought could be useful. The backend is built with tools like Sequelize for database management, Bull for job queues, and FFmpeg for video processing.

---

## Features

### Required

- **Upload and manage videos**
- **Trim video clips** and save them with new file paths
- **Render videos asynchronously** using a background job queue (Bull + Redis)
- **Caching and queue management** with Redis

### Optional (toggleable)

- **User authentication** for secure and private video access
- **Api Rate Limiting** to prevent server lag and malicious attacks.
- **Acess Logging** a complete log map of ip-addresses accessing certain api routes.
- **Role Middleware** - unused but can be integrated on the fly to restrict api route access.

---

## Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (version 16+ recommended)  
- **Redis** (local or cloud-hosted)  
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

Create a `.env` file in the root directory and configure the following:

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
REDIS_PASSWORD=your_redis_password   # omit if none

# JWT
JWT_SECRET=your_jwt_secret
```

### 4. Start Redis

- **Locally**:

  ```bash
  redis-server
  ```

- **With Docker**:

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


### 7. Run the Application

```bash
npm start
```

> The server will run on `http://localhost:3000` by default.

---

## API Endpoints

### 1. **Upload Video**

```http
POST /api/videos/upload
Content-Type: multipart/form-data

Form Data:
- video: (File) Video to upload.
- isPublic: (Optional) (String) "true" or "false", "true" by default. *Only works if logged in
```

### 2. **Trim Video**

```http
POST /api/videos/:id/trim
Content-Type: application/json
authorization: (required for private videos) <token without "Bearer">

Body:
{
  "start": 10,
  "end": 20
}
```

### 3. **Add Subtitles**

```http
POST /api/videos/:id/subtitles
Content-Type: application/json
authorization: (required for private videos) <token without "Bearer">

Body:
{
  "text": "Hello World",
  "start": 5,
  "end": 10
}
```

### 4. **Render Video**

```http
POST /api/videos/:id/render
Content-Type: application/json
authorization: (required for private videos) <token without "Bearer">
```

> Triggers background rendering via Bull Queue.

### 5. **Download Final Video**

```http
GET /api/videos/:id/download
authorization: (required for private videos) <token without "Bearer">
```

---

## Debugging Tips

- **Verify Redis**:  
  ```bash
  redis-cli ping
  ```
- **Confirm FFmpeg**:  
  ```bash
  ffmpeg -version
  ```

---

## Contributing

private for now

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
