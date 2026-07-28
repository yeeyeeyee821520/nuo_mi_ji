// Persistent API server with authentication and model-fetching support
// Usage: cd persist && npm install && npm start

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

const app = express();
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const modelDir = path.join(uploadDir, 'models');
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// Initialize DB with migrations
function initDb() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      avatar TEXT,
      created_at TEXT
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
      location TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      item_id TEXT,
      created_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      user_id TEXT,
      author TEXT,
      text TEXT,
      created_at TEXT,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_user TEXT,
      text TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      api_key TEXT,
      saved_file TEXT,
      last_fetch_at TEXT,
      created_at TEXT
    );
  `);

  // ensure one profile row
  const prof = db.prepare('SELECT name FROM profile WHERE id = 1').get();
  if (!prof) {
    db.prepare('INSERT INTO profile (id, name, avatar) VALUES (1, ?, ?)').run('user', '');
  }

  // seed users and items if empty
  const userCount = db.prepare('SELECT COUNT(1) as c FROM users').get().c;
  if (userCount === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, display_name, avatar, created_at) VALUES (?,?,?,?,?,?)');
    const pwHash = bcrypt.hashSync('password', 10);
    insertUser.run('u1', 'alice', pwHash, 'Alice', 'https://i.pravatar.cc/80?img=1', now);
    insertUser.run('u2', 'charlie', pwHash, 'Charlie', 'https://i.pravatar.cc/80?img=3', now);
    insertUser.run('u3', 'david', pwHash, 'David', 'https://i.pravatar.cc/80?img=5', now);
  }

  const count = db.prepare('SELECT COUNT(1) as c FROM items').get().c;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO items (id, url, type, title, author_id, author_name, author_avatar, likes, location, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const now = new Date().toISOString();
    insert.run('1', 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', 'video', '示例视频 1', 'u1', 'Alice', 'https://i.pravatar.cc/80?img=1', 12, 'Beijing', now);
    insert.run('2', 'https://via.placeholder.com/800x1200.png?text=Image+1', 'image', '示例图片 1', 'u2', 'Charlie', 'https://i.pravatar.cc/80?img=3', 5, 'Shanghai', now);
    insert.run('3', 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', 'video', '示例视频 2', 'u3', 'David', 'https://i.pravatar.cc/80?img=5', 3, 'Beijing', now);
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

// helper converters
function itemRowToObj(row) {
  return {
    id: row.id,
    url: row.url,
    type: row.type,
    title: row.title,
    author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
    likes: row.likes,
    location: row.location,
    created_at: row.created_at
  };
}

// Auth helpers
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Authorization required' });
  const parts = h.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Bad Authorization header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = db.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?').get(payload.id);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return next();
  try {
    const payload = jwt.verify(h.split(' ')[1], JWT_SECRET);
    req.user = db.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?').get(payload.id);
  } catch (e) {
    // ignore
  }
  return next();
}

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'username taken' });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, display_name, avatar, created_at) VALUES (?,?,?,?,?,?)').run(id, username, hash, display_name || username, '', new Date().toISOString());
  const user = db.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row) return res.status(400).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, row.password_hash)) return res.status(400).json({ error: 'invalid credentials' });
  const user = { id: row.id, username: row.username, display_name: row.display_name, avatar: row.avatar };
  const token = signToken(user);
  res.json({ user, token });
});

// GET /api/feed?cursor=&filter=all|local&type=video|image
app.get('/api/feed', optionalAuth, (req, res) => {
  const { cursor, filter = 'all', type } = req.query;
  let where = [];
  let params = [];
  if (filter === 'local') {
    where.push('location = ?'); params.push('Beijing');
  }
  if (type) { where.push('type = ?'); params.push(type); }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const start = cursor ? parseInt(cursor, 10) : 0;
  const pageSize = 10;
  const rows = db.prepare(`SELECT * FROM items ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, start);
  const items = rows.map(itemRowToObj);
  // attach comments and liked status
  const commentStmt = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC');
  const likeCountStmt = db.prepare('SELECT COUNT(1) as c FROM likes WHERE item_id = ?');
  const likedStmt = db.prepare('SELECT 1 FROM likes WHERE item_id = ? AND user_id = ? LIMIT 1');
  items.forEach(it => {
    it.comments = commentStmt.all(it.id);
    it.likes = likeCountStmt.get(it.id).c;
    it.liked = req.user ? !!likedStmt.get(it.id, req.user.id) : false;
  });
  const total = db.prepare(`SELECT COUNT(1) as c FROM items ${whereSql}`).get(...params).c;
  const nextCursor = start + items.length < total ? String(start + items.length) : null;
  res.json({ items, nextCursor });
});

