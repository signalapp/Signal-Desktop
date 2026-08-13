// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { DurationMs, type DurationSecs, TimestampMs } from '@signalapp/types';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { type FC, memo, useEffect, useMemo, useState } from 'react';
import { type AxoIntl, useAxoIntl } from '../_internal/AxoIntl.dom.tsx';

export namespace AxoExpireTimer {
  export type ExpireTimer = Readonly<{
    duration: DurationSecs;
    startedAt: TimestampMs | null;
  }>;

  function getExpireTimerExpiresAt(
    expireTimer: ExpireTimer
  ): TimestampMs | null {
    if (expireTimer.startedAt == null) {
      return null;
    }
    const durationMs = DurationMs.fromDurationSecs(expireTimer.duration);
    return TimestampMs.fromNumber(expireTimer.startedAt + durationMs);
  }

  function getExpireTimerIntervalIndexSymbol(
    intervalIndex: number
  ): AxoSymbol.Name {
    if (intervalIndex <= 0) {
      return 'timer-countdown-12';
    }
    if (intervalIndex === 1) {
      return 'timer-countdown-11';
    }
    if (intervalIndex === 2) {
      return 'timer-countdown-10';
    }
    if (intervalIndex === 3) {
      return 'timer-countdown-9';
    }
    if (intervalIndex === 4) {
      return 'timer-countdown-8';
    }
    if (intervalIndex === 5) {
      return 'timer-countdown-7';
    }
    if (intervalIndex === 6) {
      return 'timer-countdown-6';
    }
    if (intervalIndex === 7) {
      return 'timer-countdown-5';
    }
    if (intervalIndex === 8) {
      return 'timer-countdown-4';
    }
    if (intervalIndex === 9) {
      return 'timer-countdown-3';
    }
    if (intervalIndex === 10) {
      return 'timer-countdown-2';
    }
    if (intervalIndex === 11) {
      return 'timer-countdown-1';
    }
    return 'timer-countdown-0';
  }

  type ExpireTimerState = Readonly<{
    symbol: AxoSymbol.Name;
    updateAt: TimestampMs | null;
  }>;

  /** @testexport */
  export function _getExpireTimerState(
    expireTimer: ExpireTimer,
    now: TimestampMs
  ): ExpireTimerState {
    if (expireTimer.startedAt == null) {
      return { symbol: 'timer-countdown-12', updateAt: null };
    }

    const durationMs = DurationMs.fromDurationSecs(expireTimer.duration);
    const interval = DurationMs.fromMilliseconds(Math.ceil(durationMs / 12));
    const offset = DurationMs.fromMilliseconds(
      Math.max(0, now - expireTimer.startedAt)
    );

    const currentIndex = Math.floor(offset / interval);
    const nextIndex = currentIndex + 1;

    const symbol = getExpireTimerIntervalIndexSymbol(currentIndex);

    if (nextIndex > 12) {
      return { symbol, updateAt: null };
    }

    const updateAt = TimestampMs.fromNumber(
      expireTimer.startedAt + interval * nextIndex
    );

    return { symbol, updateAt };
  }

  export function _getExpireTimerLabel(
    intl: AxoIntl.ContextType,
    expireTimer: ExpireTimer
  ): string {
    const expiresAt = getExpireTimerExpiresAt(expireTimer);
    // TODO: This should return relative time format in units of
    // days/hours/minutes that updates at the same intervals.
    return new Intl.DateTimeFormat(
      Array.from(intl.systemPreferredLanguages)
    ).format(expiresAt ?? Date.now());
  }

  /**
   * <AxoExpireTimer.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    expireTimer: ExpireTimer;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { expireTimer } = props;
    const intl = useAxoIntl();

    const [now, setNow] = useState(() => TimestampMs.now());

    const state = useMemo((): ExpireTimerState => {
      return _getExpireTimerState(expireTimer, now);
    }, [expireTimer, now]);

    useEffect(() => {
      if (state.updateAt == null) {
        return;
      }

      const delay = DurationMs.fromMilliseconds(
        Math.max(0, state.updateAt - now)
      );

      const timer = setTimeout(() => {
        setNow(TimestampMs.now());
      }, delay);

      return () => {
        clearTimeout(timer);
      };
    }, [state, now]);

    const label = useMemo(() => {
      return _getExpireTimerLabel(intl, expireTimer);
    }, [intl, expireTimer]);

    return (
      <span role="timer" aria-atomic aria-label={label}>
        <AxoSymbol.InlineGlyph symbol={state.symbol} label={null} />
      </span>
    );
  });

  Root.displayName = 'AxoExpireTimer.Root';
}
