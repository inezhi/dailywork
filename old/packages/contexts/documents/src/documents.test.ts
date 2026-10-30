import { describe, expect, it } from 'vitest'
import { extractLinks, extractText } from './index'

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '标题' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '关联 ' },
        { type: 'text', text: 'task://tsk_1' },
        { type: 'text', text: ' 与 ' },
        { type: 'text', text: 'project://prj_2' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '一条要点' }] }],
        },
      ],
    },
  ],
}

describe('document text projection', () => {
  it('flattens headings, paragraphs and lists', () => {
    expect(extractText(doc)).toBe('标题 关联 task://tsk_1 与 project://prj_2 一条要点')
    expect(extractText(null)).toBe('')
  })
})

describe('document links', () => {
  it('extracts unique task/project/document references', () => {
    const links = extractLinks({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'task://tsk_1 project://prj_2 document://doc_3 task://tsk_1' },
          ],
        },
      ],
    })
    expect(links).toEqual([
      { targetType: 'task', targetId: 'tsk_1' },
      { targetType: 'project', targetId: 'prj_2' },
      { targetType: 'document', targetId: 'doc_3' },
    ])
  })

  it('ignores malformed references', () => {
    expect(extractLinks({ text: 'task:// project//prj_1 document:/doc_2' })).toEqual([])
  })
})
