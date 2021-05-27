// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  SenderCertificateMode,
  serializedCertificateSchema,
  SerializedCertificateType,
} from '../textsecure/OutgoingMessage';
import { SenderCertificateClass } from '../textsecure';
import { base64ToArrayBuffer } from '../Crypto';
import { assert } from '../util/assert';
import { missingCaseError } from '../util/missingCaseError';
import { waitForOnline } from '../util/waitForOnline';
import * as log from '../logging/log';
import { connectToServerWithStoredCredentials } from '../util/connectToServerWithStoredCredentials';

// We define a stricter storage here that returns `unknown` instead of `any`.
type Storage = {
  get(key: string): unknown;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
};

function isWellFormed(data: unknown): data is SerializedCertificateType {
  return serializedCertificateSchema.safeParse(data).success;
}

// In case your clock is different from the server's, we "fake" expire certificates early.
const CLOCK_SKEW_THRESHOLD = 15 * 60 * 1000;

// This is exported for testing.
export class SenderCertificateService {
  private WebAPI?: typeof window.WebAPI;

  private SenderCertificate?: typeof SenderCertificateClass;

  private fetchPromises: Map<
    SenderCertificateMode,
    Promise<undefined | SerializedCertificateType>
  > = new Map();

  private navigator?: { onLine: boolean };

  private onlineEventTarget?: EventTarget;

  private storage?: Storage;

  initialize({
    SenderCertificate,
    WebAPI,
    navigator,
    onlineEventTarget,
    storage,
  }: {
    WebAPI: typeof window.WebAPI;
    navigator: Readonly<{ onLine: boolean }>;
    onlineEventTarget: EventTarget;
    SenderCertificate: typeof SenderCertificateClass;
    storage: Storage;
  }): void {
    log.info('Sender certificate service initialized');

    this.SenderCertificate = SenderCertificate;
    this.WebAPI = WebAPI;
    this.navigator = navigator;
    this.onlineEventTarget = onlineEventTarget;
    this.storage = storage;
  }

  async get(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    const storedCertificate = this.getStoredCertificate(mode);
    if (storedCertificate) {
      log.info(
        `Sender certificate service found a valid ${modeToLogString(
          mode
        )} certificate in storage; skipping fetch`
      );
      return storedCertificate;
    }

    return this.fetchCertificate(mode);
  }

  private getStoredCertificate(
    mode: SenderCertificateMode
  ): undefined | SerializedCertificateType {
    const { storage } = this;
    assert(
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

  private fetchCertificate(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    // This prevents multiple concurrent fetches.
    const existingPromise = this.fetchPromises.get(mode);
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
      const result = await this.fetchAndSaveCertificate(mode);
      assert(
        this.fetchPromises.get(mode) === promise,
        'Sender certificate service was deleting a different promise than expected'
      );
      this.fetchPromises.delete(mode);
      return result;
    };
    promise = doFetch();

    assert(
      !this.fetchPromises.has(mode),
      'Sender certificate service somehow already had a promise for this mode'
    );
    this.fetchPromises.set(mode, promise);
    return promise;
  }

  private async fetchAndSaveCertificate(
    mode: SenderCertificateMode
  ): Promise<undefined | SerializedCertificateType> {
    const { SenderCertificate, storage, navigator, onlineEventTarget } = this;
    assert(
      SenderCertificate && storage && navigator && onlineEventTarget,
      'Sender certificate service method was called before it was initialized'
    );

    log.info(
      `Sender certificate service: fetching and saving a ${modeToLogString(
        mode
      )} certificate`
    );

    await waitForOnline(navigator, onlineEventTarget);

    let certificateString: string;
    try {
      certificateString = await this.requestSenderCertificate(mode);
    } catch (err) {
      log.warn(
        `Sender certificate service could not fetch a ${modeToLogString(
          mode
        )} certificate. Returning undefined`,
        err && err.stack ? err.stack : err
      );
      return undefined;
    }
    const certificate = base64ToArrayBuffer(certificateString);
    const decodedContainer = SenderCertificate.decode(certificate);
    const decodedCert = decodedContainer.certificate
      ? SenderCertificate.Certificate.decode(decodedContainer.certificate)
      : undefined;
    const expires = decodedCert?.expires?.toNumber();

    if (!isExpirationValid(expires)) {
      log.warn(
        `Sender certificate service fetched a ${modeToLogString(
          mode
        )} certificate from the server that was already expired (or was invalid). Is your system clock off?`
      );
      return undefined;
    }

    const serializedCertificate = {
      expires: expires - CLOCK_SKEW_THRESHOLD,
      serialized: certificate,
    };

    await storage.put(modeToStorageKey(mode), serializedCertificate);

    return serializedCertificate;
  }

  private async requestSenderCertificate(
    mode: SenderCertificateMode
  ): Promise<string> {
    const { storage, WebAPI } = this;
    assert(
      storage && WebAPI,
      'Sender certificate service method was called before it was initialized'
    );

    const server = connectToServerWithStoredCredentials(WebAPI, storage);
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

function isExpirationValid(expiration: unknown): expiration is number {
  return typeof expiration === 'number' && expiration > Date.now();
}

export const senderCertificateService = new SenderCertificateService();
