// 前端交互：渲染 feed、发帖、编辑资料、点赞、评论、角色聊天
document.addEventListener('DOMContentLoaded', () => {
  const postContent = document.getElementById('postContent');
  const postBtn = document.getElementById('postBtn');
  const feedEl = document.getElementById('feed');

  const avatarImg = document.getElementById('avatar');
  const usernameEl = document.getElementById('username');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const profileFields = document.getElementById('profileFields');
  const nameInput = document.getElementById('nameInput');
  const bioInput = document.getElementById('bioInput');
  const avatarUrlInput = document.getElementById('avatarUrlInput');
  const saveProfile = document.getElementById('saveProfile');
  const cancelProfile = document.getElementById('cancelProfile');

  const roleSelect = document.getElementById('roleSelect');
  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');

  // load user and posts
  function refreshUser() {
    window.api.getUser().then((u) => {
      usernameEl.textContent = u.username || 'user';
      nameInput.value = u.name || '';
      bioInput.value = u.bio || '';
      avatarUrlInput.value = u.avatar || '';
      if (u.avatar) {
        avatarImg.src = u.avatar;
      } else {
        // default svg with first letter
        const letter = (u.username || 'U').charAt(0).toUpperCase();
        avatarImg.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='%23ddd'/><text x='50%' y='55%' font-size='36' text-anchor='middle' fill='%23777'>${letter}</text></svg>`;
      }
    });
  }

  function renderPosts() {
    window.api.getPosts().then((posts) => {
      feedEl.innerHTML = '';
      posts.forEach((p) => {
        const post = document.createElement('article');
        post.className = 'post';
        post.innerHTML = `
          <div class="meta">
            <img src="${p.author.avatar || defaultAvatar(p.author.username)}" alt="avatar">
            <div>
              <div class="who">${escapeHtml(p.author.name || p.author.username)}</div>
              <div class="time" style="font-size:13px;color:#657786">${timeAgo(p.createdAt)}</div>
            </div>
          </div>
          <div class="content">${escapeHtml(p.content)}</div>
          <div class="actions">
            <button class="action-btn like-btn ${p.likedByMe ? 'liked' : ''}" data-id="${p.id}">❤ <span class="like-count">${p.likes||0}</span></button>
            <button class="action-btn comment-toggle" data-id="${p.id}">💬 评论 (${(p.comments||[]).length})</button>
          </div>
          <div class="comments" data-id="${p.id}" style="display:none">
            ${(p.comments||[]).map(c=>`<div class="comment"><div class="meta">${escapeHtml(c.author.name||c.author.username)} · ${timeAgo(c.createdAt)}</div><div>${escapeHtml(c.text)}</div></div>`).join('')}
            <form class="comment-form" data-id="${p.id}">
              <input placeholder="写评论...">
              <button type="submit">评论</button>
            </form>
          </div>
        `;
        feedEl.appendChild(post);
      });
    });
  }

  function defaultAvatar(username) {
    const letter = (username || 'U').charAt(0).toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='100%' height='100%' fill='%23ddd'/><text x='50%' y='55%' font-size='20' text-anchor='middle' fill='%23777'>${letter}</text></svg>`;
  }

  // helpers
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return sec + '秒前';
    if (sec < 3600) return Math.floor(sec / 60) + '分钟前';
    if (sec < 86400) return Math.floor(sec / 3600) + '小时前';
    return Math.floor(sec / 86400) + '天前';
  }

  // events
  postBtn.addEventListener('click', () => {
    const content = postContent.value;
    postBtn.disabled = true;
    window.api.createPost({ content }).then(() => {
      postContent.value = '';
      renderPosts();
    }).catch((e) => alert(e.message)).finally(() => postBtn.disabled = false);
  });

  feedEl.addEventListener('click', (ev) => {
    const likeBtn = ev.target.closest('.like-btn');
    if (likeBtn) {
      const id = likeBtn.dataset.id;
      window.api.toggleLike(id).then(() => renderPosts());
      return;
    }
    const commentToggle = ev.target.closest('.comment-toggle');
    if (commentToggle) {
      const id = commentToggle.dataset.id;
      const container = feedEl.querySelector(`.comments[data-id="${id}"]`);
      if (container) container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
  });

  feedEl.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (!form.classList.contains('comment-form')) return;
    const id = form.dataset.id;
    const input = form.querySelector('input');
    const text = input.value;
    if (!text) return;
    window.api.addComment(id, text).then(() => renderPosts());
    input.value = '';
  });

  // profile editing
  editProfileBtn.addEventListener('click', () => {
    profileFields.style.display = profileFields.style.display === 'none' ? 'block' : 'none';
  });
  cancelProfile.addEventListener('click', () => {
    profileFields.style.display = 'none';
    refreshUser();
  });
  saveProfile.addEventListener('click', () => {
    const u = {
      name: nameInput.value,
      bio: bioInput.value,
      avatar: avatarUrlInput.value,
    };
    window.api.saveUser(u).then(() => {
      profileFields.style.display = 'none';
      refreshUser();
      renderPosts();
    });
  });

  // chat (简单预设角色回复)
  const roles = {
    '小助手': [
      '你好！有什么我可以帮你的吗？',
      '我会尽量提供友好的建议 😊',
      '这个想法很棒！可以详细说说吗？',
    ],
    '智者': [
      '思考是走向深度理解的第一步。',
      '耐心和持续是最重要的。',
      '从不同角度审视问题会有新发现。',
    ],
    '逗趣君': [
      '哈哈，你说得太逗了！',
      '要不我们来个冷笑话？',
      '表情包了解一下！😝',
    ],
  };

  sendChat.addEventListener('click', () => {
    const txt = chatInput.value;
    if (!txt) return;
    appendChatLine(txt, 'me');
    chatInput.value = '';
    // simple bot reply
    const role = roleSelect.value;
    appendChatLine('正在思考中...', '');
    setTimeout(() => {
      // remove the 'thinking' last line
      const lines = chatWindow.querySelectorAll('.chat-line');
      if (lines.length) {
        const last = lines[lines.length - 1];
        if (last && last.textContent.includes('正在思考中')) last.remove();
      }
      const responses = roles[role] || ['我暂时不知道怎么回答'];
      const resp = responses[Math.floor(Math.random() * responses.length)];
      appendChatLine(resp, '');
    }, 700 + Math.random() * 800);
  });

  function appendChatLine(text, cls) {
    const d = document.createElement('div');
    d.className = 'chat-line' + (cls ? ' ' + cls : '');
    d.textContent = text;
    chatWindow.appendChild(d);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // listen to auto comments so UI can refresh
  window.addEventListener('api:autocomment', (ev) => {
    renderPosts();
  });

  // initial load
  refreshUser();
  renderPosts();
});
