/*
YourApp.tsx
抖音风格示例应用（前端组件）

说明（中文）：
- 本文件导出默认组件 YourApp，它是一个独立的前端应用页面示例。
- 所有与后端交互的路径都放在 export 的 defaultApiConfig 中，部署时请把这些 URL 指向后端对应的 API。
- 支持的 API 路由（示例名称）：
  - feed: GET /api/feed?cursor=...&filter=all|local&type=video|image
  - search: GET /api/search?q=...
  - like: POST /api/item/:id/like  返回更新后的 like 状态
  - comment: POST /api/item/:id/comment {text}
  - profile: GET/PUT /api/profile
  - upload: POST /api/upload (multipart/form-data)
  - favorites: GET /api/profile/favorites
  - works: GET /api/profile/works
  - messages: GET /api/messages  POST /api/messages

使用方法：
- 在你的应用中引入并渲染 <YourApp apiConfig={...} />，或编辑 defaultApiConfig 使之指向你后端的实际接口。
- 该组件使用普通的 HTML/CSS（内联和样式表注入）实现布局，使用 fetch 调用 API。

注意：此文件是前端示例逻辑，后端需要对应实现这些 API 才能完成全部功能。
*/

import React, { useEffect, useState, useRef } from 'react';

export type ApiConfig = {
  feed: string; // GET feed, supports ?cursor=&filter=all|local&type=video|image
  search: string; // GET search?q=
  like: (id: string) => string; // POST
  comment: (id: string) => string; // POST
  profile: string; // GET/PUT
  upload: string; // POST multipart
  favorites: string; // GET
  works: string; // GET
  messages: string; // GET/POST
};

export const defaultApiConfig: ApiConfig = {
  feed: '/api/feed',
  search: '/api/search',
  like: (id: string) => `/api/item/${id}/like`,
  comment: (id: string) => `/api/item/${id}/comment`,
  profile: '/api/profile',
  upload: '/api/upload',
  favorites: '/api/profile/favorites',
  works: '/api/profile/works',
  messages: '/api/messages',
};

type ItemType = 'video' | 'image';

type FeedItem = {
  id: string;
  url: string; // video or image URL
  thumbnail?: string;
  type: ItemType;
  title?: string;
  author?: { id: string; name: string; avatar?: string };
  likes: number;
  liked?: boolean;
  comments?: { id: string; author: string; text: string }[];
  location?: string; // 城市/地区
};

