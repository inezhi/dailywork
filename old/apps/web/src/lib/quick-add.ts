import type { CreateTaskInput } from '@daily/contracts'
import { addDays, todayIso } from './format'

const PRIORITY_TOKENS: Record<string, CreateTaskInput['priority']> = {
  '!1': 'urgent',
  '!2': 'high',
  '!3': 'medium',
  '!4': 'low',
}

export interface QuickAddParse {
  title: string
  tags: string[]
  priority?: CreateTaskInput['priority']
  scheduledDate?: string
}

/**
 * Parse the quick-add grammar used on Today: #tag, !1–!4 priority,
 * @today / @tomorrow / @YYYY-MM-DD. Everything else becomes the title.
 */
export function parseQuickAdd(raw: string): QuickAddParse {
  const tags: string[] = []
  let priority: CreateTaskInput['priority'] | undefined
  let scheduledDate: string | undefined
  const words: string[] = []
  for (const token of raw.trim().split(/\s+/)) {
    if (token.startsWith('#') && token.length > 1) {
      tags.push(token.slice(1))
      continue
    }
    if (PRIORITY_TOKENS[token]) {
      priority = PRIORITY_TOKENS[token]
      continue
    }
    const lowered = token.toLowerCase()
    if (lowered === '@today' || token === '@今天') {
      scheduledDate = todayIso()
      continue
    }
    if (lowered === '@tomorrow' || token === '@明天') {
      scheduledDate = addDays(todayIso(), 1)
      continue
    }
    if (/^@\d{4}-\d{2}-\d{2}$/.test(token)) {
      scheduledDate = token.slice(1)
      continue
    }
    words.push(token)
  }
  return { title: words.join(' '), tags: [...new Set(tags)], priority, scheduledDate }
}
