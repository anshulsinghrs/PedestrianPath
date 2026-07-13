const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// `sharp` does the heavy lifting for images: re-encoding (which strips
// EXIF) and generating a thumbnail in a single pass.
let sharp;
try {
  sharp = require('sharp');
} catch (_err) {
  sharp = null;
}

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// v4.0 — short video clips ("Optional video upload" in the workflow spec).
// Kept conservative: <= MAX_VIDEO_FILE_SIZE_MB (default 25 MB), common
// container types only.
const ALLOWED_VIDEOS = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
];

const ALLOWED_MEDIA = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_IMAGES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, WEBP and GIF images are allowed'), false);
};

const mediaFilter = (_req, file, cb) => {
  if (ALLOWED_MEDIA.includes(file.mimetype)) return cb(null, true);
  cb(
    new Error(
      'Only common image (JPEG/PNG/WEBP/GIF) or video (MP4/MOV/WEBM/MKV) files are allowed'
    ),
    false
  );
};

const imageMaxMb = Number(process.env.MAX_FILE_SIZE_MB) || 5;
const videoMaxMb = Number(process.env.MAX_VIDEO_FILE_SIZE_MB) || 25;
const mediaMaxMb = Math.max(imageMaxMb, videoMaxMb);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: imageMaxMb * 1024 * 1024 },
});

// v4.0 — combined image + optional video upload. Accepts up to one image
// (field `image`) and one short video (field `video`). Module 3 must
// NEVER use this middleware; Module 3 routes deliberately skip multer.
const mediaUpload = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: mediaMaxMb * 1024 * 1024 },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

/**
 * Post-upload middleware. Two responsibilities:
 *   1. For images, re-encode to strip EXIF (including GPS) and produce
 *      a 300 px thumbnail. Sets `req.fileThumbnail`.
 *   2. Normalise the multer `req.file` / `req.files` shape so the
 *      existing controllers can keep using `req.file` for images and
 *      pick up `req.videoFile` for videos.
 *
 * If `sharp` is not installed the image step is skipped with a warning.
 */
async function processUploadedImage(req, _res, next) {
  // Single-field uploads (multer.single('image')) populate `req.file`.
  // Multi-field uploads (mediaUpload) populate `req.files` instead.
  if (req.files) {
    const imgList = req.files.image || [];
    const vidList = req.files.video || [];
    if (imgList.length) req.file = imgList[0];
    if (vidList.length) req.videoFile = vidList[0];
  }

  // Video: nothing to post-process beyond filename normalisation.
  if (req.videoFile) {
    req.videoUrl = `/uploads/${req.videoFile.filename}`;
  }

  if (!req.file) return next();
  if (req.file.mimetype === 'image/gif') return next();

  if (!sharp) {
    // eslint-disable-next-line no-console
    console.warn(
      '[upload] sharp not installed; EXIF will NOT be stripped from uploads. ' +
        'Install sharp in production deployments.'
    );
    return next();
  }

  try {
    const fullPath = req.file.path;
    const ext = path.extname(req.file.filename).toLowerCase();
    const base = path.basename(req.file.filename, ext);
    const thumbName = `${base}-thumb.jpg`;
    const thumbPath = path.join(uploadDir, thumbName);

    const buffer = fs.readFileSync(fullPath);

    const reencoded = await sharp(buffer).rotate().toBuffer();
    fs.writeFileSync(fullPath, reencoded);

    await sharp(buffer)
      .rotate()
      .resize({ width: 300, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    req.fileThumbnail = `/uploads/${thumbName}`;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[upload] image post-processing failed:', err.message);
    next();
  }
}

module.exports = upload;
module.exports.processUploadedImage = processUploadedImage;
module.exports.mediaUpload = mediaUpload;
module.exports.ALLOWED_IMAGES = ALLOWED_IMAGES;
module.exports.ALLOWED_VIDEOS = ALLOWED_VIDEOS;
