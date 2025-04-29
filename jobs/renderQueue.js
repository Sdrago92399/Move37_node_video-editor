require('dotenv').config();

const Queue = require("bull");
const ffmpeg = require("fluent-ffmpeg");
const Video = require("../models/sequelize").models["Video"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const renderQueue = new Queue("render", {
  redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null
    },
});

renderQueue.process(async (job) => {
  try {

    const { videoId, userId } = job.data;
    const video = await Video.findByPk(videoId);

    if (!video) {
      console.warn(`Video with ID ${videoId} not found. Render job interrupted`);
    }

    if (!video.isPublic && video.userId !== userId) {
      throw new Error("This is a private video and you don't have access.");
    }

    const finalPath = video.path.replace(/(\.\w+)$/, `_final$1`);
    
    console.log(`Simulating 5sec processing time for job ${job.id}...`);
    await sleep(5000);

    return new Promise((resolve, reject) => {
      ffmpeg(video.path)
        .output(finalPath)
        .on("start", (commandLine) => {
          console.log(`FFmpeg process started for job ${job.id}`);
        })
        .on("end", async () => {
          console.log(`FFmpeg processing completed for videoId ${videoId}. Updating database...`);
          try {
            video.finalPath = finalPath;
            video.status = "rendered";
            await video.save();
            resolve();
          } catch (err) {
            console.error(`Failed to update database for videoId ${videoId}:`, err);
            reject(err);
          }
        })
        .on("error", (err) => {
          console.error(`FFmpeg error for job ${job.id}:`, err);
          reject(err);
        })
        .run();
    });
  } catch (err) {
    console.error(`Error processing job ${job.id}:`, err);
    throw err; // Re-throw the error to handle it upstream if needed
  }
});


module.exports = renderQueue;
