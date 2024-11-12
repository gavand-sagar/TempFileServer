const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const Grid = require('gridfs-stream');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json())
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key';
const mongoURI = 'mongodb+srv://admin:123@cluster0.dnyhi.mongodb.net/';
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


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

app.post('/create-user', async (req, res) => {
    const { username, password } = req.body;
    if(!(username && password)){
        return res.status(400).json({ message: 'Invalid Request' });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User created successfully' });
});

// API to generate a token for a user
app.post('/generate-token', async (req, res) => {
    const { username, password } = req.body;
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid password' });
    }
    // Generate token
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

// Middleware to validate token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ message: 'Access denied, token missing!' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
}

app.get('/validate-token', authenticateToken, (req, res) => {
    res.json({ valid: true })
})


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


app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
