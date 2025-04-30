const express = require('express');
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const {
	uploadVideo,
	trimVideo,
	addSubtitles,
	undo,
	redo,
	refresh,
	renderVideo,
	downloadVideo
} = require("../controllers/videoController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/upload", verifyToken, upload.single("video"), uploadVideo);
router.post("/:projectId/trim", verifyToken, trimVideo);
router.post("/:projectId/subtitles", verifyToken, addSubtitles);
router.post('/:projectId/undo', verifyToken, undo);
router.post('/:projectId/redo', verifyToken, redo);
router.get('/:projectId/refresh', verifyToken, refresh);
router.post('/:projectId/render', verifyToken, renderVideo);
router.get("/:projectId/download", verifyToken, downloadVideo);

module.exports = router;
