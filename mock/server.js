// Simple mock API server for YourApp
// Usage: cd mock && npm install && npm start

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,9)}${ext}`);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadDir));

// In-memory data store
const profile = { name: 'user', avatar: '' };
const messages = [];

const items = [
  {
    id: '1',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    type: 'video',
    title: '示例视频 1',
    author: { id: 'a1', name: 'Alice', avatar: 'https://i.pravatar.cc/80?img=1' },
    likes: 12,
    liked: false,
    comments: [ { id: 'c1', author: 'Bob', text: '好棒！' } ],
    location: 'Beijing'
  },
  {
    id: '2',
    url: 'https://via.placeholder.com/800x1200.png?text=Image+1',
    type: 'image',
    title: '示例图片 1',
    author: { id: 'a2', name: 'Charlie', avatar: 'https://i.pravatar.cc/80?img=3' },
    likes: 5,
    liked: false,
    comments: [],
    location: 'Shanghai'
  },
  {
    id: '3',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    type: 'video',
    title: '示例视频 2',
    author: { id: 'a3', name: 'David', avatar: 'https://i.pravatar.cc/80?img=5' },
    likes: 3,
    liked: false,
    comments: [],
    location: 'Beijing'
  }
];

// Feed: supports cursor (index), filter=all|local, type=video|image
app.get('/api/feed', (req, res) => {
  const { cursor, filter = 'all', type } = req.query;
  let list = items.slice();
  if (filter === 'local') {
    // For mock, assume local is Beijing
    list = list.filter(i => i.location === 'Beijing');
  }
  if (type) {
    list = list.filter(i => i.type === type);
  }
  const start = cursor ? parseInt(cursor, 10) : 0;
  const pageSize = 10;
  const slice = list.slice(start, start + pageSize);
  const nextCursor = start + slice.length < list.length ? String(start + slice.length) : null;
  res.json({ items: slice, nextCursor });
});

// Search: q in title or author
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ items: [] });
  const found = items.filter(i => (i.title || '').toLowerCase().includes(q) || (i.author?.name || '').toLowerCase().includes(q));
  res.json({ items: found });
});

// Like toggle
app.post('/api/item/:id/like', (req, res) => {
  const id = req.params.id;
  const it = items.find(x => x.id === id);
  if (!it) return res.status(404).json({ error: 'not found' });
  it.liked = !it.liked;
  it.likes = Math.max(0, it.likes + (it.liked ? 1 : -1));
  res.json({ id: it.id, likes: it.likes, liked: it.liked });
});

// Comment
app.post('/api/item/:id/comment', (req, res) => {
  const id = req.params.id;
  const { text } = req.body || {};
  const it = items.find(x => x.id === id);
  if (!it) return res.status(404).json({ error: 'not found' });
  if (!text) return res.status(400).json({ error: 'text required' });
  const comment = { id: uuidv4(), author: profile.name || 'user', text };
  it.comments = it.comments || [];
  it.comments.push(comment);
  res.json({ id: it.id, comments: it.comments });
});

// Profile
app.get('/api/profile', (req, res) => {
  res.json(profile);
});

app.put('/api/profile', upload.single('avatar'), (req, res) => {
  // Support multipart (avatar file) or JSON {name}
  if (req.file) {
    profile.avatar = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  }
  if (req.body.name) {
    profile.name = req.body.name;
  }
  // If JSON body
  try {
    if (req.is('application/json') && req.body && req.body.name) {
      profile.name = req.body.name;
    }
  } catch (e) {}
  res.json(profile);
});

// Upload new work
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const id = uuidv4();
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const type = (req.file.mimetype || '').startsWith('image') ? 'image' : 'video';
  const title = req.body.title || req.file.originalname || '新作品';
  const item = {
    id,
    url,
    type,
    title,
    author: { id: 'me', name: profile.name, avatar: profile.avatar },
    likes: 0,
    liked: false,
    comments: [],
    location: 'Beijing'
  };
  items.unshift(item);
  res.json({ success: true, item });
});

// Favorites / Works
app.get('/api/profile/favorites', (req, res) => {
  // For mock, favorites = items with likes > 5
  const fav = items.filter(i => i.likes > 5);
  res.json({ items: fav });
});
app.get('/api/profile/works', (req, res) => {
  // For mock, works authored by 'me' or profile.name
  const w = items.filter(i => i.author?.name === profile.name);
  res.json({ items: w });
});

// Messages
app.get('/api/messages', (req, res) => {
  res.json({ items: messages });
});
app.post('/api/messages', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const m = { id: uuidv4(), from: profile.name || 'user', text, created_at: new Date().toISOString() };
  messages.push(m);
  res.json({ success: true, message: m });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Mock API server running at http://localhost:${port}`);
});
