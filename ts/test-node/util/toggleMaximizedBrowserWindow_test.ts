// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import type { BrowserWindow } from 'electron';

import { toggleMaximizedBrowserWindow } from '../../util/toggleMaximizedBrowserWindow.std.js';

describe('toggleMaximizedBrowserWindow', () => {
  const createFakeWindow = () => ({
    isMaximized: sinon.stub(),
    unmaximize: sinon.spy(),
    maximize: sinon.spy(),
  });

  it('maximizes an unmaximized window', () => {
    const browserWindow = createFakeWindow();
    browserWindow.isMaximized.returns(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toggleMaximizedBrowserWindow(browserWindow as any as BrowserWindow);

    sinon.assert.calledOnce(browserWindow.maximize);
    sinon.assert.notCalled(browserWindow.unmaximize);
  });

  it('unmaximizes a maximized window', () => {
    const browserWindow = createFakeWindow();
    browserWindow.isMaximized.returns(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toggleMaximizedBrowserWindow(browserWindow as any as BrowserWindow);

    sinon.assert.notCalled(browserWindow.maximize);
    sinon.assert.calledOnce(browserWindow.unmaximize);
  });
});
