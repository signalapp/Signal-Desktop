// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Bytes } from './Bytes';
import { Crypto } from './Crypto';
import {
  createNativeThemeListener,
  MinimalIPC,
} from './createNativeThemeListener';

export class Context {
  public readonly bytes = new Bytes();

  public readonly crypto = new Crypto();

  public readonly nativeThemeListener;

  constructor(ipc: MinimalIPC) {
    this.nativeThemeListener = createNativeThemeListener(ipc, window);
  }
}
