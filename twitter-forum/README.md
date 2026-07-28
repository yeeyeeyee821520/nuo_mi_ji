# 糯米机 · 仿推特论坛 (twitter-forum)

这是一个纯前端的示例小应用，使用 HTML/CSS/JavaScript，实现了一个简易的“仿推特”论坛界面，便于演示发帖、点赞、评论、编辑用户资料和角色聊天等交互功能。

目录
- twitter-forum/
  - index.html       — 页面入口（侧边栏 + 发帖区 + 动态流）
  - styles.css       — 页面样式
  - api.js           — 基于 localStorage 的模拟后端（暴露 window.api）
  - app.js           — 前端交互逻辑（渲染、事件绑定）

功能概览
- 发布帖子：在顶部输入框写内容并点击“发布”，帖子会显示在动态流中（最近的在前）。
- 点赞：帖子支持点赞，点赞数会更新（保存在 localStorage）。
- 评论：每条帖子可以展开查看/添加评论，评论会保存到 localStorage，并且发布后会有模拟的“别人”的自动评论。
- 用户资料：侧边栏初始用户名为 `user`，可编辑昵称（name）、签名（bio）和头像（avatar URL）；发帖时会使用当前用户信息作为作者。
- 角色聊天：侧边栏提供几个预设角色（小助手/智者/逗趣君），可以输入文本和角色进行简单对话（本地随机预设回复，便于以后替换为聊天 API）。

本地预览
1. 克隆或下载仓库代码到本地。
2. 在项目根目录启动一个静态服务器：
   - 使用 Python（推荐）：
     ```bash
     python3 -m http.server 8000
     ```
   - 或使用 npm 的 http-server：
     ```bash
     npx http-server ./ -p 8000
     ```
3. 在浏览器打开：
   http://localhost:8000/twitter-forum/

开发说明 / 切换到真实后端
- api.js 暴露了一个简单的前端接口对象：
  - window.api.getPosts()
  - window.api.createPost({content})
  - window.api.toggleLike(postId)
  - window.api.addComment(postId, text)
  - window.api.getUser()
  - window.api.saveUser({name,bio,avatar})

  目前这些函数基于 localStorage 实现，方便演示与本地快速迭代。要切换到真实后端，只需将 api.js 的实现替换为 fetch()/axios 调用对应的 REST API（或 GraphQL）。示例 REST 映射：
  - GET  /api/posts
  - POST /api/posts  { content }
  - POST /api/posts/:id/like
  - POST /api/posts/:id/comments  { text }
  - GET  /api/user
  - PUT  /api/user  { name, bio, avatar }

后续可选增强
- 将前端改用 TypeScript 并添加构建（Vite / webpack）。
- 添加简单的 Node.js + Express 后端示例并修改前端以调用真实接口。
- 支持图片上传（需要后端存储或第三方服务）。
- 实现用户注册/登录（session 或 JWT）。
- 添加 WebSocket（或 SSE）实现实时评论/推送。

版权与许可证
- 本示例项目为演示用途，可按需修改并集成到你的项目中。你可以在仓库中添加许可证文件（例如 MIT）来指定具体许可。

如果你希望，我可以：
- 继续把 README 发布到仓库（已完成），
- 或现在为你建立一个最小的 Node/Express 后端并把前端切换为真实 API，
- 或把前端改写为 TypeScript 并添加构建脚本。

