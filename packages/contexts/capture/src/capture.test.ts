import { describe, expect, it } from 'vitest'
import { extractTags } from './index'

describe('memo hashtags', () => {
  it('extracts Chinese, ASCII and underscored tags', () => {
    expect(extractTags('记录 #深度工作 和 #design_system，再来一个 #中文标签')).toEqual([
      '深度工作',
      'design_system',
      '中文标签',
    ])
  })

  it('deduplicates repeated tags and ignores a bare hash', () => {
    expect(extractTags('#灵感 #灵感 # 普通文字')).toEqual(['灵感'])
  })

  it('returns an empty list when there are no tags', () => {
    expect(extractTags('没有标签的一句话')).toEqual([])
  })
})
