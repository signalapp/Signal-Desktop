// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SenderCertificate } from '@signalapp/libsignal-client';

import type { SerializedCertificateType } from '../textsecure/OutgoingMessage.preload.js';
import {
  SenderCertificateMode,
  serializedCertificateSchema,
} from '../textsecure/OutgoingMessage.preload.js';
import * as Bytes from '../Bytes.std.js';
import { assertDev } from '../util/assert.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { waitForOnline } from '../util/waitForOnline.dom.js';
import { createLogger } from '../logging/log.std.js';
import type { StorageInterface } from '../types/Storage.d.ts';
import * as Errors from '../types/errors.std.js';
import type {
  isOnline,
  getSenderCertificate,
} from '../textsecure/WebAPI.preload.js';
import { safeParseUnknown } from '../util/schemas.std.js';
import { isInFuture } from '../util/timestamp.std.js';
import { HOUR } from '../util/durations/constants.std.js';

const log = createLogger('senderCertificate');

function isWellFormed(data: unknown): data is SerializedCertificateType {
  return safeParseUnknown(serializedCertificateSchema, data).success;
}

/** @internal Exported for testing */
export const SENDER_CERTIFICATE_EXPIRATION_BUFFER = HOUR;

type ServerType = Readonly<{
  isOnline: typeof isOnline;
  getSenderCertificate: typeof getSenderCertificate;
}>;

/** @internal Exported for testing */
export class SenderCertificateService {
  #server?: ServerType;

  #fetchPromises: Map<
    SenderCertificateMode,
    Promise<undefined | SerializedCertificateType>
  > = new Map();

  #events?: Pick<typeof window.Whisper.events, 'on' | 'off'>;
  #storage?: StorageInterface;

  initialize({
    server,
    events,
    storage,
  }: {
    server: ServerType;
    events?: Pick<typeof window.Whisper.events, 'on' | 'off'>;
    storage: StorageInterface;
  }): void {
    log.info('Sender certificate service initialized');

    this.#server = server;
    this.#events = events;
    this.#storage = storage;
  }

  async get(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    const storedCertificate = this.#getStoredCertificate(mode);
    if (storedCertificate) {
      log.info(
        `Sender certificate service found a valid ${modeToLogString(
          mode
        )} certificate in storage; skipping fetch`
      );
      return storedCertificate;
    }

    return this.#fetchCertificate(mode);
  }

  // This is intended to be called when our credentials have been deleted, so any fetches
  //   made until this function is complete would fail anyway.
  async clear(): Promise<void> {
    log.info(
      'Sender certificate service: Clearing in-progress fetches and ' +
        'deleting cached certificates'
    );
    await Promise.all(this.#fetchPromises.values());

    const storage = this.#storage;
    assertDev(
      storage,
      'Sender certificate service method was called before it was initialized'
    );
    await storage.remove('senderCertificate');
    await storage.remove('senderCertificateNoE164');
  }

  #getStoredCertificate(
    mode: SenderCertificateMode
  ): undefined | SerializedCertificateType {
    const storage = this.#storage;
    assertDev(
      storage,
      'Sender certificate service method was called before it was initialized'
    );

    const valueInStorage = storage.get(modeToStorageKey(mode));
    if (
      isWellFormed(valueInStorage) &&
      isExpirationValid(valueInStorage.expires)
    ) {
      return valueInStorage;
    }

    return undefined;
  }

  #fetchCertificate(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    // This prevents multiple concurrent fetches.
    const existingPromise = this.#fetchPromises.get(mode);
    if (existingPromise) {
      log.info(
        `Sender certificate service was already fetching a ${modeToLogString(
          mode
        )} certificate; piggybacking off of that`
      );
      return existingPromise;
    }

    let promise: Promise<undefined | SerializedCertificateType>;
    const doFetch = async () => {
      const result = await this.#fetchAndSaveCertificate(mode);
      assertDev(
        this.#fetchPromises.get(mode) === promise,
        'Sender certificate service was deleting a different promise than expected'
      );
      this.#fetchPromises.delete(mode);
      return result;
    };
    promise = doFetch();

    assertDev(
      !this.#fetchPromises.has(mode),
      'Sender certificate service somehow already had a promise for this mode'
    );
    this.#fetchPromises.set(mode, promise);
    return promise;
  }

  async #fetchAndSaveCertificate(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    const storage = this.#storage;
    const events = this.#events;
    const server = this.#server;
    assertDev(
      storage && server && events,
      'Sender certificate service method was called before it was initialized'
    );

    log.info(
      `Sender certificate service: fetching and saving a ${modeToLogString(
        mode
      )} certificate`
    );

    await waitForOnline({ server, events });

    let certificateString: string;
    try {
      certificateString = await this.#requestSenderCertificate(mode);
    } catch (err) {
      log.warn(
        `Sender certificate service could not fetch a ${modeToLogString(
          mode
        )} certificate. Returning undefined`,
        Errors.toLogFormat(err)
      );
      return undefined;
    }
    const certificate = Bytes.fromBase64(certificateString);
    const decodedCert = SenderCertificate.deserialize(certificate);
    const expires = decodedCert.expiration();

    if (!isExpirationValid(expires)) {
      log.warn(
        `Sender certificate service fetched a ${modeToLogString(
          mode
        )} certificate from the server that was already expired (or was invalid). Is your system clock off?`
      );
      return undefined;
    }

    const serializedCertificate = {
      expires,
      serialized: certificate,
    };

    await storage.put(modeToStorageKey(mode), serializedCertificate);

    return serializedCertificate;
  }

  async #requestSenderCertificate(
    mode: SenderCertificateMode
  ): Promise<string> {
    const server = this.#server;
    assertDev(
      server,
      'Sender certificate service method was called before it was initialized'
    );

    const omitE164 = mode === SenderCertificateMode.WithoutE164;
    const { certificate } = await server.getSenderCertificate(omitE164);
    return certificate;
  }
}

function modeToStorageKey(
  mode: SenderCertificateMode
): 'senderCertificate' | 'senderCertificateNoE164' {
  switch (mode) {
    case SenderCertificateMode.WithE164:
      return 'senderCertificate';
    case SenderCertificateMode.WithoutE164:
      return 'senderCertificateNoE164';
    default:
      throw missingCaseError(mode);
  }
}

function modeToLogString(mode: SenderCertificateMode): string {
  switch (mode) {
    case SenderCertificateMode.WithE164:
      return 'yes-E164';
    case SenderCertificateMode.WithoutE164:
      return 'no-E164';
    default:
      throw missingCaseError(mode);
  }
}

function isExpirationValid(expiration: number): boolean {
  return isInFuture(expiration - SENDER_CERTIFICATE_EXPIRATION_BUFFER);
}

export const senderCertificateService = new SenderCertificateService();
