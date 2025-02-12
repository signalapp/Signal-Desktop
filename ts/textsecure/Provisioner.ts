// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pTimeout, { TimeoutError as PTimeoutError } from 'p-timeout';

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { MAX_DEVICE_NAME_LENGTH } from '../types/InstallScreen';
import {
  isUntaggedPniString,
  normalizePni,
  toTaggedPni,
} from '../types/ServiceId';
import { strictAssert } from '../util/assert';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff';
import { SECOND } from '../util/durations';
import { explodePromise } from '../util/explodePromise';
import { drop } from '../util/drop';
import { isLinkAndSyncEnabled } from '../util/isLinkAndSyncEnabled';
import { normalizeAci } from '../util/normalizeAci';
import { normalizeDeviceName } from '../util/normalizeDeviceName';
import { linkDeviceRoute } from '../util/signalRoutes';
import { sleep } from '../util/sleep';
import * as Bytes from '../Bytes';
import { SignalService as Proto } from '../protobuf';

import {
  type CreateLinkedDeviceOptionsType,
  AccountType,
} from './AccountManager';
import ProvisioningCipher, {
  type ProvisionDecryptResult,
} from './ProvisioningCipher';
import {
  type IWebSocketResource,
  type IncomingWebSocketRequest,
  ServerRequestType,
} from './WebsocketResources';
import { ConnectTimeoutError } from './Errors';
import { type WebAPIType } from './WebAPI';

export enum EventKind {
  MaxRotationsError = 'MaxRotationsError',
  TimeoutError = 'TimeoutError',
  ConnectError = 'ConnectError',
  EnvelopeError = 'EnvelopeError',
  URL = 'URL',
  Envelope = 'Envelope',
}

export type ProvisionerOptionsType = Readonly<{
  server: WebAPIType;
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
  backupFile?: Uint8Array;
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
  readonly #server: WebAPIType;
  readonly #retryBackOff = new BackOff(FIBONACCI_TIMEOUTS);

  #sockets: Array<IWebSocketResource> = [];
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
    backupFile,
  }: PrepareLinkDataOptionsType): CreateLinkedDeviceOptionsType {
    const {
      number,
      provisioningCode,
      aciKeyPair,
      pniKeyPair,
      aci,
      profileKey,
      masterKey,
      untaggedPni,
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
    strictAssert(aci, 'prepareLinkData: missing aci');
    strictAssert(
      Bytes.isNotEmpty(profileKey),
      'prepareLinkData: missing profileKey'
    );
    strictAssert(
      Bytes.isNotEmpty(masterKey) || accountEntropyPool,
      'prepareLinkData: missing masterKey or accountEntropyPool'
    );
    strictAssert(
      isUntaggedPniString(untaggedPni),
      'prepareLinkData: invalid untaggedPni'
    );

    const ourAci = normalizeAci(aci, 'provisionMessage.aci');
    const ourPni = normalizePni(
      toTaggedPni(untaggedPni),
      'provisionMessage.pni'
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
      backupFile,
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
    log.info('Provisioner: starting');

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
    log.info(`Provisioner: stopping, reason=${reason}`);

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

    const resource = await this.#server.getProvisioningResource(
      {
        handleRequest: (request: IncomingWebSocketRequest) => {
          const { requestType, body } = request;
          if (!body) {
            log.warn('Provisioner.connect: no request body');
            request.respond(400, 'Missing body');
            return;
          }

          try {
            if (requestType === ServerRequestType.ProvisioningAddress) {
              strictAssert(
                state === SocketState.WaitingForUuid,
                'Provisioner.connect: duplicate uuid'
              );

              const proto = Proto.ProvisioningUuid.decode(body);
              strictAssert(proto.uuid, 'Provisioner.connect: expected a UUID');

              state = SocketState.WaitingForEnvelope;
              uuidPromise.resolve(proto.uuid);
              request.respond(200, 'OK');
            } else if (requestType === ServerRequestType.ProvisioningMessage) {
              strictAssert(
                state === SocketState.WaitingForEnvelope,
                'Provisioner.connect: duplicate envelope or not ready'
              );

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
              request.respond(200, 'OK');
            } else {
              log.warn(
                'Provisioner.connect: unsupported request type',
                requestType
              );
              request.respond(404, 'Unsupported');
            }
          } catch (error) {
            log.error('Provisioner.connect: error', Errors.toLogFormat(error));
            resource.close();
          }
        },
      },
      timeout
    );

    if (signal.aborted) {
      throw new Error('aborted');
    }

    // Setup listeners on the socket

    const onAbort = () => {
      resource.close();
      uuidPromise.reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort);

    resource.addEventListener('close', ({ code, reason }) => {
      signal.removeEventListener('abort', onAbort);
      this.#handleClose(resource, state, code, reason);
    });

    // But only register it once we get the uuid from server back.

    const uuid = await pTimeout(
      uuidPromise.promise,
      Math.max(0, timeoutAt - Date.now()),
      TIMEOUT_ERROR
    );

    const url = linkDeviceRoute
      .toAppUrl({
        uuid,
        pubKey: Bytes.toBase64(cipher.getPublicKey()),
        capabilities: isLinkAndSyncEnabled() ? ['backup3'] : [],
      })
      .toString();

    this.#notify({ kind: EventKind.URL, url });

    this.#sockets.push(resource);

    while (this.#sockets.length > MAX_OPEN_SOCKETS) {
      log.info('Provisioner: closing extra socket');
      this.#sockets.shift()?.close();
    }
  }

  #handleClose(
    resource: IWebSocketResource,
    state: SocketState,
    code: number,
    reason: string
  ): void {
    log.info(`Provisioner: socket closed, code=${code}, reason=${reason}`);

    const index = this.#sockets.indexOf(resource);
    if (index === -1) {
      return;
    }

    // Is URL from the socket displayed as a QR code?
    const isActive = index === this.#sockets.length - 1;
    this.#sockets.splice(index, 1);

    // Graceful closure
    if (state === SocketState.Done) {
      return;
    }

    if (isActive) {
      this.#notify({
        kind:
          state === SocketState.WaitingForUuid
            ? EventKind.ConnectError
            : EventKind.EnvelopeError,
        error: new Error(`Socket closed, code=${code}, reason=${reason}`),
      });
    }
  }

  #notify(event: EventType): void {
    for (const { notify } of this.#subscribers) {
      notify(event);
    }
  }
}
