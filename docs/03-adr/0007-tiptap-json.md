# ADR-0007：文档正文使用 TipTap JSON，而非 Yjs

状态：已接受 · 2026-10-27

## 背景

原方案为未来多人协作选择 TipTap + Yjs CRDT。当前产品为单用户本地应用，协作不在 v1.0 范围。

## 决策

- 正文存 `document_bodies.content_json`（TipTap JSON） + `text` 纯文本投影；标题/图标/挂载关系存 `documents`。
- 反向链接从正文中的 `task://`、`project://`、`document://` 提取到 `document_links`。
- 自动保存 850ms 防抖；图片上传为附件并插入 URL。
- 不引入 Yjs / Hocuspocus；未来若做协作，再以 Yjs 作为正文层迁移并写新 ADR。

## 结果

- 少一个 CRDT/双写/压实体系；保存语义简单、可搜索。
- 失去离线多人合并能力；对当前定位无影响。
