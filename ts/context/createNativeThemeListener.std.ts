// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { NativeThemeState } from '../types/NativeThemeNotifier.d.ts';
import { SystemThemeType } from '../types/Util.std.js';

export type Callback = (change: NativeThemeState) => void;

// oxlint-disable-next-line typescript/consistent-type-definitions
export interface MinimalIPC {
  // oxlint-disable-next-line typescript/no-explicit-any
  send(channel: string, ...args: ReadonlyArray<any>): void;

  // oxlint-disable-next-line typescript/no-explicit-any
  sendSync(channel: string): any;

  on(
    channel: string,
    // oxlint-disable-next-line typescript/no-explicit-any
    listener: (event: unknown, ...args: ReadonlyArray<any>) => void
  ): this;
}
export type SystemThemeHolder = { systemTheme: SystemThemeType };

export type NativeThemeType = {
  getSystemTheme: () => SystemThemeType;
  subscribe: (fn: Callback) => void;
  unsubscribe: (fn: Callback) => void;
  update: () => SystemThemeType;
};

export function createNativeThemeListener(
  ipc: MinimalIPC,
  holder: SystemThemeHolder
): NativeThemeType {
  const subscribers = new Array<Callback>();

  let theme = ipc.sendSync('native-theme:init');
  let systemTheme: SystemThemeType;

  function update(): SystemThemeType {
    const nextSystemTheme = theme.shouldUseDarkColors
      ? SystemThemeType.dark
      : SystemThemeType.light;
    // oxlint-disable-next-line no-param-reassign
    holder.systemTheme = nextSystemTheme;
    return nextSystemTheme;
  }

  function subscribe(fn: Callback): void {
    subscribers.push(fn);
  }

  function unsubscribe(fn: Callback): void {
    const index = subscribers.indexOf(fn);

    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  }

  ipc.on(
    'native-theme:changed',
    (_event: unknown, change: NativeThemeState) => {
      theme = change;
      systemTheme = update();

      for (const fn of subscribers) {
        fn(change);
      }
    }
  );

  systemTheme = update();

  return {
    getSystemTheme: () => systemTheme,
    subscribe,
    unsubscribe,
    update,
  };
}
