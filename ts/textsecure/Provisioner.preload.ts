// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pTimeout, { TimeoutError as PTimeoutError } from 'p-timeout';
import type { LibSignalError } from '@signalapp/libsignal-client';
import type { ProvisioningConnection } from '@signalapp/libsignal-client/dist/net/Chat.js';

import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { MAX_DEVICE_NAME_LENGTH } from '../types/InstallScreen.std.js';
import { strictAssert } from '../util/assert.std.js';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff.std.js';
import { SECOND } from '../util/durations/index.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { drop } from '../util/drop.std.js';
import { isLinkAndSyncEnabled } from '../util/isLinkAndSyncEnabled.preload.js';
import { normalizeDeviceName } from '../util/normalizeDeviceName.std.js';
import { linkDeviceRoute } from '../util/signalRoutes.std.js';
import { sleep } from '../util/sleep.std.js';
import * as Bytes from '../Bytes.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';

import {
  type CreateLinkedDeviceOptionsType,
  AccountType,
} from './AccountManager.preload.js';
import ProvisioningCipher, {
  type ProvisionDecryptResult,
} from './ProvisioningCipher.node.js';
import { ConnectTimeoutError } from './Errors.std.js';
import type { getProvisioningConnection } from './WebAPI.preload.js';

const log = createLogger('Provisioner');

export enum EventKind {
  MaxRotationsError = 'MaxRotationsError',
  TimeoutError = 'TimeoutError',
  ConnectError = 'ConnectError',
  EnvelopeError = 'EnvelopeError',
  URL = 'URL',
  Envelope = 'Envelope',
}

export type ProvisionerOptionsType = Readonly<{
  server: { getProvisioningConnection: typeof getProvisioningConnection };
}>;

export type EnvelopeType = ProvisionDecryptResult;

export type EventType = Readonly<
  | {
      kind: EventKind.MaxRotationsError;
    }
  | {
      kind: EventKind.TimeoutError;
      canRetry: boolean;
    }
  | {
      kind: EventKind.ConnectError;
      error: Error;
    }
  | {
      kind: EventKind.EnvelopeError;
      error: Error;
    }
  | {
      kind: EventKind.URL;
      url: string;
    }
  | {
      kind: EventKind.Envelope;
      envelope: EnvelopeType;
      isLinkAndSync: boolean;
    }
>;

export type SubscribeNotifierType = (event: EventType) => void;

export type UnsubscribeFunctionType = () => void;

export type SubscriberType = Readonly<{
  notify: SubscribeNotifierType;
}>;

export type PrepareLinkDataOptionsType = Readonly<{
  envelope: EnvelopeType;
  deviceName: string;
}>;

enum SocketState {
  WaitingForUuid = 'WaitingForUuid',
  WaitingForEnvelope = 'WaitingForEnvelope',
  Done = 'Done',
}

const ROTATION_INTERVAL = 45 * SECOND;
const MAX_OPEN_SOCKETS = 2;
const MAX_ROTATIONS = 6;

const TIMEOUT_ERROR = new PTimeoutError();

const QR_CODE_TIMEOUTS = [10 * SECOND, 20 * SECOND, 30 * SECOND, 60 * SECOND];

