// 简易前端“API”，基于 localStorage，方便以后替换为真实后端
(function () {
  const STORAGE_KEY = 'nuo_mi_ji_forum_v1';

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = {
        user: { username: 'user', name: '', bio: '', avatar: '' },
        posts: seedPosts(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
      return init;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      const init = {
        user: { username: 'user', name: '', bio: '', avatar: '' },
        posts: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
      return init;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function seedPosts() {
    const now = Date.now();
    return [
      {
        id: 'p1',
        author: { username: 'alice', name: 'Alice', avatar: '' },
        content: '欢迎来到糯米机仿推特论坛！这是示例帖子。',
        createdAt: now - 1000 * 60 * 60,
        likes: 2,
        likedByMe: false,
        comments: [
          { id: 'c1', author: { username: 'bob', name: 'Bob' }, text: '好漂亮的界面！', createdAt: now - 1000 * 60 * 30 },
        ],
      },
      {
        id: 'p2',
        author: { username: 'charlie', name: 'Charlie', avatar: '' },
        content: '试试发帖、点赞和评论吧~',
        createdAt: now - 1000 * 60 * 40,
        likes: 1,
        likedByMe: false,
        comments: [],
      },
    ];
  }

  function getStore() {
    return loadState();
  }

  function getPosts() {
    const s = getStore();
    // newest first
    return Promise.resolve(s.posts.slice().sort((a, b) => b.createdAt - a.createdAt));
  }

  function createPost({ content }) {
    if (!content || !content.trim()) return Promise.reject(new Error('内容不能为空'));
    const s = getStore();
    const id = 'p' + Date.now();
    const post = {
      id,
      author: { username: s.user.username || 'user', name: s.user.name || s.user.username, avatar: s.user.avatar || '' },
      content: content.trim(),
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false,
      comments: [],
    };
    s.posts.push(post);
    saveState(s);
    // simulate others commenting after a short delay
    setTimeout(() => {
      autoComment(post.id);
    }, 2000 + Math.random() * 3000);
    return Promise.resolve(post);
  }

  function toggleLike(postId) {
    const s = getStore();
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return Promise.reject(new Error('找不到帖子'));
    if (p.likedByMe) {
      p.likes = Math.max(0, p.likes - 1);
      p.likedByMe = false;
    } else {
      p.likes = (p.likes || 0) + 1;
      p.likedByMe = true;
    }
    saveState(s);
    return Promise.resolve(p);
  }

  function addComment(postId, text) {
    if (!text || !text.trim()) return Promise.reject(new Error('评论不能为空'));
    const s = getStore();
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return Promise.reject(new Error('找不到帖子'));
    const c = {
      id: 'c' + Date.now(),
      author: { username: s.user.username || 'user', name: s.user.name || s.user.username },
      text: text.trim(),
      createdAt: Date.now(),
    };
    p.comments.push(c);
    saveState(s);
    return Promise.resolve(c);
  }

  function getUser() {
    const s = getStore();
    return Promise.resolve(s.user);
  }

  function saveUser(user) {
    const s = getStore();
    s.user = Object.assign({}, s.user, user);
    saveState(s);
    return Promise.resolve(s.user);
  }

  // 自动生成别人评论（简单示例）
  function autoComment(postId) {
    const s = getStore();
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return;
    const samples = [
      '有意思！',
      '哈哈，支持一下~',
      '可以试试看更多功能',
      '我也遇到过类似的想法',
      '这条评论来自自动回复机器人',
    ];
    const text = samples[Math.floor(Math.random() * samples.length)];
    const comment = {
      id: 'c' + Date.now() + Math.floor(Math.random() * 100),
      author: { username: 'guest' + Math.floor(Math.random() * 90), name: '游客' },
      text,
      createdAt: Date.now(),
    };
    p.comments.push(comment);
    saveState(s);
    // dispatch browser event so UI can update if needed
    window.dispatchEvent(new CustomEvent('api:autocomment', { detail: { postId, comment } }));
  }

  // Expose API
  window.api = {
    getPosts,
    createPost,
    toggleLike,
    addComment,
    getUser,
    saveUser,
  };
})();
