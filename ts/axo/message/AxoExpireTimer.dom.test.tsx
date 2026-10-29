// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { DurationSecs, TimestampMs } from '@signalapp/types';
import { AxoExpireTimer } from './AxoExpireTimer.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { _getAxoSymbolInlineGlyph } from '../_internal/AxoSymbolDefs.generated.std.ts';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoExpireTimer.dom.stories.tsx';

const NOW = new Date('2026-01-15T12:00:00Z');

function getGlyph(symbol: AxoSymbol.Name): string {
  return _getAxoSymbolInlineGlyph(symbol, 'ltr');
}

function getRenderedGlyph(): string | null {
  return (
    page
      .getByRole('timer')
      .element()
      .querySelector('[data-axo-symbol-glyph]')
      ?.getAttribute('data-axo-symbol-glyph') ?? null
  );
}

const COUNTDOWN_SYMBOLS: ReadonlyArray<AxoSymbol.Name> = [
  'timer-countdown-11',
  'timer-countdown-10',
  'timer-countdown-9',
  'timer-countdown-8',
  'timer-countdown-7',
  'timer-countdown-6',
  'timer-countdown-5',
  'timer-countdown-4',
  'timer-countdown-3',
  'timer-countdown-2',
  'timer-countdown-1',
  'timer-countdown-0',
];

describe('AxoExpireTimer', () => {
  testStoriesWithAxe(stories);

  test('counts down until the message expires', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
      now: NOW,
    });
    await renderAxo(
      <AxoExpireTimer.Root
        expireTimer={{
          // 12 steps of 1 second each
          duration: DurationSecs.fromSeconds(12),
          startedAt: TimestampMs.now(),
        }}
      />
    );
    await expect.poll(getRenderedGlyph).toBe(getGlyph('timer-countdown-12'));

    // The next update is only scheduled after re-rendering, so advance one
    // step at a time.
    for (const symbol of COUNTDOWN_SYMBOLS) {
      vi.advanceTimersByTime(1000);
      // oxlint-disable-next-line no-await-in-loop
      await expect.poll(getRenderedGlyph).toBe(getGlyph(symbol));
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  test('does not count down before the timer starts', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
      now: NOW,
    });
    await renderAxo(
      <AxoExpireTimer.Root
        expireTimer={{
          duration: DurationSecs.fromSeconds(12),
          startedAt: null,
        }}
      />
    );
    await expect.poll(getRenderedGlyph).toBe(getGlyph('timer-countdown-12'));
    expect(vi.getTimerCount()).toBe(0);
  });

  test('handles timers that started a long time ago', () => {
    const now = TimestampMs.fromNumber(NOW.getTime());
    const sixtyDaysAgo = TimestampMs.fromNumber(
      NOW.getTime() - 60 * 24 * 60 * 60 * 1000
    );
    const state = AxoExpireTimer._getExpireTimerState(
      {
        duration: DurationSecs.fromSeconds(7 * 24 * 60 * 60),
        startedAt: sixtyDaysAgo,
      },
      now
    );
    expect(state).toStrictEqual({
      symbol: 'timer-countdown-0',
      updateAt: null,
    });
  });
});
