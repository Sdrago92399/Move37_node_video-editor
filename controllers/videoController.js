require('dotenv').config();

const fs = require('fs');
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const Video = require("../models/sequelize").models["Video"];
const renderQueue = require("../jobs/renderQueue");

ffmpeg.setFfprobePath(process.env.FFPROBE_LOCATION_ON_DISK);

const isOwner = (userId, video) => {
  // public ownership
  if (!video.userId) return true;

  // private ownership
  if (video.userId == userId) return true;

  // invalid owner
  return false;
}

const parseBool = (bool) => bool=='true';

// Helper to delete a file (log errors but don't throw)
const safeUnlink = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.warn(`Failed to delete file ${filePath}:`, err);
  });
};

const getVideoMetadata = (path) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return reject(err);
      resolve({ duration: metadata.format.duration });
    });
  });
};

exports.uploadVideo = async (req, res) => {
  try {
    const video = req.file;
    const { isPublic: rawIsPublic } = req.body || {};
    const isPublic = (rawIsPublic == null)? 
      true : 
      parseBool(rawIsPublic);

    if (!isPublic && !req.user?.id) {
      return res.status(401).json({ message: "You need to login to make the video private" });
    }

    // Metadata + create placeholder record
    const tempPath = req.file.path;
    const extension = path.extname(req.file.originalname);
    const meta = await getVideoMetadata(tempPath);

    const newVideo = await Video.create({
      name: null,
      path: null,
      size: req.file.size,
      duration: meta.duration,
      userId: req.user?.id,
      isPublic,
      status: 'uploaded',
    });

    // Finalize file naming: use video.id to avoid long names
    const finalName = `${newVideo.id}${extension}`;
    const finalPath = path.join(__dirname, '../uploads', finalName);
    fs.renameSync(tempPath, finalPath);

    newVideo.name = finalName;
    newVideo.path = finalPath;
    await newVideo.save();

    return res.status(201).json({ message: "Video uploaded", video: newVideo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.trimVideo = async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;

  const video = await Video.findByPk(id);

  if (!video) return res.status(404).json({ message: 'Not found' });
  if (!isOwner(req.user?.id, video)) return res.status(403).json({ message: "You are not authorised to perform this action" });
  
  const oldPath = video.path;
  const ext = path.extname(oldPath);
  const trimmedName = `${video.id}_trimmed${ext}`;
  const trimmedPath = path.join(path.dirname(oldPath), trimmedName);

  ffmpeg(oldPath)
    .setStartTime(start)
    .setDuration(end - start)
    .output(trimmedPath)
    .on('end', async () => {
      video.path = trimmedPath;
      video.status = 'trimmed';
      await video.save();

      // Delete old version
      safeUnlink(oldPath);

      res.json({ message: "Trimmed video saved", video });
    })
    .on("error", (err) => res.status(500).json({ error: err.message }))
    .run();
};

exports.addSubtitles = async (req, res) => {
  const { id } = req.params;
  const { subtitles } = req.body;

  const video = await Video.findByPk(id);

  if (!video) return res.status(404).json({ message: "Not found" });
  if (!isOwner(req.user?.id, video))
    return res.status(403).json({ message: "You are not authorised to perform this action" });

  const oldPath = video.path;
  const ext = path.extname(oldPath);
  const subtitledName = `${video.id}_subtitled${ext}`;
  const subtitlePath = path.join(path.dirname(oldPath), subtitledName);

  const drawtext = subtitles.map(({ text, start, end }) => {
    return `drawtext=text='${text}':enable='between(t,${start},${end})':x=(W-tw)/2:y=H-th-10:fontsize=24:fontcolor=white:box=1:boxborderw=5:boxcolor=black`;
  });

  ffmpeg(oldPath)
    .videoFilter(drawtext.join(","))
    .output(subtitlePath)
    .on("end", async () => {
      video.path = subtitlePath;
      video.status = "subtitle_added";
      await video.save();

      // Delete old version
      safeUnlink(oldPath);

      res.json({ message: "Subtitles added", video });
    })
    .on("error", (err) => res.status(500).json({ error: err.message }))
    .run();
};
exports.renderVideo = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await renderQueue.add({ videoId: id, userId: req.user?.id });
    console.log(`Render job ${job.id} added to the queue for videoId: ${id}`);
    res.json({ message: "Render job registered" });
  } catch (error) {
    console.error("Failed to add render job to the queue:", error);
    res.status(500).json({ message: "Failed to start render", error: error.message });
  }
};

exports.downloadVideo = async (req, res) => {
  const { id } = req.params;
  const video = await Video.findByPk(id);

  if (!video) return res.status(404).json({ message: 'Not found' });
  if (video.isPublic === false && video.userId !== req.user?.id) {
     return res.status(403).json({ message: "You are not authorised to perform this action" });
  }

  if (!video.finalPath) return res.status(404).json({ message: "Video not rendered yet." });

  res.download(video.finalPath);
};
