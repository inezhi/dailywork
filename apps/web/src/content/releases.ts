export interface ReleaseSection {
  type: '新增' | '改进' | '修复'
  items: string[]
}

export interface ReleaseNote {
  version: string
  date: string
  title: string
  sections: ReleaseSection[]
}

/**
 * User-facing release notes. Keep newest first and update this file together
 * with package versions, CHANGELOG.md and the release tag. See CLAUDE.md.
 */
export const RELEASES: ReleaseNote[] = [
  {
    version: '0.2.0',
    date: '2026-10-27',
    title: '账户与全新主题',
    sections: [
      {
        type: '新增',
        items: [
          '账户体系：注册、登录、修改密码、上传或移除头像；默认头像使用用户名首字母。',
          '每个账户拥有独立的任务、项目、文档、速记、专注、设置与 AI 供应商。',
          'AI 回复逐字显示、对话历史，以及任务 / 文档 / 周复盘上下文入口。',
          '文档 AI 菜单：润色、续写、摘要、翻译、提取可执行任务。',
          '每日例程、项目操作记录、速记图片/PDF 附件、任务级撤销。',
          '看板、四象限、日历与时间轴支持拖拽；手机可安全连接并离线打开。',
          '设置 → 关于中的版本更新记录。',
          '支持 Docker 部署：镜像内含 SQLite，数据通过 /data 卷持久化。',
          '桌面端改为连接统一服务端；桌面、浏览器与后续 Android 客户端共享账户与同一份数据。',
        ],
      },
      {
        type: '改进',
        items: [
          '全新默认主题：清爽蓝色、冷白画布与协调的状态色。',
          '每个账户拥有独立数据空间；首个账户会承接已有工作区数据。',
          '备份按账户导出/导入；恢复后重启应用完成替换。',
          '登录状态会被安全保存；修改密码后其他设备需要重新登录。',
        ],
      },
      {
        type: '修复',
        items: [
          '修复速记转任务偶尔失败的问题。',
          '修复文档保存时标题可能被覆盖的问题。',
          '修复切换主题色后部分按钮颜色未同步的问题。',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-27',
    title: '首个可验收版本',
    sections: [
      {
        type: '新增',
        items: [
          '任务 / 子任务 / 状态 / 优先级 / 标签 / 日期与预估；今天、全部任务、看板、四象限、日历、时间轴。',
          '项目、空间、交付成果、任务模板、收件箱与 flomo 式速记。',
          '每日容量、每日收尾、番茄专注、专注环、仪表盘与本周复盘。',
          '块级文档、图片、反向链接、自动保存；附件与缩略图。',
          'AI 供应商配置、工具调用与护栏；daily 命令行与 MCP 接口。',
          '局域网配对、备份导出/导入、Electron dmg、设计系统与自动化测试。',
        ],
      },
    ],
  },
]
