require('dotenv').config();
const fs       = require('fs');
const ffmpeg   = require('fluent-ffmpeg');
const path     = require('path');
const { Op }   = require('sequelize');
const Video    = require('../models/sequelize').models.Video;
const renderQueue = require('../jobs/renderQueue');

ffmpeg.setFfprobePath(process.env.FFPROBE_LOCATION_ON_DISK);

// Helpers
const isOwner    = (userId, v) => !v.userId || v.userId === userId;
const safeUnlink = fp => fs.unlink(fp, err => err && console.warn(`unlink failed: ${fp}`, err));  // fs.unlink() callback form :contentReference[oaicite:2]{index=2}
const getMeta    = fp => new Promise((res, rej) =>
  ffmpeg.ffprobe(fp, (err, md) => err ? rej(err) : res({ duration: md.format.duration }))
);

// Remove all downstream versions
async function pruneFuture(v) {
  if (!v.nextVersionId) return;
  const nxt = await Video.findByPk(v.nextVersionId);
  if (nxt) {
    await pruneFuture(nxt);
    safeUnlink(nxt.path);
    await nxt.destroy();
  }
  await v.update({ nextVersionId: null });
}

// Create a new version record
async function createVersion(oldV, tmpPath, newStatus) {
  const nextV = await Video.create({
    projectId: oldV.projectId,
    version:   oldV.version + 1,
    size:      oldV.size,
    duration:  oldV.duration,
    userId:    oldV.userId,
    isPublic:  oldV.isPublic,
    status:    newStatus,
    previousVersionId: oldV.id,
    nextVersionId:     null,
    isCurrent: true,
  });

  // Rename file using nextV.id (unique) and version
  const ext      = path.extname(tmpPath);
  const filename = `${nextV.id}_v${nextV.version}${ext}`;
  const final    = path.join(path.dirname(oldV.path), filename);
  fs.renameSync(tmpPath, final);
  await nextV.update({ name: filename, path: final });

  // Link the chain
  await oldV.update({ isCurrent: false, nextVersionId: nextV.id });
  return nextV;
}


// Upload
exports.uploadVideo = async (req, res) => {
  try {
    const isPublic = req.body.isPublic != null
      ? req.body.isPublic === 'true'
      : true;
    if (!isPublic && !req.user?.id)
      return res.status(401).json({ message: 'Login required', video: null });

    const tmp = req.file.path;
    const ext = path.extname(req.file.originalname);
    const meta = await getMeta(tmp);

    // create initial record (version 1)
    const video = await Video.create({
      // id auto-generated (UUID)
      version: 1,
      size:    req.file.size,
      duration: meta.duration,
      userId:  req.user?.id,
      isPublic,
      status:  'uploaded',
      previousVersionId: null,
      nextVersionId:     null,
      isCurrent: true,
    });

    // finalize file
    const filename = `${video.id}_v1${ext}`;
    const finalPath = path.join(__dirname, '../uploads', filename);
    fs.renameSync(tmp, finalPath);

    await video.update({ name: filename, path: finalPath });
    res.status(201).json({ message: 'Video uploaded', video });
  } catch (err) {
    res.status(500).json({ message: err.message, video: null });
  }
};

// Trim
exports.trimVideo = async (req, res) => {
  const { projectId } = req.params;
  const { start, end } = req.body;

  const cur = await Video.findOne({
    where: {
      projectId,
      isCurrent: true
    }
  });
  if (!cur || !isOwner(req.user?.id, cur))
    return res.status(403).json({ message: 'Unauthorized', video: null });

  await pruneFuture(cur);
  const tmp = `${cur.path}.tmp_trim${path.extname(cur.path)}`;
  ffmpeg(cur.path)
    .setStartTime(start)
    .setDuration(end - start)
    .output(tmp)
    .on('end', async () => {
      const nextV = await createVersion(cur, tmp, 'trimmed');
      res.json({ message: 'Trimmed', video: nextV });
    })
    .on('error', e => res.status(500).json({ message: e.message, video: null }))
    .run();
};

// Add Subtitles
exports.addSubtitles = async (req, res) => {
  const { projectId } = req.params;
  const { subtitles } = req.body;

  const cur = await Video.findOne({
    where: { projectId, isCurrent: true }
  });
  if (!cur || !isOwner(req.user?.id, cur))
    return res.status(403).json({ message: 'Unauthorized', video: null });

  await pruneFuture(cur);
  const tmp = `${cur.path}.tmp_sub${path.extname(cur.path)}`;
  const filter = subtitles.map(({ text, start, end }) =>
    `drawtext=text='${text}':enable='between(t,${start},${end})':x=(W-tw)/2:y=H-th-10:fontsize=24:fontcolor=white:box=1:boxborderw=5:boxcolor=black`
  ).join(',');
  ffmpeg(cur.path)
    .videoFilter(filter)
    .output(tmp)
    .on('end', async () => {
      const nextV = await createVersion(cur, tmp, 'subtitle_added');
      res.json({ message: 'Subtitled', video: nextV });
    })
    .on('error', e => res.status(500).json({ message: e.message, video: null }))
    .run();
};

// Undo
exports.undo = async (req, res) => {
  const { projectId } = req.params;
  const cur = await Video.findOne({
    where: { projectId, isCurrent: true }
  });

  if (!isOwner(req.user?.id, cur))
    return res.status(403).json({ message: 'Unauthorized', video: null });

  if (!cur || !cur.previousVersionId)
    return res.status(400).json({ message: 'Cannot undo', video: cur });

  const prev = await Video.findByPk(cur.previousVersionId);
  await cur.update({ isCurrent: false });
  await prev.update({ isCurrent: true });
  res.json({ message: 'Undone', video: prev });
};

// Redo
exports.redo = async (req, res) => {
  const { projectId } = req.params;
  const cur = await Video.findOne({
    where: { projectId, isCurrent: true }
  });

  if (!isOwner(req.user?.id, cur))
    return res.status(403).json({ message: 'Unauthorized', video: null });

  if (!cur || !cur.nextVersionId)
    return res.status(400).json({ message: 'Cannot redo', video: cur });

  const nxt = await Video.findByPk(cur.nextVersionId);
  await cur.update({ isCurrent: false });
  await nxt.update({ isCurrent: true });
  res.json({ message: 'Redone', video: nxt });
};

// Refresh
exports.refresh = async (req, res) => {
  const { projectId } = req.params;
  const cur = await Video.findOne({
    where: { projectId, isCurrent: true }
  });

  if (!isOwner(req.user?.id, cur))
    return res.status(403).json({ message: 'Unauthorized', video: null });

  res.json({ message: 'Refreshed', video: cur });
};

// Render
exports.renderVideo = async (req, res) => {
  const { projectId } = req.params;
  const job = await renderQueue.add({ projectId, userId: req.user?.id });
  res.json({ message: 'Render queued', jobId: job.id, video: null });
};

// Download
exports.downloadVideo = async (req, res) => {
  const { projectId } = req.params;
  const cur = await Video.findOne({ where: { projectId, isCurrent: true } });
  if (!cur) return res.status(404).json({ message: 'Not found', video: null });
  if (cur.isPublic === false && cur.userId !== req.user?.id)
    return res.status(403).json({ message: 'Unauthorized', video: null });

  // streams the file
  res.download(cur.path);
};
