// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from './logging/log';

const ONE_DAY = 24 * 60 * 60 * 1000; // one day
const MINIMUM_TIME_LEFT = 2 * 60 * 60 * 1000; // two hours

let timeout: null | ReturnType<typeof setTimeout> = null;
let scheduledTime: null | number = null;
let scheduleNext: null | (() => void) = null;

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
  navigator,
}: Readonly<{
  events: {
    on: (name: string, callback: () => void) => void;
  };
  storage: typeof window.storage;
  navigator: Navigator;
}>): void {
  // We don't want to set up all of the below functions, but we do want to ensure that our
  //   refresh timer is up-to-date.
  if (scheduleNext) {
    scheduleNext();
    return;
  }

  runWhenOnline();

  events.on('timetravel', scheduleNextRotation);

  function scheduleNextRotation() {
    const now = Date.now();
    const certificate = storage.get('senderCertificate');
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

  // Keeping this entrypoint around so more inialize() calls just kick the timing
  scheduleNext = scheduleNextRotation;

  async function saveCert({
    certificate,
    key,
  }: {
    certificate: string;
    key: string;
  }): Promise<void> {
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
    await storage.put(key, toSave);
  }

  async function removeOldKey(): Promise<void> {
    const oldCertKey = 'senderCertificateWithUuid';
    const oldUuidCert = storage.get(oldCertKey);
    if (oldUuidCert) {
      await storage.remove(oldCertKey);
    }
  }

  async function run(): Promise<void> {
    log.info('refreshSenderCertificate: Getting new certificate...');
    try {
      const OLD_USERNAME = storage.get('number_id');
      const USERNAME = storage.get('uuid_id');
      const PASSWORD = storage.get('password');
      const server = window.WebAPI.connect({
        username: USERNAME || OLD_USERNAME,
        password: PASSWORD,
      });

      const omitE164 = true;
      const [
        { certificate },
        { certificate: certificateWithNoE164 },
      ] = await Promise.all([
        server.getSenderCertificate(),
        server.getSenderCertificate(omitE164),
      ]);

      await Promise.all([
        saveCert({ certificate, key: 'senderCertificate' }),
        saveCert({
          certificate: certificateWithNoE164,
          key: 'senderCertificateNoE164',
        }),
        removeOldKey(),
      ]);

      scheduledTime = null;
      scheduleNextRotation();
    } catch (error) {
      log.error(
        'refreshSenderCertificate: Get failed. Trying again in five minutes...',
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
        'Next sender certificate refresh scheduled for',
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
