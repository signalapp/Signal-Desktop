// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Bytes } from './Bytes';
import { NativeThemeListener, MinimalIPC } from './NativeThemeListener';

export class Context {
  public readonly bytes = new Bytes();

  public readonly nativeThemeListener;

  constructor(ipc: MinimalIPC) {
    this.nativeThemeListener = new NativeThemeListener(ipc, window);
  }
}
