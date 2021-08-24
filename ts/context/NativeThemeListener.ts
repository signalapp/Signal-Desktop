// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

import { NativeThemeState } from '../types/NativeThemeNotifier.d';

export type Callback = (change: NativeThemeState) => void;

export interface MinimalIPC {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendSync(channel: string): any;

  on(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (event: unknown, ...args: ReadonlyArray<any>) => void
  ): this;
}

export type SystemThemeHolder = { systemTheme: 'dark' | 'light' };

export class NativeThemeListener {
  private readonly subscribers = new Array<Callback>();

  public theme: NativeThemeState;

  constructor(ipc: MinimalIPC, private readonly holder: SystemThemeHolder) {
    this.theme = ipc.sendSync('native-theme:init');
    this.update();

    ipc.on(
      'native-theme:changed',
      (_event: unknown, change: NativeThemeState) => {
        this.theme = change;
        this.update();

        for (const fn of this.subscribers) {
          fn(change);
        }
      }
    );
  }

  public subscribe(fn: Callback): void {
    this.subscribers.push(fn);
  }

  private update(): void {
    this.holder.systemTheme = this.theme.shouldUseDarkColors ? 'dark' : 'light';
  }
}
