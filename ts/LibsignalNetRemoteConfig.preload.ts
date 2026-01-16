// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  type Net,
  BuildVariant,
  REMOTE_CONFIG_KEYS as KeysExpectedByLibsignalNet,
} from '@signalapp/libsignal-client/dist/net.js';

import { isProduction } from './util/version.std.js';
import * as RemoteConfig from './RemoteConfig.dom.js';
import type { AddPrefix, ArrayValues } from './types/Util.std.js';
import { createLogger } from './logging/log.std.js';

const log = createLogger('LibsignalNetRemoteConfig');

function convertToDesktopRemoteConfigKey<
  K extends ArrayValues<typeof KeysExpectedByLibsignalNet>,
>(key: K): AddPrefix<K, 'desktop.libsignalNet.'> {
  return `desktop.libsignalNet.${key}`;
}

export function bindRemoteConfigToLibsignalNet(
  libsignalNet: Net,
  appVersion: string
): void {
  // Calls setLibsignalRemoteConfig and is reset when any libsignal remote
  // config key changes. Doing that asynchronously allows the callbacks for
  // multiple keys that are triggered by the same config fetch from the server
  // to be coalesced into a single timeout.
  let reloadRemoteConfig: NodeJS.Immediate | undefined;
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
    reloadRemoteConfig = undefined;
  };

  setLibsignalRemoteConfig();

  KeysExpectedByLibsignalNet.map(convertToDesktopRemoteConfigKey).forEach(
    key => {
      RemoteConfig.onChange(key, () => {
        if (reloadRemoteConfig === undefined) {
          reloadRemoteConfig = setImmediate(setLibsignalRemoteConfig);
        }
      });
    }
  );
}
