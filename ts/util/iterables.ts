// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

export function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    (typeof value === 'object' && value !== null && Symbol.iterator in value) ||
    typeof value === 'string'
  );
}

export function size(iterable: Iterable<unknown>): number {
  // We check for common types as an optimization.
  if (typeof iterable === 'string' || Array.isArray(iterable)) {
    return iterable.length;
  }
  if (iterable instanceof Set || iterable instanceof Map) {
    return iterable.size;
  }

  const iterator = iterable[Symbol.iterator]();

  let result = -1;
  for (let done = false; !done; result += 1) {
    done = Boolean(iterator.next().done);
  }
  return result;
}

export function map<T, ResultT>(
  iterable: Iterable<T>,
  fn: (value: T) => ResultT
): Iterable<ResultT> {
  return new MapIterable(iterable, fn);
}

class MapIterable<T, ResultT> implements Iterable<ResultT> {
  constructor(
    private readonly iterable: Iterable<T>,
    private readonly fn: (value: T) => ResultT
  ) {}

  [Symbol.iterator](): Iterator<ResultT> {
    return new MapIterator(this.iterable[Symbol.iterator](), this.fn);
  }
}

class MapIterator<T, ResultT> implements Iterator<ResultT> {
  constructor(
    private readonly iterator: Iterator<T>,
    private readonly fn: (value: T) => ResultT
  ) {}

  next(): IteratorResult<ResultT> {
    const nextIteration = this.iterator.next();
    if (nextIteration.done) {
      return nextIteration;
    }
    return {
      done: false,
      value: this.fn(nextIteration.value),
    };
  }
}

export function take<T>(iterable: Iterable<T>, amount: number): Iterable<T> {
  return new TakeIterable(iterable, amount);
}

class TakeIterable<T> implements Iterable<T> {
  constructor(
    private readonly iterable: Iterable<T>,
    private readonly amount: number
  ) {}

  [Symbol.iterator](): Iterator<T> {
    return new TakeIterator(this.iterable[Symbol.iterator](), this.amount);
  }
}

class TakeIterator<T> implements Iterator<T> {
  constructor(private readonly iterator: Iterator<T>, private amount: number) {}

  next(): IteratorResult<T> {
    const nextIteration = this.iterator.next();
    if (nextIteration.done || this.amount === 0) {
      return { done: true, value: undefined };
    }
    this.amount -= 1;
    return nextIteration;
  }
}