// GET /api/search?q=
app.get('/api/search', optionalAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ items: [] });
  const rows = db.prepare(`SELECT * FROM items WHERE LOWER(title) LIKE ? OR LOWER(author_name) LIKE ? ORDER BY created_at DESC LIMIT 50`).all(`%${q}%`, `%${q}%`);
  const items = rows.map(itemRowToObj);
  const commentStmt = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC');
  const likeCountStmt = db.prepare('SELECT COUNT(1) as c FROM likes WHERE item_id = ?');
  const likedStmt = db.prepare('SELECT 1 FROM likes WHERE item_id = ? AND user_id = ? LIMIT 1');
  items.forEach(it => { it.comments = commentStmt.all(it.id); it.likes = likeCountStmt.get(it.id).c; it.liked = req.user ? !!likedStmt.get(it.id, req.user.id) : false; });
  res.json({ items });
});

// Like toggle (requires auth)
app.post('/api/item/:id/like', authRequired, (req, res) => {
  const id = req.params.id;
  const it = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!it) return res.status(404).json({ error: 'not found' });
  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND item_id = ?').get(req.user.id, id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO likes (id, user_id, item_id, created_at) VALUES (?,?,?,?)').run(uuidv4(), req.user.id, id, new Date().toISOString());
  }
  const likes = db.prepare('SELECT COUNT(1) as c FROM likes WHERE item_id = ?').get(id).c;
  const liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND item_id = ?').get(req.user.id, id);
  res.json({ id, likes, liked });
});

// Comment (requires auth)
app.post('/api/item/:id/comment', authRequired, (req, res) => {
  const id = req.params.id;
  const { text } = req.body || {};
  const it = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!it) return res.status(404).json({ error: 'not found' });
  if (!text) return res.status(400).json({ error: 'text required' });
  const comment = { id: uuidv4(), item_id: id, user_id: req.user.id, author: req.user.display_name || req.user.username, text, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO comments (id, item_id, user_id, author, text, created_at) VALUES (?,?,?,?,?,?)').run(comment.id, comment.item_id, comment.user_id, comment.author, comment.text, comment.created_at);
  const comments = db.prepare('SELECT id, author, text FROM comments WHERE item_id = ? ORDER BY created_at ASC').all(id);
  res.json({ id, comments });
});

// Profile endpoints (auth optional for GET, required for PUT to update current user profile)
app.get('/api/profile', optionalAuth, (req, res) => {
  if (req.user) {
    const u = db.prepare('SELECT id, username, display_name as name, avatar FROM users WHERE id = ?').get(req.user.id);
    return res.json({ name: u.display_name || u.username, avatar: u.avatar });
  }
  const p = db.prepare('SELECT name, avatar FROM profile WHERE id = 1').get();
  res.json(p || { name: 'user', avatar: '' });
});

// Update current user's profile (must be auth)
app.put('/api/profile', authRequired, upload.single('avatar'), (req, res) => {
  const nameFromBody = req.body && req.body.name;
  if (req.file) {
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);
  }
  if (nameFromBody) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(nameFromBody, req.user.id);
  }
  const u = db.prepare('SELECT id, username, display_name as name, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json({ name: u.display_name || u.username, avatar: u.avatar });
});

