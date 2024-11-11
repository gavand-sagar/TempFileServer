const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// In-memory storage for file metadata
const files = [];

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Folder to store uploaded files
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Create 'uploads' directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// API to upload a file
app.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('No file uploaded.');
      error.status = 400;
      throw error;
    }

    const fileId = uuidv4();
    const fileInfo = {
      id: fileId,
      filename: req.file.filename,
      uploadTime: new Date().toISOString()
    };

    files.push(fileInfo);

    res.status(200).json({
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    next(error);
  }
});

// API to get metadata for all uploaded files
app.get('/files', (req, res, next) => {
  res.status(200).json({
    message: 'List of uploaded files',
    files: files
  });
});

// API to get a single file by its ID
app.get('/files/:id', (req, res, next) => {
  const file = files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const filePath = path.join(uploadDir, file.filename);
  res.sendFile(filePath, err => {
    if (err) {
      next(err);
    }
  });
});

// API to delete a file by its ID
app.delete('/files/:id', (req, res, next) => {
  const fileIndex = files.findIndex(f => f.id === req.params.id);

  if (fileIndex === -1) {
    return res.status(404).json({ message: 'File not found' });
  }

  const file = files[fileIndex];
  const filePath = path.join(uploadDir, file.filename);

  fs.unlink(filePath, err => {
    if (err) {
      return next(err);
    }

    files.splice(fileIndex, 1);
    res.status(200).json({ message: 'File deleted successfully' });
  });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred.',
    status: err.status || 500
  });
});

// Read port from environment variable or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
