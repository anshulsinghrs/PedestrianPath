const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { processUploadedImage } = require('../middleware/upload');
const ctrl = require('../controllers/visionController');

router.get('/status', ctrl.status);
// Accepts a multipart `image` file, or a JSON body { imageUrl }.
router.post('/analyze', upload.single('image'), processUploadedImage, ctrl.analyze);

module.exports = router;
