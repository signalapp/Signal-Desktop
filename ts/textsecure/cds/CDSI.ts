// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  RateLimitedError as NetRateLimitedError,
  Net,
} from '@signalapp/libsignal-client';
import {
  ErrorCode as LibSignalErrorCode,
  LibSignalErrorBase,
} from '@signalapp/libsignal-client';
import pTimeout from 'p-timeout';
import type { CDSBaseOptionsType } from './CDSBase';
import { CDSBase } from './CDSBase';
import type { CDSRequestOptionsType, CDSResponseType } from './Types';
import { sleep } from '../../util/sleep';
import * as durations from '../../util/durations';

export type CDSIOptionsType = CDSBaseOptionsType;

const REQUEST_TIMEOUT = 10 * durations.SECOND;

export class CDSI extends CDSBase<CDSIOptionsType> {
  #retryAfter?: number;

  constructor(
    private readonly libsignalNet: Net.Net,
    options: CDSIOptionsType
  ) {
    super(options);
  }

  public async request(
    options: CDSRequestOptionsType
  ): Promise<CDSResponseType> {
    const log = this.logger;

    if (this.#retryAfter !== undefined) {
      const delay = Math.max(0, this.#retryAfter - Date.now());

      log.info(`CDSSocketManager: waiting ${delay}ms before retrying`);
      await sleep(delay);
    }

    const { acisAndAccessKeys, e164s, returnAcisWithoutUaks = false } = options;
    const auth = await this.getAuth();

    log.info('CDSSocketManager: making request via libsignal');
    try {
      log.info('CDSSocketManager: starting lookup request');

      const useNewConnectLogic = !window.Signal.RemoteConfig.isEnabled(
        'desktop.cdsiViaLibsignal.disableNewConnectionLogic'
      );
      const { timeout = REQUEST_TIMEOUT } = options;
      const response = await pTimeout(
        this.libsignalNet.cdsiLookup(auth, {
          acisAndAccessKeys,
          e164s,
          returnAcisWithoutUaks,
          useNewConnectLogic,
        }),
        timeout
      );

      log.info('CDSSocketManager: lookup request finished');
      return response as CDSResponseType;
    } catch (error) {
      if (
        error instanceof LibSignalErrorBase &&
        error.code === LibSignalErrorCode.RateLimitedError
      ) {
        const retryError = error as NetRateLimitedError;
        this.#retryAfter = Math.max(
          this.#retryAfter ?? Date.now(),
          Date.now() + retryError.retryAfterSecs * durations.SECOND
        );
      }
      throw error;
    }
  }
}
