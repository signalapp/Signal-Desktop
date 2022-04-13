// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get, throttle } from 'lodash';

import type { WebAPIType } from './textsecure/WebAPI';
import * as log from './logging/log';

export type ConfigKeyType =
  | 'desktop.announcementGroup'
  | 'desktop.calling.audioLevelForSpeaking'
  | 'desktop.clientExpiration'
  | 'desktop.groupCallOutboundRing'
  | 'desktop.internalUser'
  | 'desktop.mandatoryProfileSharing'
  | 'desktop.mediaQuality.levels'
  | 'desktop.messageCleanup'
  | 'desktop.messageRequests'
  | 'desktop.retryReceiptLifespan'
  | 'desktop.retryRespondMaxAge'
  | 'desktop.senderKey.retry'
  | 'desktop.senderKey.send'
  | 'desktop.senderKeyMaxAge'
  | 'desktop.sendSenderKey3'
  | 'desktop.showUserBadges.beta'
  | 'desktop.showUserBadges2'
  | 'desktop.stories'
  | 'desktop.usernames'
  | 'global.attachments.maxBytes'
  | 'global.calling.maxGroupCallRingSize'
  | 'global.groupsv2.groupSizeHardLimit'
  | 'global.groupsv2.maxGroupSize';
type ConfigValueType = {
  name: ConfigKeyType;
  enabled: boolean;
  enabledAt?: number;
  value?: unknown;
};
export type ConfigMapType = {
  [key in ConfigKeyType]?: ConfigValueType;
};
type ConfigListenerType = (value: ConfigValueType) => unknown;
type ConfigListenersMapType = {
  [key: string]: Array<ConfigListenerType>;
};

let config: ConfigMapType = {};
const listeners: ConfigListenersMapType = {};

export async function initRemoteConfig(server: WebAPIType): Promise<void> {
  config = window.storage.get('remoteConfig') || {};
  await maybeRefreshRemoteConfig(server);
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

export const refreshRemoteConfig = async (
  server: WebAPIType
): Promise<void> => {
  const now = Date.now();
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
      log.info(`Remote Config: Flag ${name} has changed`);
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
