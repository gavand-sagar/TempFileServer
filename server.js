const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const Grid = require('gridfs-stream');
const { ObjectId } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB URI
const mongoURI = 'mongodb+srv://admin:123@cluster0.dnyhi.mongodb.net/';

// MongoDB and GridFS setup
let gfs;
mongoose.connect(mongoURI);
const conn = mongoose.connection;
conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads'); // collection for GridFS
});

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// List all files
app.get('/files', async (req, res) => {
    try {
        const files = await gfs.files.find().toArray();
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Retrieve a single file by ID
app.get('/files/:id', async (req, res) => {
    try {
        const file = await gfs.files.findOne({ _id: new ObjectId(req.params.id) });
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.json(file);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload a file
app.post('/upload', upload.single('file'), async (req, res) => {
    const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);
    uploadStream.on('finish', async () => {
        const file = await gfs.files.findOne({ _id: new ObjectId(uploadStream.id) });
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.json(file);
        //res.status(201).json({ fileId: uploadStream.id });
    });
    uploadStream.on('error', (err) => {
        res.status(500).json({ error: err.message });
    });
});

// Delete a file by ID
app.delete('/files/:id', async (req, res) => {
    try {
        const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
        await bucket.delete(new ObjectId(req.params.id));
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/files/:id/download', async (req, res) => {
  try {
      const file = await gfs.files.findOne({ _id: new ObjectId(req.params.id) });
      if (!file) {
          return res.status(404).json({ error: 'File not found' });
      }

      const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
      const downloadStream = bucket.openDownloadStream(new ObjectId(req.params.id));

      res.set({
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.filename}"`,
      });

      downloadStream.pipe(res);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