export class Provisioner {
  readonly #subscribers = new Set<SubscriberType>();
  readonly #server: {
    getProvisioningConnection: typeof getProvisioningConnection;
  };
  readonly #retryBackOff = new BackOff(FIBONACCI_TIMEOUTS);

  #sockets: Array<ProvisioningConnection> = [];
  #abortController: AbortController | undefined;
  #attemptCount = 0;
  #isRunning = false;

  constructor({ server }: ProvisionerOptionsType) {
    this.#server = server;
  }

  public subscribe(notify: SubscribeNotifierType): UnsubscribeFunctionType {
    const subscriber = { notify };

    this.#subscribers.add(subscriber);
    if (this.#subscribers.size === 1) {
      this.#start();
    }

    return () => {
      this.#subscribers.delete(subscriber);
      if (this.#subscribers.size === 0) {
        this.#stop('Cancel, no subscribers');
      }
    };
  }

  public reset(): void {
    this.#attemptCount = 0;
    this.#retryBackOff.reset();
  }

  public static prepareLinkData({
    envelope,
    deviceName,
  }: PrepareLinkDataOptionsType): CreateLinkedDeviceOptionsType {
    const {
      number,
      provisioningCode,
      aciKeyPair,
      pniKeyPair,
      aci: ourAci,
      profileKey,
      masterKey,
      pni: ourPni,
      userAgent,
      readReceipts,
      ephemeralBackupKey,
      accountEntropyPool,
      mediaRootBackupKey,
    } = envelope;

    strictAssert(number, 'prepareLinkData: missing number');
    strictAssert(provisioningCode, 'prepareLinkData: missing provisioningCode');
    strictAssert(aciKeyPair, 'prepareLinkData: missing aciKeyPair');
    strictAssert(pniKeyPair, 'prepareLinkData: missing pniKeyPair');
    strictAssert(
      Bytes.isNotEmpty(profileKey),
      'prepareLinkData: missing profileKey'
    );
    strictAssert(
      Bytes.isNotEmpty(masterKey) || accountEntropyPool,
      'prepareLinkData: missing masterKey or accountEntropyPool'
    );

    return {
      type: AccountType.Linked,
      number,
      verificationCode: provisioningCode,
      aciKeyPair,
      pniKeyPair,
      profileKey,
      deviceName: normalizeDeviceName(deviceName).slice(
        0,
        MAX_DEVICE_NAME_LENGTH
      ),
      userAgent,
      ourAci,
      ourPni,
      readReceipts: Boolean(readReceipts),
      masterKey,
      ephemeralBackupKey,
      accountEntropyPool,
      mediaRootBackupKey,
    };
  }

  //
  // Private
  //

  #start(): void {
    log.info('starting');

    if (this.#abortController) {
      strictAssert(this.#isRunning, 'Must be running to have controller');
      this.#abortController.abort();
    }
    this.#abortController = new AbortController();

    this.#isRunning = true;

    drop(this.#loop(this.#abortController.signal));
  }

  #stop(reason: string): void {
    if (!this.#isRunning) {
      return;
    }
    log.info(`stopping, reason=${reason}`);

    this.#sockets = [];
    this.#abortController?.abort();
    this.#abortController = undefined;
    this.#isRunning = false;
  }

  async #loop(signal: AbortSignal): Promise<void> {
    let rotations = 0;
    while (this.#subscribers.size > 0) {
      const logId = `Provisioner.loop(${rotations})`;

      if (rotations >= MAX_ROTATIONS) {
        log.info(`${logId}: exceeded max rotation count`);

        this.#notify({
          kind: EventKind.MaxRotationsError,
        });

        this.#stop('Max rotations reached');
        break;
      }

      let delay: number;

      try {
        const sleepMs = QR_CODE_TIMEOUTS[this.#attemptCount];

        // eslint-disable-next-line no-await-in-loop
        await this.#connect(signal, sleepMs);

        // Successful connect, sleep until rotation time
        delay = ROTATION_INTERVAL;
        this.reset();
        rotations += 1;

        log.info(`${logId}: connected, refreshing in ${delay}ms`);
      } catch (error) {
        // New loop is running
        if (signal !== this.#abortController?.signal) {
          return;
        }

        // The only active socket has failed, notify subscribers and shutdown
        if (this.#sockets.length === 0) {
          if (error === TIMEOUT_ERROR || error instanceof ConnectTimeoutError) {
            const canRetry = this.#attemptCount < QR_CODE_TIMEOUTS.length - 1;

            this.#attemptCount = Math.min(
              this.#attemptCount + 1,
              QR_CODE_TIMEOUTS.length - 1
            );

            this.#notify({
              kind: EventKind.TimeoutError,
              canRetry,
            });
          } else {
            this.#notify({
              kind: EventKind.ConnectError,
              error,
            });
          }

          this.#subscribers.clear();
          this.#stop('Only socket failed');

          break;
        }

        // At least one more socket is active, retry connecting silently after
        // a delay.

        delay = this.#retryBackOff.getAndIncrement();

        log.error(
          `${logId}: failed to connect, retrying in ${delay}ms`,
          Errors.toLogFormat(error)
        );
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        await sleep(delay, signal);
      } catch (error) {
        // New loop is running
        if (signal !== this.#abortController?.signal) {
          return;
        }

        // Sleep aborted
        strictAssert(
          this.#subscribers.size === 0,
          'Aborted with active subscribers'
        );
        break;
      }
    }
  }

  async #connect(signal: AbortSignal, timeout: number): Promise<void> {
    const cipher = new ProvisioningCipher();

    const uuidPromise = explodePromise<string>();

    let state = SocketState.WaitingForUuid;

    const timeoutAt = Date.now() + timeout;

    const connection = await this.#server.getProvisioningConnection(
      {
        onReceivedAddress: (address, ack) => {
          if (state !== SocketState.WaitingForUuid) {
            log.error('onReceivedAddress: duplicate uuid');
            drop(connection.disconnect());
            return;
          }

          state = SocketState.WaitingForEnvelope;
          uuidPromise.resolve(address);
          ack.send(200);
        },
        onReceivedEnvelope: (body, ack) => {
          if (state !== SocketState.WaitingForEnvelope) {
            log.error('onReceivedEnvelope: duplicate envelope or not ready');
            drop(connection.disconnect());
            return;
          }

          const ciphertext = Proto.ProvisionEnvelope.decode(body);
          const envelope = cipher.decrypt(ciphertext);

          state = SocketState.Done;
          this.#notify({
            kind: EventKind.Envelope,
            envelope,
            isLinkAndSync:
              isLinkAndSyncEnabled() &&
              Bytes.isNotEmpty(envelope.ephemeralBackupKey),
          });
          ack.send(200);
        },

        onConnectionInterrupted: (cause: LibSignalError | null) => {
          signal.removeEventListener('abort', onAbort);
          this.#handleClose(connection, state, cause);
        },
      },
      timeout
    );

    if (signal.aborted) {
      throw new Error('aborted');
    }

    // Setup listeners on the socket

    const onAbort = () => {
      drop(connection.disconnect());
      uuidPromise.reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort);

    // But only register it once we get the uuid from server back.

    const uuid = await pTimeout(
      uuidPromise.promise,
      Math.max(0, timeoutAt - Date.now()),
      TIMEOUT_ERROR
    );

    const url = linkDeviceRoute
      .toAppUrl({
        uuid,
        pubKey: Bytes.toBase64(cipher.getPublicKey().serialize()),
        capabilities: isLinkAndSyncEnabled() ? ['backup4', 'backup5'] : [],
      })
      .toString();

    this.#notify({ kind: EventKind.URL, url });

    this.#sockets.push(connection);

    while (this.#sockets.length > MAX_OPEN_SOCKETS) {
      log.info('closing extra socket');
      drop(this.#sockets.shift()?.disconnect());
    }
  }

  #handleClose(
    connection: ProvisioningConnection,
    state: SocketState,
    cause: LibSignalError | null
  ): void {
    const reason = cause && Errors.toLogFormat(cause);
    const index = this.#sockets.indexOf(connection);
    if (index === -1) {
      log.info(`ignoring socket closed, reason=${reason}`);
      return;
    }

    const logId = `Provisioner.#handleClose(${index}): reason=${reason}`;
    log.info(`${logId}: closed`);

    // Is URL from the socket displayed as a QR code?
    const isActive = index === this.#sockets.length - 1;
    this.#sockets.splice(index, 1);

    // Graceful closure
    if (state === SocketState.Done) {
      log.info(`${logId}: closed gracefully`);
      return;
    }

    if (isActive) {
      log.info(`${logId}: active socket closed`);
      this.#notify({
        kind:
          state === SocketState.WaitingForUuid
            ? EventKind.ConnectError
            : EventKind.EnvelopeError,
        error: new Error(`Socket ${index} closed, reason=${reason}`),
      });
    }
  }

  #notify(event: EventType): void {
    for (const { notify } of this.#subscribers) {
      notify(event);
    }
  }
}
