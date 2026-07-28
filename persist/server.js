// Persistent mock API server for YourApp (Express + SQLite)
// Usage: cd persist && npm install && npm start

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const app = express();
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// Initialize DB
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      url TEXT,
      type TEXT,
      title TEXT,
      author_id TEXT,
      author_name TEXT,
      author_avatar TEXT,
      likes INTEGER DEFAULT 0,
      liked INTEGER DEFAULT 0,
      location TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      author TEXT,
      text TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_user TEXT,
      text TEXT,
      created_at TEXT
    );
  `);

  // ensure one profile row
  const prof = db.prepare('SELECT name FROM profile WHERE id = 1').get();
  if (!prof) {
    db.prepare('INSERT INTO profile (id, name, avatar) VALUES (1, ?, ?)').run('user', '');
  }

  // seed items if empty
  const count = db.prepare('SELECT COUNT(1) as c FROM items').get().c;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO items (id, url, type, title, author_id, author_name, author_avatar, likes, liked, location, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const now = new Date().toISOString();
    insert.run('1', 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', 'video', '示例视频 1', 'a1', 'Alice', 'https://i.pravatar.cc/80?img=1', 12, 0, 'Beijing', now);
    insert.run('2', 'https://via.placeholder.com/800x1200.png?text=Image+1', 'image', '示例图片 1', 'a2', 'Charlie', 'https://i.pravatar.cc/80?img=3', 5, 0, 'Shanghai', now);
    insert.run('3', 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', 'video', '示例视频 2', 'a3', 'David', 'https://i.pravatar.cc/80?img=5', 3, 0, 'Beijing', now);
  }
}

initDb();

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

// helpers
function itemRowToObj(row) {
  return {
    id: row.id,
    url: row.url,
    type: row.type,
    title: row.title,
    author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
    likes: row.likes,
    liked: !!row.liked,
    comments: [],
    location: row.location,
    created_at: row.created_at
  };
}

// GET /api/feed?cursor=&filter=all|local&type=video|image
app.get('/api/feed', (req, res) => {
  const { cursor, filter = 'all', type } = req.query;
  let where = [];
  let params = [];
  if (filter === 'local') {
    // For demo, local is Beijing
    where.push('location = ?'); params.push('Beijing');
  }
  if (type) { where.push('type = ?'); params.push(type); }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const start = cursor ? parseInt(cursor, 10) : 0;
  const pageSize = 10;
  const rows = db.prepare(`SELECT * FROM items ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, start);
  const items = rows.map(itemRowToObj);
  // attach comments
  const commentStmt = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC');
  items.forEach(it => { it.comments = commentStmt.all(it.id); });
  const total = db.prepare(`SELECT COUNT(1) as c FROM items ${whereSql}`).get(...params).c;
  const nextCursor = start + items.length < total ? String(start + items.length) : null;
  res.json({ items, nextCursor });
});

// GET /api/search?q=
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ items: [] });
  const rows = db.prepare(`SELECT * FROM items WHERE LOWER(title) LIKE ? OR LOWER(author_name) LIKE ? ORDER BY created_at DESC LIMIT 50`).all(`%${q}%`, `%${q}%`);
  const items = rows.map(itemRowToObj);
  const commentStmt = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC');
  items.forEach(it => { it.comments = commentStmt.all(it.id); });
  res.json({ items });
});

// Like toggle
app.post('/api/item/:id/like', (req, res) => {
  const id = req.params.id;
  const row = db.prepare('SELECT likes, liked FROM items WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const newLiked = row.liked ? 0 : 1;
  const newLikes = Math.max(0, row.likes + (newLiked ? 1 : -1));
  db.prepare('UPDATE items SET liked = ?, likes = ? WHERE id = ?').run(newLiked, newLikes, id);
  res.json({ id, likes: newLikes, liked: !!newLiked });
});

// Comment
app.post('/api/item/:id/comment', (req, res) => {
  const id = req.params.id;
  const { text } = req.body || {};
  const row = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (!text) return res.status(400).json({ error: 'text required' });
  const comment = { id: uuidv4(), item_id: id, author: db.prepare('SELECT name FROM profile WHERE id = 1').get().name || 'user', text, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO comments (id, item_id, author, text, created_at) VALUES (?,?,?,?,?)').run(comment.id, comment.item_id, comment.author, comment.text, comment.created_at);
  const comments = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC').all(id);
  res.json({ id, comments });
});

// GET /api/profile
app.get('/api/profile', (req, res) => {
  const p = db.prepare('SELECT name, avatar FROM profile WHERE id = 1').get();
  res.json(p || { name: 'user', avatar: '' });
});

// PUT /api/profile (supports multipart avatar or JSON)
app.put('/api/profile', upload.single('avatar'), (req, res) => {
  const nameFromBody = req.body && req.body.name;
  if (req.file) {
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    db.prepare('UPDATE profile SET avatar = ? WHERE id = 1').run(avatarUrl);
  }
  if (nameFromBody) {
    db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(nameFromBody);
  }
  // If JSON
  try {
    if (req.is('application/json') && req.body && req.body.name) {
      db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(req.body.name);
    }
  } catch (e) {}
  const p = db.prepare('SELECT name, avatar FROM profile WHERE id = 1').get();
  res.json(p);
});

// POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const type = (req.file.mimetype || '').startsWith('image') ? 'image' : 'video';
  const title = req.body.title || req.file.originalname || '新作品';
  const profileRow = db.prepare('SELECT name, avatar FROM profile WHERE id = 1').get();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO items (id, url, type, title, author_id, author_name, author_avatar, likes, liked, location, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, url, type, title, 'me', profileRow.name, profileRow.avatar, 0, 0, 'Beijing', now);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json({ success: true, item: itemRowToObj(item) });
});

// GET favorites (likes > 5)
app.get('/api/profile/favorites', (req, res) => {
  const rows = db.prepare('SELECT * FROM items WHERE likes > 5 ORDER BY created_at DESC').all();
  const items = rows.map(itemRowToObj);
  res.json({ items });
});

// GET works (author_name == profile.name)
app.get('/api/profile/works', (req, res) => {
  const profileRow = db.prepare('SELECT name FROM profile WHERE id = 1').get();
  const rows = db.prepare('SELECT * FROM items WHERE author_name = ? ORDER BY created_at DESC').all(profileRow.name);
  const items = rows.map(itemRowToObj);
  res.json({ items });
});

// Messages
app.get('/api/messages', (req, res) => {
  const rows = db.prepare('SELECT id, from_user as from, text, created_at FROM messages ORDER BY created_at ASC').all();
  res.json({ items: rows });
});
app.post('/api/messages', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const profileRow = db.prepare('SELECT name FROM profile WHERE id = 1').get();
  const m = { id: uuidv4(), from_user: profileRow.name, text, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO messages (id, from_user, text, created_at) VALUES (?,?,?,?)').run(m.id, m.from_user, m.text, m.created_at);
  res.json({ success: true, message: m });
});

const port = process.env.PORT || 4001;
app.listen(port, () => {
  console.log(`Persistent API server running at http://localhost:${port}`);
  console.log(`DB file: ${dbPath}`);
});
