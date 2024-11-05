// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type ExplodePromiseResultType,
  explodePromise,
} from '../util/explodePromise';
import { linkDeviceRoute } from '../util/signalRoutes';
import { strictAssert } from '../util/assert';
import { normalizeAci } from '../util/normalizeAci';
import { normalizeDeviceName } from '../util/normalizeDeviceName';
import { isLinkAndSyncEnabled } from '../util/isLinkAndSyncEnabled';
import { MINUTE } from '../util/durations';
import { MAX_DEVICE_NAME_LENGTH } from '../types/InstallScreen';
import * as Errors from '../types/errors';
import {
  isUntaggedPniString,
  normalizePni,
  toTaggedPni,
} from '../types/ServiceId';
import { SignalService as Proto } from '../protobuf';
import * as Bytes from '../Bytes';
import * as log from '../logging/log';
import { type WebAPIType } from './WebAPI';
import ProvisioningCipher, {
  type ProvisionDecryptResult,
} from './ProvisioningCipher';
import {
  type CreateLinkedDeviceOptionsType,
  AccountType,
} from './AccountManager';
import {
  type IWebSocketResource,
  type IncomingWebSocketRequest,
  ServerRequestType,
} from './WebsocketResources';
import { InactiveTimeoutError } from './Errors';

enum Step {
  Idle = 'Idle',
  Connecting = 'Connecting',
  WaitingForURL = 'WaitingForURL',
  WaitingForEnvelope = 'WaitingForEnvelope',
  ReadyToLink = 'ReadyToLink',
  Done = 'Done',
}

type StateType = Readonly<
  | {
      step: Step.Idle;
    }
  | {
      step: Step.Connecting;
    }
  | {
      step: Step.WaitingForURL;
      url: ExplodePromiseResultType<string>;
    }
  | {
      step: Step.WaitingForEnvelope;
      done: ExplodePromiseResultType<void>;
    }
  | {
      step: Step.ReadyToLink;
      envelope: ProvisionDecryptResult;
    }
  | {
      step: Step.Done;
    }
>;

export type PrepareLinkDataOptionsType = Readonly<{
  deviceName: string;
  backupFile?: Uint8Array;
}>;

export type ProvisionerOptionsType = Readonly<{
  server: WebAPIType;
  appVersion: string;
}>;

const INACTIVE_SOCKET_TIMEOUT = 30 * MINUTE;

export class Provisioner {
  private readonly cipher = new ProvisioningCipher();
  private readonly server: WebAPIType;
  private readonly appVersion: string;

  private state: StateType = { step: Step.Idle };
  private wsr: IWebSocketResource | undefined;

  constructor(options: ProvisionerOptionsType) {
    this.server = options.server;
    this.appVersion = options.appVersion;
  }

  public close(error = new Error('Provisioner closed')): void {
    try {
      this.wsr?.close();
    } catch {
      // Best effort
    }

    const prevState = this.state;
    this.state = { step: Step.Done };

    if (prevState.step === Step.WaitingForURL) {
      prevState.url.reject(error);
    } else if (prevState.step === Step.WaitingForEnvelope) {
      prevState.done.reject(error);
    }
  }

  public async getURL(): Promise<string> {
    strictAssert(
      this.state.step === Step.Idle,
      `Invalid state for getURL: ${this.state.step}`
    );
    this.state = { step: Step.Connecting };

    const wsr = await this.server.getProvisioningResource({
      handleRequest: (request: IncomingWebSocketRequest) => {
        try {
          this.handleRequest(request);
        } catch (error) {
          log.error(
            'Provisioner.handleRequest: failure',
            Errors.toLogFormat(error)
          );
          this.close();
        }
      },
    });
    this.wsr = wsr;

    let inactiveTimer: NodeJS.Timeout | undefined;

    const onVisibilityChange = (): void => {
      // Visible
      if (!document.hidden) {
        if (inactiveTimer != null) {
          clearTimeout(inactiveTimer);
        }
        inactiveTimer = undefined;
        return;
      }

      // Invisible, but already has a timer
      if (inactiveTimer != null) {
        return;
      }

      inactiveTimer = setTimeout(() => {
        inactiveTimer = undefined;

        this.close(new InactiveTimeoutError());
      }, INACTIVE_SOCKET_TIMEOUT);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    if (this.state.step !== Step.Connecting) {
      this.close();
      throw new Error('Provisioner closed early');
    }

    this.state = {
      step: Step.WaitingForURL,
      url: explodePromise(),
    };

    wsr.addEventListener('close', ({ code, reason }) => {
      // Unsubscribe from visibility changes
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (inactiveTimer != null) {
        clearTimeout(inactiveTimer);
      }
      inactiveTimer = undefined;

      if (this.state.step === Step.ReadyToLink) {
        // WebSocket close is not an issue since we no longer need it
        return;
      }

      log.info(`provisioning socket closed. Code: ${code} Reason: ${reason}`);
      this.close(new Error('websocket closed'));
    });

    return this.state.url.promise;
  }

  public async waitForEnvelope(): Promise<void> {
    strictAssert(
      this.state.step === Step.WaitingForEnvelope,
      `Invalid state for waitForEnvelope: ${this.state.step}`
    );
    await this.state.done.promise;
  }

  public prepareLinkData({
    deviceName,
    backupFile,
  }: PrepareLinkDataOptionsType): CreateLinkedDeviceOptionsType {
    strictAssert(
      this.state.step === Step.ReadyToLink,
      `Invalid state for prepareLinkData: ${this.state.step}`
    );
    const { envelope } = this.state;
    this.state = { step: Step.Done };

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

  public isLinkAndSync(): boolean {
    strictAssert(
      this.state.step === Step.ReadyToLink,
      `Invalid state for prepareLinkData: ${this.state.step}`
    );

    const { envelope } = this.state;

    return (
      isLinkAndSyncEnabled(this.appVersion) &&
      Bytes.isNotEmpty(envelope.ephemeralBackupKey)
    );
  }

  private handleRequest(request: IncomingWebSocketRequest): void {
    const pubKey = this.cipher.getPublicKey();

    if (
      request.requestType === ServerRequestType.ProvisioningAddress &&
      request.body
    ) {
      strictAssert(
        this.state.step === Step.WaitingForURL,
        `Unexpected provisioning address, state: ${this.state}`
      );
      const prevState = this.state;
      this.state = { step: Step.WaitingForEnvelope, done: explodePromise() };

      const proto = Proto.ProvisioningUuid.decode(request.body);
      const { uuid } = proto;
      strictAssert(uuid, 'Provisioner.getURL: expected a UUID');

      const url = linkDeviceRoute
        .toAppUrl({
          uuid,
          pubKey: Bytes.toBase64(pubKey),
          capabilities: isLinkAndSyncEnabled(this.appVersion) ? ['backup'] : [],
        })
        .toString();

      window.SignalCI?.setProvisioningURL(url);
      prevState.url.resolve(url);

      request.respond(200, 'OK');
    } else if (
      request.requestType === ServerRequestType.ProvisioningMessage &&
      request.body
    ) {
      strictAssert(
        this.state.step === Step.WaitingForEnvelope,
        `Unexpected provisioning address, state: ${this.state}`
      );
      const prevState = this.state;

      const ciphertext = Proto.ProvisionEnvelope.decode(request.body);
      const message = this.cipher.decrypt(ciphertext);

      this.state = { step: Step.ReadyToLink, envelope: message };
      request.respond(200, 'OK');
      this.wsr?.close();

      prevState.done.resolve();
    } else {
      log.error('Unknown websocket message', request.requestType);
    }
  }
}
