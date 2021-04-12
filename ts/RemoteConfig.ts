// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get, throttle } from 'lodash';
import { WebAPIType } from './textsecure/WebAPI';

export type ConfigKeyType =
  | 'desktop.cds'
  | 'desktop.clientExpiration'
  | 'desktop.disableGV1'
  | 'desktop.groupCalling'
  | 'desktop.gv2'
  | 'desktop.mandatoryProfileSharing'
  | 'desktop.messageRequests'
  | 'desktop.storage'
  | 'desktop.storageWrite3'
  | 'global.groupsv2.maxGroupSize'
  | 'global.groupsv2.groupSizeHardLimit';
type ConfigValueType = {
  name: ConfigKeyType;
  enabled: boolean;
  enabledAt?: number;
  value?: unknown;
};
type ConfigMapType = { [key: string]: ConfigValueType };
type ConfigListenerType = (value: ConfigValueType) => unknown;
type ConfigListenersMapType = {
  [key: string]: Array<ConfigListenerType>;
};

function getServer(): WebAPIType {
  const OLD_USERNAME = window.storage.get<string>('number_id');
  const USERNAME = window.storage.get<string>('uuid_id');
  const PASSWORD = window.storage.get<string>('password');

  return window.WebAPI.connect({
    username: (USERNAME || OLD_USERNAME) as string,
    password: PASSWORD as string,
  });
}

let config: ConfigMapType = {};
const listeners: ConfigListenersMapType = {};

export async function initRemoteConfig(): Promise<void> {
  config = window.storage.get('remoteConfig') || {};
  await maybeRefreshRemoteConfig();
}

export function onChange(
  key: ConfigKeyType,
  fn: ConfigListenerType
): () => void {
  const keyListeners: Array<ConfigListenerType> = get(listeners, key, []);
  keyListeners.push(fn);
  listeners[key] = keyListeners;

  return () => {
    listeners[key] = listeners[key].filter(l => l !== fn);
  };
}

export const refreshRemoteConfig = async (): Promise<void> => {
  const now = Date.now();
  const server = getServer();
  const newConfig = await server.getConfig();

  // Process new configuration in light of the old configuration
  // The old configuration is not set as the initial value in reduce because
  // flags may have been deleted
  const oldConfig = config;
  config = newConfig.reduce((acc, { name, enabled, value }) => {
    const previouslyEnabled: boolean = get(oldConfig, [name, 'enabled'], false);
    const previousValue: unknown = get(oldConfig, [name, 'value'], undefined);
    // If a flag was previously not enabled and is now enabled,
    // record the time it was enabled
    const enabledAt: number | undefined =
      previouslyEnabled && enabled ? now : get(oldConfig, [name, 'enabledAt']);

    const configValue = {
      name: name as ConfigKeyType,
      enabled,
      enabledAt,
      value,
    };

    const hasChanged =
      previouslyEnabled !== enabled || previousValue !== configValue.value;

    // If enablement changes at all, notify listeners
    const currentListeners = listeners[name] || [];
    if (hasChanged) {
      window.log.info(`Remote Config: Flag ${name} has changed`);
      currentListeners.forEach(listener => {
        listener(configValue);
      });
    }

    // Return new configuration object
    return {
      ...acc,
      [name]: configValue,
    };
  }, {});

  window.storage.put('remoteConfig', config);
};

export const maybeRefreshRemoteConfig = throttle(
  refreshRemoteConfig,
  // Only fetch remote configuration if the last fetch was more than two hours ago
  2 * 60 * 60 * 1000,
  { trailing: false }
);

export function isEnabled(name: ConfigKeyType): boolean {
  return get(config, [name, 'enabled'], false);
}

export function getValue(name: ConfigKeyType): string | undefined {
  return get(config, [name, 'value'], undefined);
}
