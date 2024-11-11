const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Set up MongoDB connection
mongoose.connect('mongodb+srv://admin:123@cluster0.dnyhi.mongodb.net')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error: ', err));

// Define a Mongoose schema and model for file metadata
const fileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  createdTime: { type: String, required: true }
});

const File = mongoose.model('File', fileSchema);

const app = express();
const port = process.env.PORT || 3000;

// Set up file storage using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');  // save files to 'uploads' folder
  },
  filename: (req, file, cb) => {
    const fileId = Date.now().toString();  // Using current timestamp as file ID
    const extension = path.extname(file.originalname);  // Get file extension
    cb(null, `${fileId}${extension}`);
  }
});

const upload = multer({ storage });

// Ensure the uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// API endpoint to upload files
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileId = Date.now().toString();
    const createdTime = new Date().toISOString();
    const newFile = new File({
      fileId,
      filename: req.file.filename,
      createdTime
    });

    await newFile.save();

    res.status(200).json({ fileId, createdTime });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading file', error: err });
  }
});

// API endpoint to retrieve file details
app.get('/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ fileId });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({
      fileId: file.fileId,
      filename: file.filename,
      createdTime: file.createdTime,
      fileUrl: `/uploads/${file.filename}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err });
  }
});

// API endpoint to list all files
app.get('/files', async (req, res) => {
  try {
    const files = await File.find();
    const filesList = files.map(file => ({
      fileId: file.fileId,
      filename: file.filename,
      createdTime: file.createdTime,
      fileUrl: `/uploads/${file.filename}`
    }));

    res.json(filesList);
  } catch (err) {
    res.status(500).json({ message: 'Error listing files', error: err });
  }
});

// API endpoint to delete a file by ID
app.delete('/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ fileId });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete the file from the filesystem
    fs.unlink(path.join('./uploads', file.filename), async (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete file from filesystem' });
      }

      // Delete the file metadata from MongoDB
      await File.deleteOne({ fileId });

      res.status(200).json({ message: 'File deleted successfully' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting file', error: err });
  }
});

// Serve uploaded files publicly
app.use('/uploads', express.static('uploads'));

// Start the server
app.listen(port, () => {
  console.log(`File server is running at http://localhost:${port}`);
});
