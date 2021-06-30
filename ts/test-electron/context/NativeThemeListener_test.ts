// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { EventEmitter } from 'events';

import {
  NativeThemeListener,
  MinimalIPC,
  SystemThemeHolder,
} from '../../context/NativeThemeListener';
import { NativeThemeState } from '../../types/NativeThemeNotifier.d';

class FakeIPC extends EventEmitter implements MinimalIPC {
  constructor(private readonly state: NativeThemeState) {
    super();
  }

  public sendSync(channel: string) {
    assert.strictEqual(channel, 'native-theme:init');
    return this.state;
  }
}

describe('NativeThemeListener', () => {
  const holder: SystemThemeHolder = { systemTheme: 'dark' };

  it('syncs the initial native theme', () => {
    const dark = new NativeThemeListener(
      new FakeIPC({
        shouldUseDarkColors: true,
      }),
      holder
    );

    assert.strictEqual(holder.systemTheme, 'dark');
    assert.isTrue(dark.theme.shouldUseDarkColors);

    const light = new NativeThemeListener(
      new FakeIPC({
        shouldUseDarkColors: false,
      }),
      holder
    );

    assert.strictEqual(holder.systemTheme, 'light');
    assert.isFalse(light.theme.shouldUseDarkColors);
  });

  it('should react to native theme changes', () => {
    const ipc = new FakeIPC({
      shouldUseDarkColors: true,
    });

    const listener = new NativeThemeListener(ipc, holder);

    ipc.emit('native-theme:changed', null, <NativeThemeState>{
      shouldUseDarkColors: false,
    });

    assert.strictEqual(holder.systemTheme, 'light');
    assert.isFalse(listener.theme.shouldUseDarkColors);
  });

  it('should notify subscribers of native theme changes', done => {
    const ipc = new FakeIPC({
      shouldUseDarkColors: true,
    });

    const listener = new NativeThemeListener(ipc, holder);

    listener.subscribe(state => {
      assert.isFalse(state.shouldUseDarkColors);
      done();
    });

    ipc.emit('native-theme:changed', null, <NativeThemeState>{
      shouldUseDarkColors: false,
    });
  });
});
