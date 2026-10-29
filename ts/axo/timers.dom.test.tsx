// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { _Timers as Timers } from './timers.dom.tsx';

describe('Timers', () => {
  test('add() fires the callback after the given delay', () => {
    vi.useFakeTimers();
    const timers = new Timers();
    const cb1 = vi.fn<() => void>();
    const cb2 = vi.fn<() => void>();

    timers.add(100, cb1);
    timers.add(101, cb2);

    vi.advanceTimersByTime(99);
    expect(cb1).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(cb1).toHaveBeenCalledOnce();

    expect(cb2).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb2).toHaveBeenCalledOnce();
  });

  test('add() returns a cancel function that prevents the callback', () => {
    vi.useFakeTimers();
    const timers = new Timers();
    const cb1 = vi.fn<() => void>();
    const cb2 = vi.fn<() => void>();

    const cancel1 = timers.add(100, cb1);
    const cancel2 = timers.add(200, cb2);

    cancel1();

    vi.advanceTimersByTime(200);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();

    expect(() => cancel2()).not.toThrow();
  });

  test('cancelAll() cancels every still pending timer', () => {
    vi.useFakeTimers();
    const timers = new Timers();
    const cb1 = vi.fn<() => void>();
    const cb2 = vi.fn<() => void>();
    const cb3 = vi.fn<() => void>();

    timers.add(100, cb1);
    timers.add(200, cb2);
    timers.add(300, cb3);

    vi.advanceTimersByTime(100);
    timers.cancelAll();

    vi.advanceTimersByTime(500);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();
    expect(cb3).not.toHaveBeenCalled();
  });
});