// Upload new work (auth required)
app.post('/api/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const type = (req.file.mimetype || '').startsWith('image') ? 'image' : 'video';
  const title = req.body.title || req.file.originalname || '新作品';
  const profileRow = db.prepare('SELECT display_name, avatar FROM users WHERE id = ?').get(req.user.id);
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO items (id, url, type, title, author_id, author_name, author_avatar, likes, location, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, url, type, title, req.user.id, profileRow.display_name || req.user.username, profileRow.avatar, 0, 'Beijing', now);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json({ success: true, item: itemRowToObj(item) });
});

// Favorites / Works (auth-required for works)
app.get('/api/profile/favorites', (req, res) => {
  const rows = db.prepare('SELECT i.* FROM items i JOIN likes l ON l.item_id = i.id GROUP BY i.id HAVING COUNT(l.id) > 0 ORDER BY i.created_at DESC').all();
  const items = rows.map(itemRowToObj);
  res.json({ items });
});
app.get('/api/profile/works', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM items WHERE author_id = ? ORDER BY created_at DESC').all(req.user.id);
  const items = rows.map(itemRowToObj);
  res.json({ items });
});

// Messages
app.get('/api/messages', authRequired, (req, res) => {
  const rows = db.prepare('SELECT id, from_user as from, text, created_at FROM messages ORDER BY created_at ASC').all();
  res.json({ items: rows });
});
app.post('/api/messages', authRequired, (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const m = { id: uuidv4(), from_user: req.user.display_name || req.user.username, text, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO messages (id, from_user, text, created_at) VALUES (?,?,?,?)').run(m.id, m.from_user, m.text, m.created_at);
  res.json({ success: true, message: m });
});

// Model registry and fetch
app.post('/api/models', authRequired, (req, res) => {
  const { name, url, api_key } = req.body || {};
  if (!name || !url || !api_key) return res.status(400).json({ error: 'name, url and api_key required' });
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO models (id, name, url, api_key, created_at) VALUES (?,?,?,?,?)').run(id, name, url, api_key, now);
  res.json({ id, name, url, created_at: now });
});

app.get('/api/models', authRequired, (req, res) => {
  // do not return api_key in list
  const rows = db.prepare('SELECT id, name, url, saved_file, last_fetch_at, created_at FROM models ORDER BY created_at DESC').all();
  res.json({ items: rows });
});

// Fetch model from remote and save locally
app.post('/api/models/:id/fetch', authRequired, async (req, res) => {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'model not found' });
  try {
    // try to fetch remote URL using api_key in Authorization header
    const headers = { 'Accept': '*/*' };
    if (row.api_key) headers['Authorization'] = `Bearer ${row.api_key}`;
    const resp = await fetch(row.url, { method: 'GET', headers });
    if (!resp.ok) return res.status(502).json({ error: 'failed to fetch model', status: resp.status });
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const ext = contentType.includes('json') ? '.json' : (contentType.includes('zip') ? '.zip' : '.bin');
    const filename = `${id}-${Date.now()}${ext}`;
    const filePath = path.join(modelDir, filename);
    const buffer = await resp.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    db.prepare('UPDATE models SET saved_file = ?, last_fetch_at = ? WHERE id = ?').run(`/uploads/models/${filename}`, new Date().toISOString(), id);
    res.json({ success: true, saved_file: `/uploads/models/${filename}`, content_type: contentType });
  } catch (e) {
    console.error('fetch model error', e);
    res.status(500).json({ error: 'fetch error', detail: String(e) });
  }
});

// Get model detail (including saved_file)
app.get('/api/models/:id', authRequired, (req, res) => {
  const id = req.params.id;
  const row = db.prepare('SELECT id, name, url, saved_file, last_fetch_at, created_at FROM models WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'model not found' });
  res.json(row);
});

// Start server
const port = process.env.PORT || 4001;
app.listen(port, () => {
  console.log(`Persistent API server running at http://localhost:${port}`);
  console.log(`DB file: ${dbPath}`);
});
