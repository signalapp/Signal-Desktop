// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { EventEmitter } from 'events';

import type {
  MinimalIPC,
  SystemThemeHolder,
} from '../../context/createNativeThemeListener';
import { createNativeThemeListener } from '../../context/createNativeThemeListener';
import type { NativeThemeState } from '../../types/NativeThemeNotifier.d';

class FakeIPC extends EventEmitter implements MinimalIPC {
  constructor(private readonly state: NativeThemeState) {
    super();
  }

  public sendSync(channel: string) {
    assert.strictEqual(channel, 'native-theme:init');
    return this.state;
  }

  public send() {
    throw new Error(
      'This should not be called. It is only here to satisfy the interface'
    );
  }
}

describe('NativeThemeListener', () => {
  const holder: SystemThemeHolder = { systemTheme: 'dark' };

  it('syncs the initial native theme', () => {
    const dark = createNativeThemeListener(
      new FakeIPC({
        shouldUseDarkColors: true,
      }),
      holder
    );

    assert.strictEqual(holder.systemTheme, 'dark');
    assert.strictEqual(dark.getSystemTheme(), 'dark');

    const light = createNativeThemeListener(
      new FakeIPC({
        shouldUseDarkColors: false,
      }),
      holder
    );

    assert.strictEqual(holder.systemTheme, 'light');
    assert.strictEqual(light.getSystemTheme(), 'light');
  });

  it('should react to native theme changes', () => {
    const ipc = new FakeIPC({
      shouldUseDarkColors: true,
    });

    const listener = createNativeThemeListener(ipc, holder);

    ipc.emit('native-theme:changed', null, <NativeThemeState>{
      shouldUseDarkColors: false,
    });

    assert.strictEqual(holder.systemTheme, 'light');
    assert.strictEqual(listener.getSystemTheme(), 'light');
  });

  it('should notify subscribers of native theme changes', done => {
    const ipc = new FakeIPC({
      shouldUseDarkColors: true,
    });

    const listener = createNativeThemeListener(ipc, holder);

    listener.subscribe(state => {
      assert.isFalse(state.shouldUseDarkColors);
      done();
    });

    ipc.emit('native-theme:changed', null, <NativeThemeState>{
      shouldUseDarkColors: false,
    });
  });
});
