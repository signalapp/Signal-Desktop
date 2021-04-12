// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { once } from 'lodash';
import * as log from './logging/log';
import { missingCaseError } from './util/missingCaseError';
import { SenderCertificateMode } from './metadata/SecretSessionCipher';

const ONE_DAY = 24 * 60 * 60 * 1000; // one day
const MINIMUM_TIME_LEFT = 2 * 60 * 60 * 1000; // two hours

let timeout: null | ReturnType<typeof setTimeout> = null;
let scheduledTime: null | number = null;

const removeOldKey = once((storage: typeof window.storage) => {
  const oldCertKey = 'senderCertificateWithUuid';
  const oldUuidCert = storage.get(oldCertKey);
  if (oldUuidCert) {
    storage.remove(oldCertKey);
  }
});

// We need to refresh our own profile regularly to account for newly-added devices which
//   do not support unidentified delivery.
function refreshOurProfile() {
  window.log.info('refreshOurProfile');
  const ourId = window.ConversationController.getOurConversationIdOrThrow();
  const conversation = window.ConversationController.get(ourId);
  conversation?.getProfiles();
}

export function initialize({
  events,
  storage,
  mode,
  navigator,
}: Readonly<{
  events: {
    on: (name: string, callback: () => void) => void;
  };
  storage: typeof window.storage;
  mode: SenderCertificateMode;
  navigator: Navigator;
}>): void {
  let storageKey: 'senderCertificate' | 'senderCertificateNoE164';
  let logString: string;
  switch (mode) {
    case SenderCertificateMode.WithE164:
      storageKey = 'senderCertificate';
      logString = 'sender certificate WITH E164';
      break;
    case SenderCertificateMode.WithoutE164:
      storageKey = 'senderCertificateNoE164';
      logString = 'sender certificate WITHOUT E164';
      break;
    default:
      throw missingCaseError(mode);
  }

  runWhenOnline();
  removeOldKey(storage);

  events.on('timetravel', scheduleNextRotation);

  function scheduleNextRotation() {
    const now = Date.now();
    const certificate = storage.get(storageKey);
    if (!certificate || !certificate.expires) {
      setTimeoutForNextRun(scheduledTime || now);

      return;
    }

    // If we have a time in place and it's already before the safety zone before expire,
    //   we keep it
    if (
      scheduledTime &&
      scheduledTime <= certificate.expires - MINIMUM_TIME_LEFT
    ) {
      setTimeoutForNextRun(scheduledTime);
      return;
    }

    // Otherwise, we reset every day, or earlier if the safety zone requires it
    const time = Math.min(
      now + ONE_DAY,
      certificate.expires - MINIMUM_TIME_LEFT
    );
    setTimeoutForNextRun(time);
  }

  async function saveCert(certificate: string): Promise<void> {
    const arrayBuffer = window.Signal.Crypto.base64ToArrayBuffer(certificate);
    const decodedContainer = window.textsecure.protobuf.SenderCertificate.decode(
      arrayBuffer
    );
    const decodedCert = window.textsecure.protobuf.SenderCertificate.Certificate.decode(
      decodedContainer.certificate
    );

    // We don't want to send a protobuf-generated object across IPC, so we make
    //   our own object.
    const toSave = {
      expires: decodedCert.expires.toNumber(),
      serialized: arrayBuffer,
    };
    await storage.put(storageKey, toSave);
  }

  async function run(): Promise<void> {
    log.info(`refreshSenderCertificate: Getting new ${logString}...`);
    try {
      const OLD_USERNAME = storage.get('number_id');
      const USERNAME = storage.get('uuid_id');
      const PASSWORD = storage.get('password');
      const server = window.WebAPI.connect({
        username: USERNAME || OLD_USERNAME,
        password: PASSWORD,
      });

      const omitE164 = mode === SenderCertificateMode.WithoutE164;
      const { certificate } = await server.getSenderCertificate(omitE164);

      await saveCert(certificate);

      scheduledTime = null;
      scheduleNextRotation();
    } catch (error) {
      log.error(
        `refreshSenderCertificate: Get failed for ${logString}. Trying again in five minutes...`,
        error && error.stack ? error.stack : error
      );

      scheduledTime = Date.now() + 5 * 60 * 1000;

      scheduleNextRotation();
    }

    refreshOurProfile();
  }

  function runWhenOnline() {
    if (navigator.onLine) {
      run();
    } else {
      log.info(
        'refreshSenderCertificate: Offline. Will update certificate when online...'
      );
      const listener = () => {
        log.info(
          'refreshSenderCertificate: Online. Now updating certificate...'
        );
        window.removeEventListener('online', listener);
        run();
      };
      window.addEventListener('online', listener);
    }
  }

  function setTimeoutForNextRun(time = Date.now()) {
    const now = Date.now();

    if (scheduledTime !== time || !timeout) {
      log.info(
        `refreshSenderCertificate: Next ${logString} refresh scheduled for`,
        new Date(time).toISOString()
      );
    }

    scheduledTime = time;
    const waitTime = Math.max(0, time - now);

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(runWhenOnline, waitTime);
  }
}
