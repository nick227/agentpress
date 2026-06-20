import { describe, expect, it } from 'vitest'
import { evaluateFreshness } from './scheduleFreshness'

describe('evaluateFreshness', () => {
  it('always dispatches unconditional actions', () => {
    expect(evaluateFreshness('always', [], new Set(), {})).toEqual({ shouldRun: true })
  })

  it('runs when any relevant successfully checked feed has a new item', () => {
    expect(evaluateFreshness(
      'selected_feeds_new',
      ['feed-a', 'feed-b'],
      new Set(['feed-a', 'feed-b']),
      { 'feed-b': ['item-2'] },
    )).toEqual({ shouldRun: true })
  })

  it('does not treat failed checks or empty windows as fresh', () => {
    expect(evaluateFreshness('any_checked_feed_new', ['feed-a'], new Set(), { 'feed-a': ['item-1'] })).toEqual({
      shouldRun: false,
      reason: 'No research feeds checked successfully',
    })
    expect(evaluateFreshness('any_checked_feed_new', ['feed-a'], new Set(['feed-a']), {})).toEqual({
      shouldRun: false,
      reason: 'No new content',
    })
  })

  it('lets independent actions react to the same eligible item', () => {
    const eligible = { 'feed-a': ['shared-item'] }
    expect(evaluateFreshness('selected_feeds_new', ['feed-a'], new Set(['feed-a']), eligible).shouldRun).toBe(true)
    expect(evaluateFreshness('selected_feeds_new', ['feed-a'], new Set(['feed-a']), eligible).shouldRun).toBe(true)
  })
})

