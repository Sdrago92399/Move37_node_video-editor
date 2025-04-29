const express = require('express');
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const {
	uploadVideo,
	trimVideo,
	addSubtitles,
	renderVideo,
	downloadVideo
} = require("../controllers/videoController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/upload", verifyToken, upload.single("video"), uploadVideo);
router.post("/:id/trim", verifyToken, trimVideo);
router.post("/:id/subtitles", verifyToken, addSubtitles);
router.post("/:id/render", verifyToken, renderVideo);
router.get("/:id/download", verifyToken, downloadVideo);

module.exports = router;
