// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import semver from 'semver';
import type { REMOTE_CONFIG_KEYS as KeysExpectedByLibsignalNet } from '@signalapp/libsignal-client/dist/net.js';

import type { getConfig } from './textsecure/WebAPI.preload.js';
import { createLogger } from './logging/log.std.js';
import type { AciString } from './types/ServiceId.std.js';
import { parseIntOrThrow } from './util/parseIntOrThrow.std.js';
import { HOUR } from './util/durations/index.std.js';
import * as Bytes from './Bytes.std.js';
import { uuidToBytes } from './util/uuidToBytes.std.js';
import { HashType } from './types/Crypto.std.js';
import { getCountryCode } from './types/PhoneNumber.std.js';
import { parseRemoteClientExpiration } from './util/parseRemoteClientExpiration.dom.js';
import type { StorageInterface } from './types/Storage.d.ts';
import { ToastType } from './types/Toast.dom.js';
import { assertDev, strictAssert } from './util/assert.std.js';
import type {
  ArrayValues,
  AssertSameMembers,
  StripPrefix,
} from './types/Util.std.js';

const { get, throttle } = lodash;

const log = createLogger('RemoteConfig');

// Semver flags must always be set to a valid semver (no empty enabled-only keys)
const SemverKeys = [
  'desktop.callQualitySurvey.beta',
  'desktop.callQualitySurvey.prod',
  'desktop.donationPaypal.beta',
  'desktop.donationPaypal.prod',
  'desktop.groupMemberLabels.edit.beta',
  'desktop.groupMemberLabels.edit.prod',
  'desktop.pinnedMessages.receive.beta',
  'desktop.pinnedMessages.receive.prod',
  'desktop.pinnedMessages.send.beta',
  'desktop.pinnedMessages.send.prod',
  'desktop.plaintextExport.beta',
  'desktop.plaintextExport.prod',
  'desktop.remoteMegaphone.beta',
  'desktop.remoteMegaphone.prod',
  'desktop.retireAccessKeyGroupSend.beta',
  'desktop.retireAccessKeyGroupSend.prod',
  'desktop.keyTransparency.beta',
  'desktop.keyTransparency.prod',
  'desktop.binaryServiceId.beta',
  'desktop.binaryServiceId.prod',
  'desktop.pollSend1to1.beta',
  'desktop.pollSend1to1.prod',
] as const;

export type SemverKeyType = ArrayValues<typeof SemverKeys>;

const ScalarKeys = [
  'desktop.callQualitySurveyPPM',
  'desktop.chatFolders.alpha',
  'desktop.chatFolders.beta',
  'desktop.chatFolders.prod',
  'desktop.clientExpiration',
  'desktop.backups.beta',
  'desktop.backups.prod',
  'desktop.internalUser',
  'desktop.loggingErrorToasts',
  'desktop.mediaQuality.levels',
  'desktop.messageCleanup',
  'desktop.retryRespondMaxAge',
  'desktop.senderKey.retry',
  'desktop.senderKeyMaxAge',
  'desktop.pollReceive.alpha',
  'desktop.pollReceive.beta1',
  'desktop.pollReceive.prod1',
  'desktop.pollSend.alpha',
  'desktop.pollSend.beta',
  'desktop.pollSend.prod',
  'desktop.recentGifs.allowLegacyTenorCdnUrls',
  'global.attachments.maxBytes',
  'global.attachments.maxReceiveBytes',
  'global.backups.mediaTierFallbackCdnNumber',
  'global.calling.maxGroupCallRingSize',
  'global.groupsv2.groupSizeHardLimit',
  'global.groupsv2.maxGroupSize',
  'global.messageQueueTimeInSeconds',
  'global.nicknames.max',
  'global.nicknames.min',
  'global.pinned_message_limit',
  'global.textAttachmentLimitBytes',
] as const;