export default function YourApp({ apiConfig = defaultApiConfig }: { apiConfig?: ApiConfig }) {
  const [route, setRoute] = useState<'home' | 'search' | 'local' | 'profile' | 'upload' | 'messages'>('home');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Profile
  const [profile, setProfile] = useState<{ name: string; avatar?: string } | null>({ name: 'user' });
  const [favorites, setFavorites] = useState<FeedItem[] | null>(null);
  const [works, setWorks] = useState<FeedItem[] | null>(null);

  // Search
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<FeedItem[] | null>(null);

  // Messages
  const [messages, setMessages] = useState<{ id: string; from: string; text: string }[] | null>(null);
  const [msgText, setMsgText] = useState('');

  useEffect(() => {
    injectStyles();
    loadFeed('all');
    loadProfile();
  }, []);

  async function loadFeed(filter: 'all' | 'local') {
    setLoading(true);
    try {
      const url = new URL(apiConfig.feed, window.location.origin);
      if (cursor) url.searchParams.set('cursor', cursor);
      url.searchParams.set('filter', filter);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('feed load failed');
      const data = await res.json();
      // 期望后端返回 {items: FeedItem[], nextCursor?: string}
      const items: FeedItem[] = data.items || [];
      setFeed((s) => (cursor ? [...s, ...items] : items));
      setCursor(data.nextCursor || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const res = await fetch(apiConfig.profile);
      if (!res.ok) return; // 使用本地默认
      const data = await res.json();
      setProfile((p) => ({ ...(p || {}), ...(data || {}) }));
    } catch (e) {
      console.error('loadProfile', e);
    }
  }

  async function loadFavorites() {
    try {
      const res = await fetch(apiConfig.favorites);
      if (!res.ok) throw new Error('favorites failed');
      const data = await res.json();
      setFavorites(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadWorks() {
    try {
      const res = await fetch(apiConfig.works);
      if (!res.ok) throw new Error('works failed');
      const data = await res.json();
      setWorks(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  // Search
  async function doSearch() {
    if (!q) return;
    try {
      const url = new URL(apiConfig.search, window.location.origin);
      url.searchParams.set('q', q);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  // Messages
  async function loadMessages() {
    try {
      const res = await fetch(apiConfig.messages);
      if (!res.ok) throw new Error('messages failed');
      const data = await res.json();
      setMessages(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function sendMessage() {
    if (!msgText) return;
    try {
      const res = await fetch(apiConfig.messages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText }),
      });
      if (!res.ok) throw new Error('send failed');
      setMsgText('');
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  }

  // Like
  async function toggleLike(item: FeedItem, idx: number) {
    const prev = feed[idx];
    const optimistic = { ...prev, liked: !prev.liked, likes: prev.liked ? prev.likes - 1 : prev.likes + 1 };
    setFeed((s) => {
      const copy = [...s];
      copy[idx] = optimistic;
      return copy;
    });
    try {
      const res = await fetch(apiConfig.like(item.id), { method: 'POST' });
      if (!res.ok) throw new Error('like failed');
      const data = await res.json();
      setFeed((s) => {
        const copy = [...s];
        copy[idx] = { ...copy[idx], likes: data.likes ?? copy[idx].likes, liked: data.liked ?? copy[idx].liked };
        return copy;
      });
    } catch (e) {
      console.error(e);
      // 回退
      setFeed((s) => {
        const copy = [...s];
        copy[idx] = prev;
        return copy;
      });
    }
  }

  // Comment
  async function addComment(item: FeedItem, idx: number, text: string) {
    if (!text) return;
    try {
      const res = await fetch(apiConfig.comment(item.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('comment failed');
      const data = await res.json();
      // 假设返回新的 comment 列表
      setFeed((s) => {
        const copy = [...s];
        copy[idx] = { ...copy[idx], comments: data.comments ?? [...(copy[idx].comments || []), { id: Date.now().toString(), author: profile?.name || 'user', text }] };
        return copy;
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Upload
  async function doUpload(file: File, title?: string) {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    try {
      const res = await fetch(apiConfig.upload, { method: 'POST', body: form });
      if (!res.ok) throw new Error('upload failed');
      // 上传成功后刷新作品
      await loadWorks();
      alert('上传成功');
    } catch (e) {
      console.error(e);
      alert('上传失败');
    }
  }

  // Profile edit
  async function saveProfile(newProfile: { name?: string; avatar?: string | File }) {
    try {
      if (newProfile.avatar && typeof newProfile.avatar !== 'string') {
        // upload avatar as file
        const f = new FormData();
        f.append('avatar', newProfile.avatar);
        if (newProfile.name) f.append('name', newProfile.name);
        const res = await fetch(apiConfig.profile, { method: 'PUT', body: f });
        if (!res.ok) throw new Error('profile save failed');
      } else {
        const res = await fetch(apiConfig.profile, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProfile) });
        if (!res.ok) throw new Error('profile save failed');
      }
      await loadProfile();
    } catch (e) {
      console.error(e);
    }
  }

  // Simple UI handlers
  function goto(r: typeof route) {
    setRoute(r);
    if (r === 'home') {
      setCurrentIndex(0);
      loadFeed('all');
    }
    if (r === 'local') {
      setCurrentIndex(0);
      loadFeed('local');
    }
    if (r === 'profile') {
      loadFavorites();
      loadWorks();
    }
    if (r === 'messages') {
      loadMessages();
    }
  }

  // Swipe handling for the feed (touch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startY = 0;
    let moved = false;
    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      moved = false;
    }
    function onTouchMove(e: TouchEvent) {
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > 30) moved = true;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!moved) return;
      const endY = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY) || 0;
      const dy = endY - startY;
      if (dy < -50) {
        // 上滑 -> 下一个
        setCurrentIndex((i) => Math.min(feed.length - 1, i + 1));
      } else if (dy > 50) {
        // 下滑 -> 上一个
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    }
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove);
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [feed]);

  const current = feed[currentIndex];

  return (
    <div className="yourapp-root">
      <header className="ya-header">
        <div className="ya-title" onClick={() => goto('home')}>YourApp</div>
        <div className="ya-actions">
          <button onClick={() => goto('search')}>搜索</button>
          <button onClick={() => goto('local')}>同城</button>
          <button onClick={() => goto('upload')}>发布</button>
          <button onClick={() => goto('messages')}>私信</button>
          <button onClick={() => goto('profile')}>我的</button>
        </div>
      </header>

      <main className="ya-main">
        {route === 'home' && (
          <div className="feed" ref={containerRef}>
            {feed.length === 0 && !loading && <div className="empty">暂无内容</div>}
            {feed.map((it, idx) => (
              <div key={it.id} className={`feed-item ${idx === currentIndex ? 'active' : 'inactive'}`}>
                {it.type === 'video' ? (
                  <video src={it.url} className="media" playsInline muted autoPlay loop />
                ) : (
                  <img src={it.url} className="media" alt={it.title || ''} />
                )}
                <div className="meta">
                  <div className="author">
                    <img src={it.author?.avatar} className="avatar" />
                    <div>{it.author?.name || '未知'}</div>
                  </div>
                  <div className="actions">
                    <button onClick={() => toggleLike(it, idx)} className={it.liked ? 'liked' : ''}>❤️ {it.likes}</button>
                    <CommentBox item={it} idx={idx} onAdd={(text) => addComment(it, idx, text)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {route === 'search' && (
          <div className="search-page">
            <div className="search-box">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索视频/作者/话题" />
              <button onClick={doSearch}>搜索</button>
              <button onClick={() => { setQ(''); setSearchResults(null); }}>清空</button>
            </div>
            <div className="search-results">
              {searchResults?.map((it) => (
                <div key={it.id} className="search-item">
                  {it.type === 'video' ? <video src={it.url} className="thumb" controls /> : <img src={it.url} className="thumb" />}
                  <div className="s-meta">{it.title} - {it.author?.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {route === 'local' && (
          <div className="local-page">
            <h3>同城推荐</h3>
            <div className="local-feed">
              {feed.map((it) => (
                <div key={it.id} className="local-item">
                  {it.type === 'video' ? <video src={it.url} className="thumb" controls /> : <img src={it.url} className="thumb" />}
                  <div>{it.title} - {it.location}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {route === 'upload' && (
          <div className="upload-page">
            <h3>发布视频</h3>
            <UploadBox onUpload={doUpload} />
          </div>
        )}

        {route === 'messages' && (
          <div className="messages-page">
            <h3>私信</h3>
            <div className="messages-list">
              {messages?.map((m) => (
                <div key={m.id} className="msg-item">{m.from}: {m.text}</div>
              ))}
            </div>
            <div className="msg-send">
              <input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="输入消息" />
              <button onClick={sendMessage}>发送</button>
            </div>
          </div>
        )}

        {route === 'profile' && (
          <div className="profile-page">
            <h3>个人资料</h3>
            <div className="profile-card">
              <img src={profile?.avatar} className="profile-avatar" />
              <div className="profile-info">
                <div>昵称: {profile?.name}</div>
                <ProfileEdit profile={profile} onSave={saveProfile} />
              </div>
            </div>

            <div className="tabs">
              <button onClick={() => loadFavorites()}>收藏</button>
              <button onClick={() => loadWorks()}>作品</button>
            </div>
            <div className="tab-content">
              {favorites && (
                <div className="favorites-list">
                  {favorites.map((it) => <div key={it.id}>{it.title}</div>)}
                </div>
              )}
              {works && (
                <div className="works-list">
                  {works.map((it) => <div key={it.id}>{it.title}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <footer className="ya-footer">
        <div>已连接 API：{apiConfig.feed}</div>
      </footer>
    </div>
  );
}

function injectStyles() {
  if (document.getElementById('yourapp-styles')) return;
  const css = `
  .yourapp-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #222; height:100vh; display:flex; flex-direction:column; }
  .ya-header { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border-bottom:1px solid #eee; }
  .ya-title { font-weight:700; font-size:18px; cursor:pointer }
  .ya-actions button { margin-left:8px }
  .ya-main { flex:1; overflow:hidden; position:relative; background:#000; color:#fff }
  .feed { height:100%; display:flex; flex-direction:column; align-items:stretch; }
  .feed-item { height:100vh; width:100%; position:relative; display:flex; align-items:center; justify-content:center; }
  .feed-item.inactive { display:none }
  .media { max-height:100vh; width:100%; object-fit:cover }
  .meta { position:absolute; right:12px; bottom:24px; display:flex; flex-direction:column; align-items:flex-end }
  .avatar, .profile-avatar { width:44px; height:44px; border-radius:50%; object-fit:cover }
  .meta .actions { margin-top:8px; display:flex; flex-direction:column }
  .meta .actions button { margin:6px 0; background:rgba(0,0,0,0.4); color:#fff; border:0; padding:6px 10px; border-radius:6px }
  .meta .actions button.liked { color: #ff6b6b }
  .search-page, .profile-page, .upload-page, .messages-page, .local-page { padding:12px; background:#fff; color:#000; height:100%; overflow:auto }
  .search-box { display:flex; gap:8px }
  .thumb { width:160px; height:90px; object-fit:cover }
  .profile-card { display:flex; gap:12px; align-items:center }
  .tabs button { margin-right:8px }
  .upload-box { display:flex; flex-direction:column }
  `;
  const style = document.createElement('style');
  style.id = 'yourapp-styles';
  style.innerHTML = css;
  document.head.appendChild(style);
}

function CommentBox({ item, idx, onAdd }: { item: FeedItem; idx: number; onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="comment-box">
      <button onClick={() => setOpen((o) => !o)}>💬 {item.comments?.length || 0}</button>
      {open && (
        <div className="comment-panel">
          <div className="comments-list">
            {item.comments?.map((c) => <div key={c.id}><b>{c.author}</b>: {c.text}</div>)}
          </div>
          <div className="comment-add">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="写评论..." />
            <button onClick={() => { onAdd(text); setText(''); }}>发送</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadBox({ onUpload }: { onUpload: (file: File, title?: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  return (
    <div className="upload-box">
      <input type="file" accept="video/*,image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setFile(e.target.files[0]); }} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可选）" />
      <button onClick={() => { if (!file) { alert('请选择文件'); return; } onUpload(file, title); }}>上传</button>
    </div>
  );
}

function ProfileEdit({ profile, onSave }: { profile?: { name?: string; avatar?: string }, onSave: (p: { name?: string; avatar?: string | File }) => void }) {
  const [name, setName] = useState(profile?.name || 'user');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  useEffect(() => { setName(profile?.name || 'user'); }, [profile]);
  return (
    <div className="profile-edit">
      <div>
        <label>昵称: <input value={name} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      <div>
        <label>头像: <input type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setAvatarFile(e.target.files[0]); }} /></label>
      </div>
      <div>
        <button onClick={() => onSave({ name, avatar: avatarFile || undefined })}>保存</button>
      </div>
    </div>
  );
}
