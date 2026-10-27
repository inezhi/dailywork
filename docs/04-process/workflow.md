# 工程流程

更新：2026-10-27

## 分支与提交

- `main` 只保留发布基线，已启用分支保护；不直接提交，只通过 GitHub Pull Request 合入。
- `dev` 是日常集成分支；功能从 `dev` 切出 `feat/<scope>`、`fix/<scope>`、`docs/<scope>`、`chore/<scope>`。
- 功能完成后先合入 `dev`；发布时从 `dev` 向 `main` 提 PR，合并后在 `main` 打 `vX.Y.Z` tag。
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
  - `feat(tasking): add optimistic concurrency to task.update`
  - `fix(web): keep focus ring in sync after refresh`
  - `docs(adr): record the storage decision`
  - `chore(repo): pin pnpm 10`
- 单个提交应自洽：代码 + 测试 + 相关文档；不提交密钥、数据库、日志、截图原图之外的个人数据。
- 合并策略：功能分支用 `--no-ff` 合入 `dev`；`main` 只接受 PR 合并，禁止直接 push。

> GitHub Actions 工作流暂存于 `docs/04-process/github-actions-ci.yml`。当前 OAuth 凭据没有 `workflow` scope，无法推送 `.github/workflows/*`；执行 `gh auth refresh -s workflow` 后把文件移回即可启用。

## 评审清单（自检）

1. 改动是否只经 ops 写入？是否新增了跨上下文直接写表？
2. 新增/修改 op 是否同步更新 CLI/MCP/AI 暴露、测试与本文档？
3. 日期使用用户时区的 `YYYY-MM-DD` 还是 UTC？是否误用？
4. 是否写入 `op_log`（同事务）？破坏性操作是否要求确认？
5. UI 是否覆盖 hover / focus / disabled / 空状态 / 深色？
6. 是否有测试覆盖业务不变量与错误路径？

## 版本

- `0.x` 里程碑版本；`1.0.0` 首个可日常使用版本。
- CHANGELOG 按 Keep a Changelog 结构维护；发布 tag 与 dmg 对应。

## 环境

- Node ≥ 22.5（开发机 26，Electron 内置 24.22）；pnpm 10.18；macOS 26+。
- 本仓库使用 `pnpm`（已通过 corepack 启用）。`.npmrc` 使用 `node-linker=hoisted` 以兼容 Electron 打包。
