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

    const fileExtension = path.extname(video.originalname); // e.g., ".mp4"
    const correctFilePath = path.join(__dirname, "../uploads", `${video.filename}${fileExtension}`);

    fs.rename(video.path, correctFilePath, (err) => {
      if (err) throw new Error("Failed to rename the uploaded file.");
    });

    const videoMeta = await getVideoMetadata(correctFilePath);

    const newVideo = await Video.create({
      name: video.originalname,
      path: correctFilePath,
      size: video.size,
      userId: req.user?.id,
      duration: videoMeta.duration,
      isPublic,
    });

    return res.status(201).json({ message: "Video uploaded", video: newVideo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.trimVideo = async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;

  const video = await Video.findByPk(id);

  if (!isOwner(req.user?.id, video)) return res.status(403).json({ message: "You are not authorised to perform this action" });
  
  const trimmedPath = video.path.replace(/(\.\w+)$/, `_trimmed$1`);

  ffmpeg(video.path)
    .setStartTime(start)
    .setDuration(end - start)
    .output(trimmedPath)
    .on("end", async () => {
      video.path = trimmedPath;
      video.status = "trimmed";
      await video.save();
      res.json({ message: "Trimmed video saved", video });
    })
    .on("error", (err) => res.status(500).json({ error: err.message }))
    .run();
};

exports.addSubtitles = async (req, res) => {
  const { id } = req.params;
  const { text, start, end } = req.body;

  const video = await Video.findByPk(id);
  
  if (!isOwner(req.user?.id, video)) return res.status(403).json({ message: "You are not authorised to perform this action" });
  
  const subtitlePath = video.path.replace(/(\.\w+)$/, `_subtitled$1`);

  const drawText = `drawtext=text='${text}':enable='between(t,${start},${end})':x=(W-w)/2:y=H-th-10:fontsize=24:fontcolor=white:box=1:boxcolor=black`;

  ffmpeg(video.path)
    .videoFilter(drawText)
    .output(subtitlePath)
    .on("end", async () => {
      video.path = subtitlePath;
      video.status = "subtitle_added";
      await video.save();
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

  if (video.isPublic === false && video.userId !== req.user?.id) {
     return res.status(403).json({ message: "You are not authorised to perform this action" });
  }

  if (!video.finalPath) return res.status(404).json({ message: "Video not rendered yet." });

  res.download(video.finalPath);
};
