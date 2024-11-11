const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors')
const app = express();
app.use(cors())
// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Folder to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Create 'uploads' directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// API to upload an image
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    res.status(200).send({
      message: 'File uploaded successfully',
      filePath: req.file.path,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).send({ message: 'File upload failed', error: error.message });
  }
});

// API to serve images
app.use('/uploads', express.static(uploadDir));

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Logs the error stack trace for debugging
    
    res.status(err.status || 500).json({
      message: err.message || 'An unexpected error occurred.',
      status: err.status || 500
    });
  });
  
// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
