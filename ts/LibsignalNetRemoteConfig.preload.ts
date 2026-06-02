// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  type Net,
  BuildVariant,
  REMOTE_CONFIG_KEYS as KeysExpectedByLibsignalNet,
} from '@signalapp/libsignal-client/dist/net.js';

import { isProduction } from './util/version.std.ts';
import { drop } from './util/drop.std.ts';
import * as RemoteConfig from './RemoteConfig.dom.ts';
import type { AddPrefix, ArrayValues } from './types/Util.std.ts';
import { createLogger } from './logging/log.std.ts';

const log = createLogger('LibsignalNetRemoteConfig');

function convertToDesktopRemoteConfigKey<
  K extends ArrayValues<typeof KeysExpectedByLibsignalNet>,
>(key: K): AddPrefix<K, 'desktop.libsignalNet.'> {
  return `desktop.libsignalNet.${key}`;
}

export function bindRemoteConfigToLibsignalNet(
  libsignalNet: Net,
  appVersion: string,
  reconnect: () => Promise<void>
): void {
  const libsignalBuildVariant = isProduction(appVersion)
    ? BuildVariant.Production
    : BuildVariant.Beta;

  const setLibsignalRemoteConfig = () => {
    const remoteConfigs = KeysExpectedByLibsignalNet.reduce((output, key) => {
      const value = RemoteConfig.getValue(convertToDesktopRemoteConfigKey(key));
      if (value !== undefined) {
        output.set(key, value);
      }
      return output;
    }, new Map<(typeof KeysExpectedByLibsignalNet)[number], string>());

    log.info(
      'Setting libsignal-net remote config',
      Object.fromEntries(remoteConfigs)
    );
    libsignalNet.setRemoteConfig(remoteConfigs, libsignalBuildVariant);
  };

  setLibsignalRemoteConfig();

  RemoteConfig.onChange(
    KeysExpectedByLibsignalNet.map(convertToDesktopRemoteConfigKey),
    () => {
      setLibsignalRemoteConfig();

      // When linking for the first time in mock tests we start with an empty
      // remote config and fetch the latest values only when we connect the
      // socket. However, new values won't be applied until we reconnect so
      // we need to reconnect immediately to use remote config dependent
      // features like gRPC.
      if (window.SignalCI) {
        log.info('Reconnecting socket after remote config change');
        drop(reconnect());
      }
    }
  );
}