// These keys should always match those in Net.REMOTE_CONFIG_KEYS, prefixed by
// `desktop.libsignalNet`
const KnownDesktopLibsignalNetKeys = [
  'desktop.libsignalNet.chatPermessageDeflate.prod',
  'desktop.libsignalNet.chatRequestConnectionCheckTimeoutMillis.beta',
  'desktop.libsignalNet.chatRequestConnectionCheckTimeoutMillis',
  'desktop.libsignalNet.disableNagleAlgorithm.beta',
  'desktop.libsignalNet.disableNagleAlgorithm',
  'desktop.libsignalNet.grpc.AccountsAnonymousLookupUsernameHash.beta',
  'desktop.libsignalNet.grpc.AccountsAnonymousLookupUsernameHash',
  'desktop.libsignalNet.useH2ForUnauthChat.beta',
  'desktop.libsignalNet.useH2ForUnauthChat',
] as const;

type KnownLibsignalKeysType = StripPrefix<
  ArrayValues<typeof KnownDesktopLibsignalNetKeys>,
  'desktop.libsignalNet.'
>;
type ExpectedLibsignalKeysType = ArrayValues<typeof KeysExpectedByLibsignalNet>;

const _assertLibsignalKeysMatch: AssertSameMembers<
  KnownLibsignalKeysType,
  ExpectedLibsignalKeysType
> = true;
strictAssert(_assertLibsignalKeysMatch, 'Libsignal keys match');

const KnownConfigKeys = [
  ...SemverKeys,
  ...ScalarKeys,
  ...KnownDesktopLibsignalNetKeys,
] as const;

export type ConfigKeyType = ArrayValues<typeof KnownConfigKeys>;

type ConfigValueType = {
  name: ConfigKeyType;
  enabledAt?: number;
} & ({ enabled: true; value: string } | { enabled: false; value?: never });
export type ConfigMapType = {
  [key in ConfigKeyType]?: ConfigValueType;
};
export type ConfigListenerType = (value: ConfigValueType) => unknown;
type ConfigListenersMapType = {
  [key: string]: Array<ConfigListenerType>;
};

let config: ConfigMapType | undefined;
const listeners: ConfigListenersMapType = {};

export type OptionsType = Readonly<{
  getConfig: typeof getConfig;
  storage: Pick<StorageInterface, 'get' | 'put' | 'remove'>;
}>;

export function restoreRemoteConfigFromStorage({
  storage,
}: Pick<OptionsType, 'storage'>): void {
  config = storage.get('remoteConfig') || {};
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

export const _refreshRemoteConfig = async ({
  getConfig,
  storage,
}: OptionsType): Promise<void> => {
  const now = Date.now();
  const oldConfigHash = storage.get('remoteConfigHash');

  const {
    config: newConfig,
    serverTimestamp,
    configHash,
  } = await getConfig(oldConfigHash);

  const serverTimeSkew = serverTimestamp - now;

  if (Math.abs(serverTimeSkew) > HOUR) {
    log.warn(
      'Remote Config: severe clock skew detected. ' +
        `Server time ${serverTimestamp}, local time ${now}`
    );
  }

  if (newConfig === 'unmodified') {
    log.info(
      'remote config was unmodified; server-generated hash is %s',
      configHash
    );
    return;
  }

  // Process new configuration in light of the old configuration. Since the
  // new configuration only includes enabled flags we can't distinguish betewen
  // a remote flag being deleted or being disabled. We synthesize that for our
  // known keys.
  const newConfigValues: Map<string, string | undefined> = new Map(
    KnownConfigKeys.map(name => [name, undefined])
  );
  for (const [name, value] of newConfig) {
    newConfigValues.set(name, value);
  }

  const oldConfig = config;
  let semverError = false;
  config = Array.from(newConfigValues.entries()).reduce(
    (acc, [name, value]) => {
      const enabled = value !== undefined && value.toLowerCase() !== 'false';
      const previouslyEnabled: boolean = get(
        oldConfig,
        [name, 'enabled'],
        false
      );
      const previousValue: string | undefined = get(
        oldConfig,
        [name, 'value'],
        undefined
      );

      // If a flag was previously not enabled and is now enabled,
      // record the time it was enabled
      const enabledAt: number | undefined =
        previouslyEnabled && enabled
          ? now
          : get(oldConfig, [name, 'enabledAt']);

      const configValue: ConfigValueType = {
        name: name as ConfigKeyType,
        enabledAt,
        ...(enabled ? { enabled: true, value } : { enabled: false }),
      };

      const hasChanged =
        previouslyEnabled !== enabled || previousValue !== configValue.value;

      if (
        SemverKeys.includes(configValue.name as SemverKeyType) &&
        configValue.enabled &&
        (!configValue.value || !semver.parse(configValue.value))
      ) {
        log.error(
          `Key ${name} had invalid semver value '${configValue.value}'`
        );
        semverError = true;
      }

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
    },
    {}
  );

  if (semverError && config['desktop.internalUser']?.enabled) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.Error,
    });
  }

  const remoteExpirationValue = getValue('desktop.clientExpiration');
  if (!remoteExpirationValue) {
    // If remote configuration fetch worked - we are not expired anymore.
    if (storage.get('remoteBuildExpiration') != null) {
      log.warn('Remote Config: clearing remote expiration on successful fetch');
    }
    await storage.remove('remoteBuildExpiration');
  } else {
    const remoteBuildExpirationTimestamp = parseRemoteClientExpiration(
      remoteExpirationValue
    );
    if (remoteBuildExpirationTimestamp) {
      await storage.put(
        'remoteBuildExpiration',
        remoteBuildExpirationTimestamp
      );
    }
  }

  await storage.put('remoteConfig', config);
  await storage.put('remoteConfigHash', configHash);
  await storage.put('serverTimeSkew', serverTimeSkew);
};

