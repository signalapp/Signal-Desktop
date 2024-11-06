// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

import type { NativeThemeState } from '../types/NativeThemeNotifier.d';
import { SystemThemeType } from '../types/Util';

export type Callback = (change: NativeThemeState) => void;

export interface MinimalIPC {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(channel: string, ...args: ReadonlyArray<any>): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendSync(channel: string): any;

  on(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line no-param-reassign
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
