require('dotenv').config();

const fs       = require('fs');
const Queue    = require("bull");
const path     = require('path');
const ffmpeg   = require('fluent-ffmpeg');
const { Op }   = require('sequelize');
const Video    = require('../models/sequelize').models.Video;

const renderQueue = new Queue("render", {
  redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null
    },
});

// helper to delete files without throwing
const safeUnlink = fp => fs.unlink(fp, err => err && console.warn(`unlink failed: ${fp}`, err));

const sleep = ms => new Promise(res => setTimeout(res, ms));

ffmpeg.setFfprobePath(process.env.FFPROBE_LOCATION_ON_DISK);

renderQueue.process(async job => {
  const { projectId, userId } = job.data;

  const video = await Video.findOne({
    where: { projectId, isCurrent: true }
  });

  if (!video) {
    console.warn(`Render job ${job.id}: no current version for project ${projectId}`);
    return Promise.reject(new Error('Video not found'));
  }

  if (!video.isPublic && video.userId !== userId) {
    const err = new Error("Access denied to private video");
    console.error(`Render job ${job.id}:`, err.message);
    return Promise.reject(err);
  }

  const ext       = path.extname(video.path);
  const finalName = `${video.projectId}_final${ext}`;
  const finalPath = path.join(path.dirname(video.path), finalName);

  // simulate any pre-processing delay
  console.log(`Render job ${job.id}: waiting before FFmpeg…`);
  await sleep(5000);

  return new Promise((resolve, reject) => {
    ffmpeg(video.path)
      .output(finalPath)
      .on('start', cmd => {
        console.log(`Render job ${job.id} FFmpeg start:`, cmd);
      })
      .on('end', async () => {
        try {
          // update this version to be final
          video.finalPath = finalPath;
          video.status    = 'rendered';
          await video.save();

          // remove all other versions in this project
          const others = await Video.findAll({
            where: {
              projectId,
              id: { [Op.ne]: video.id }
            }
          });
          for (const v of others) {
            safeUnlink(v.path);
            await v.destroy();
          }

          console.log(`Render job ${job.id}: completed and pruned old versions.`);
          resolve();
        } catch (dbErr) {
          console.error(`Render job ${job.id} DB update failed:`, dbErr);
          reject(dbErr);
        }
      })
      .on('error', err => {
        console.error(`Render job ${job.id} FFmpeg error:`, err);
        reject(err);
      })
      .run();
  });
});

module.exports = renderQueue;
