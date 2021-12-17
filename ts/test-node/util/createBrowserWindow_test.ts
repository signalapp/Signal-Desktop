// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { BrowserWindow } from 'electron';

import { createBrowserWindow } from '../../util/createBrowserWindow';

describe('createBrowserWindow', () => {
  it('returns a BrowserWindow', () => {
    const result = createBrowserWindow({ show: false });
    assert.instanceOf(result, BrowserWindow);
  });
});
