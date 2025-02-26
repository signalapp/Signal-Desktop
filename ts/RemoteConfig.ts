// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get, throttle } from 'lodash';

import type { WebAPIType } from './textsecure/WebAPI';
import * as log from './logging/log';
import type { AciString } from './types/ServiceId';
import { parseIntOrThrow } from './util/parseIntOrThrow';
import { HOUR } from './util/durations';
import * as Bytes from './Bytes';
import { uuidToBytes } from './util/uuidToBytes';
import { dropNull } from './util/dropNull';
import { HashType } from './types/Crypto';
import { getCountryCode } from './types/PhoneNumber';
import { parseRemoteClientExpiration } from './util/parseRemoteClientExpiration';

export type ConfigKeyType =
  | 'desktop.calling.ringrtcAdmFull.2'
  | 'desktop.calling.ringrtcAdmInternal'
  | 'desktop.calling.ringrtcAdmPreStable'
  | 'desktop.clientExpiration'
  | 'desktop.backup.credentialFetch'
  | 'desktop.internalUser'
  | 'desktop.mediaQuality.levels'
  | 'desktop.messageCleanup'
  | 'desktop.retryRespondMaxAge'
  | 'desktop.senderKey.retry'
  | 'desktop.senderKeyMaxAge'
  | 'desktop.experimentalTransport.enableAuth'
  | 'desktop.experimentalTransportEnabled.alpha'
  | 'desktop.experimentalTransportEnabled.beta'
  | 'desktop.experimentalTransportEnabled.prod'
  | 'desktop.cdsiViaLibsignal'
  | 'desktop.cdsiViaLibsignal.libsignalRouteBasedCDSILookup'
  | 'desktop.funPicker'
  | 'desktop.releaseNotes'
  | 'desktop.releaseNotes.beta'
  | 'desktop.releaseNotes.dev'
  | 'global.attachments.maxBytes'
  | 'global.attachments.maxReceiveBytes'
  | 'global.calling.maxGroupCallRingSize'
  | 'global.groupsv2.groupSizeHardLimit'
  | 'global.groupsv2.maxGroupSize'
  | 'global.messageQueueTimeInSeconds'
  | 'global.nicknames.max'
  | 'global.nicknames.min'
  | 'global.textAttachmentLimitBytes';

type ConfigValueType = {
  name: ConfigKeyType;
  enabled: boolean;
  enabledAt?: number;
  value?: string;
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

export function restoreRemoteConfigFromStorage(): void {
  config = window.storage.get('remoteConfig') || {};
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

export const _refreshRemoteConfig = async (
  server: WebAPIType
): Promise<void> => {
  const now = Date.now();
  const { config: newConfig, serverTimestamp } = await server.getConfig();

  const serverTimeSkew = serverTimestamp - now;

  if (Math.abs(serverTimeSkew) > HOUR) {
    log.warn(
      'Remote Config: severe clock skew detected. ' +
        `Server time ${serverTimestamp}, local time ${now}`
    );
  }

  // Process new configuration in light of the old configuration
  // The old configuration is not set as the initial value in reduce because
  // flags may have been deleted
  const oldConfig = config;
  config = newConfig.reduce((acc, { name, enabled, value }) => {
    const previouslyEnabled: boolean = get(oldConfig, [name, 'enabled'], false);
    const previousValue: string | undefined = get(
      oldConfig,
      [name, 'value'],
      undefined
    );
    // If a flag was previously not enabled and is now enabled,
    // record the time it was enabled
    const enabledAt: number | undefined =
      previouslyEnabled && enabled ? now : get(oldConfig, [name, 'enabledAt']);

    const configValue = {
      name: name as ConfigKeyType,
      enabled,
      enabledAt,
      value: dropNull(value),
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

  const remoteExpirationValue = getValue('desktop.clientExpiration');
  if (!remoteExpirationValue) {
    // If remote configuration fetch worked - we are not expired anymore.
    if (window.storage.get('remoteBuildExpiration') != null) {
      log.warn('Remote Config: clearing remote expiration on successful fetch');
    }
    await window.storage.remove('remoteBuildExpiration');
  } else {
    const remoteBuildExpirationTimestamp = parseRemoteClientExpiration(
      remoteExpirationValue
    );
    if (remoteBuildExpirationTimestamp) {
      await window.storage.put(
        'remoteBuildExpiration',
        remoteBuildExpirationTimestamp
      );
    }
  }

  await window.storage.put('remoteConfig', config);
  await window.storage.put('serverTimeSkew', serverTimeSkew);
};

export const maybeRefreshRemoteConfig = throttle(
  _refreshRemoteConfig,
  // Only fetch remote configuration if the last fetch was more than two hours ago
  2 * 60 * 60 * 1000,
  { trailing: false }
);

export async function forceRefreshRemoteConfig(
  server: WebAPIType,
  reason: string
): Promise<void> {
  log.info(`forceRefreshRemoteConfig: ${reason}`);
  maybeRefreshRemoteConfig.cancel();
  await _refreshRemoteConfig(server);
}

export function isEnabled(name: ConfigKeyType): boolean {
  return get(config, [name, 'enabled'], false);
}

export function getValue(name: ConfigKeyType): string | undefined {
  return get(config, [name, 'value'], undefined);
}

// See isRemoteConfigBucketEnabled in selectors/items.ts
export function isBucketValueEnabled(
  name: ConfigKeyType,
  e164: string | undefined,
  aci: AciString | undefined
): boolean {
  return innerIsBucketValueEnabled(name, getValue(name), e164, aci);
}

export function innerIsBucketValueEnabled(
  name: ConfigKeyType,
  flagValue: unknown,
  e164: string | undefined,
  aci: AciString | undefined
): boolean {
  if (e164 == null || aci == null) {
    return false;
  }

  const countryCode = getCountryCode(e164);
  if (countryCode == null) {
    return false;
  }

  if (typeof flagValue !== 'string') {
    return false;
  }

  const remoteConfigValue = getCountryCodeValue(countryCode, flagValue, name);
  if (remoteConfigValue == null) {
    return false;
  }

  const bucketValue = getBucketValue(aci, name);
  return bucketValue < remoteConfigValue;
}

export function getCountryCodeValue(
  countryCode: number,
  flagValue: string,
  flagName: string
): number | undefined {
  const logId = `getCountryCodeValue/${flagName}`;
  if (flagValue.length === 0) {
    return undefined;
  }

  const countryCodeString = countryCode.toString();
  const items = flagValue.split(',');

  let wildcard: number | undefined;
  for (const item of items) {
    const [code, value] = item.split(':');
    if (code == null || value == null) {
      log.warn(`${logId}: '${code}:${value}' entry was invalid`);
      continue;
    }

    const parsedValue = parseIntOrThrow(
      value,
      `${logId}: Country code '${code}' had an invalid number '${value}'`
    );
    if (code === '*') {
      wildcard = parsedValue;
    } else if (countryCodeString === code) {
      return parsedValue;
    }
  }

  return wildcard;
}

export function getBucketValue(aci: AciString, flagName: string): number {
  const hashInput = Bytes.concatenate([
    Bytes.fromString(`${flagName}.`),
    uuidToBytes(aci),
  ]);
  const hashResult = window.SignalContext.crypto.hash(
    HashType.size256,
    hashInput
  );

  return Number(Bytes.readBigUint64BE(hashResult.slice(0, 8)) % 1_000_000n);
}
