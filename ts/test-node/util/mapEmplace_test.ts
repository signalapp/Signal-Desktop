// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import assert from 'node:assert/strict';
import type { MapEmplaceOptions } from '../../util/mapEmplace';
import { mapEmplace } from '../../util/mapEmplace';

type InsertFn = NonNullable<MapEmplaceOptions<Map<object, object>>['insert']>;
type UpdateFn = NonNullable<MapEmplaceOptions<Map<object, object>>['update']>;

describe('mapEmplace', () => {
  it('should insert and not update when key not present', () => {
    const map = new Map<object, object>();
    const key = { key: true };
    const insertValue = { value: 'insertValue' };
    const updateValue = { value: 'updateValue' };
    const insert = sinon.spy<InsertFn>(() => insertValue);
    const update = sinon.spy<UpdateFn>(() => updateValue);

    const resultValue = mapEmplace(map, key, { insert, update });

    assert.equal(resultValue, insertValue);
    assert.equal(map.get(key), insertValue);
    assert.equal(insert.callCount, 1);
    assert.equal(insert.calledWithExactly(key, map), true);
    assert.equal(update.callCount, 0);
  });

  it('should not insert when key present', () => {
    const map = new Map<object, object>();
    const key = { key: true };
    const currentValue = { value: 'currentValue' };
    const insertValue = { value: 'insertValue' };
    const insert = sinon.spy<InsertFn>(() => insertValue);

    map.set(key, currentValue);
    const resultValue = mapEmplace(map, key, { insert });

    assert.equal(resultValue, currentValue);
    assert.equal(map.get(key), currentValue);
    assert.equal(insert.callCount, 0);
  });

  it('should update when key present', () => {
    const map = new Map<object, object>();
    const key = { key: true };
    const currentValue = { value: 'currentValue' };
    const insertValue = { value: 'insertValue' };
    const updateValue = { value: 'updateValue' };
    const insert = sinon.spy<InsertFn>(() => insertValue);
    const update = sinon.spy<UpdateFn>(() => updateValue);

    map.set(key, currentValue);
    const resultValue = mapEmplace(map, key, { insert, update });

    assert.equal(resultValue, updateValue);
    assert.equal(map.get(key), updateValue);
    assert.equal(insert.callCount, 0);
    assert.equal(update.callCount, 1);
    assert.equal(update.calledWithExactly(currentValue, key, map), true);
  });

  it('should throw when key not present and no insert provided', () => {
    const map = new Map<object, object>();
    const key = { key: true };
    const updateValue = { value: 'updateValue' };
    const update = sinon.spy<UpdateFn>(() => updateValue);

    assert.throws(() => {
      mapEmplace(map, key, { update });
    });

    assert.equal(map.has(key), false);
    assert.equal(update.callCount, 0);
  });

  it('should return value unmodified when update not provided', () => {
    const map = new Map<object, object>();
    const key = { key: true };
    const currentValue = { value: 'currentValue' };
    const insertValue = { value: 'insertValue' };
    const insert = sinon.spy<InsertFn>(() => insertValue);

    map.set(key, currentValue);
    const resultValue = mapEmplace(map, key, { insert });

    assert.equal(resultValue, currentValue);
    assert.equal(map.get(key), currentValue);
    assert.equal(insert.callCount, 0);
  });
});