export const maybeRefreshRemoteConfig = throttle(
  _refreshRemoteConfig,
  // Only fetch remote configuration if the last fetch was more than two hours ago
  2 * 60 * 60 * 1000,
  { trailing: false }
);

export async function forceRefreshRemoteConfig(
  options: OptionsType,
  reason: string
): Promise<void> {
  log.info(`forceRefreshRemoteConfig: ${reason}`);
  maybeRefreshRemoteConfig.cancel();
  await _refreshRemoteConfig(options);
}

export function isEnabled(
  name: ConfigKeyType,
  // when called from UI component, provide redux config (items.remoteConfig)
  reduxConfig?: ConfigMapType
): boolean {
  assertDev(
    reduxConfig != null || config != null,
    'getValue called before remote config is ready'
  );
  return get(reduxConfig ?? config, [name, 'enabled'], false);
}

export function getValue(
  name: ConfigKeyType, // when called from UI component, provide redux config (items.remoteConfig)
  reduxConfig?: ConfigMapType
): string | undefined {
  assertDev(
    reduxConfig != null || config != null,
    'getValue called before remote config is ready'
  );
  return get(reduxConfig ?? config, [name, 'value']);
}

// See isRemoteConfigBucketEnabled in selectors/items.ts
export function isBucketValueEnabled(
  name: ConfigKeyType,
  e164: string | undefined,
  aci: AciString | undefined
): boolean {
  return isCountryPpmCsvBucketEnabled(name, getValue(name), e164, aci);
}

export function isCountryPpmCsvBucketEnabled(
  name: string,
  countryPpmCsv: unknown,
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

  if (typeof countryPpmCsv !== 'string') {
    return false;
  }

  const remoteConfigValue = getCountryCodeValue(
    countryCode,
    countryPpmCsv,
    name
  );
  if (remoteConfigValue == null) {
    return false;
  }

  const bucketValue = getBucketValue(aci, name);
  return bucketValue < remoteConfigValue;
}

export const COUNTRY_CODE_FALLBACK = Symbol('fallback');

export function getCountryCodeValue(
  countryCode: number | typeof COUNTRY_CODE_FALLBACK,
  countryPpmCsv: string,
  logTag: string
): number | undefined {
  const logId = `getCountryCodeValue/${logTag}`;
  if (countryPpmCsv.length === 0) {
    return undefined;
  }

  const items = countryPpmCsv.split(',');

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
    } else if (
      countryCode !== COUNTRY_CODE_FALLBACK &&
      countryCode.toString() === code
    ) {
      return parsedValue;
    }
  }

  return wildcard;
}

export function getBucketValue(aci: AciString, hashSalt: string): number {
  const hashInput = Bytes.concatenate([
    Bytes.fromString(`${hashSalt}.`),
    uuidToBytes(aci),
  ]);
  const hashResult = window.SignalContext.crypto.hash(
    HashType.size256,
    hashInput
  );

  return Number(Bytes.readBigUint64BE(hashResult.subarray(0, 8)) % 1_000_000n);
}
