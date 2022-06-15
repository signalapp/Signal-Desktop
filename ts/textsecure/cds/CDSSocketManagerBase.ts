// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { connection as WebSocket } from 'websocket';
import pTimeout from 'p-timeout';

import type { AbortableProcess } from '../../util/AbortableProcess';
import * as durations from '../../util/durations';
import { getBasicAuth } from '../../util/getBasicAuth';
import { sleep } from '../../util/sleep';
import { SECOND } from '../../util/durations';
import type { CDSBaseOptionsType } from './CDSBase';
import { CDSBase } from './CDSBase';
import type { CDSSocketBase } from './CDSSocketBase';
import type {
  CDSRequestOptionsType,
  CDSResponseType,
  CDSAuthType,
} from './Types.d';
import { connect as connectWebSocket } from '../WebSocket';

const REQUEST_TIMEOUT = 10 * SECOND;

export type CDSSocketManagerBaseOptionsType = Readonly<{
  url: string;
  certificateAuthority: string;
  version: string;
}> &
  CDSBaseOptionsType;

export abstract class CDSSocketManagerBase<
  Socket extends CDSSocketBase,
  Options extends CDSSocketManagerBaseOptionsType
> extends CDSBase<Options> {
  private retryAfter?: number;

  public async request(
    options: CDSRequestOptionsType
  ): Promise<CDSResponseType> {
    const log = this.logger;

    if (this.retryAfter !== undefined) {
      const delay = Math.max(0, this.retryAfter - Date.now());

      log.info(`CDSSocketManager: waiting ${delay}ms before retrying`);
      await sleep(delay);
    }

    const auth = await this.getAuth();

    log.info('CDSSocketManager: connecting socket');
    const socket = await this.connect(auth).getResult();
    log.info('CDSSocketManager: connected socket');

    try {
      let { timeout = REQUEST_TIMEOUT } = options;

      // Handshake
      {
        const start = Date.now();
        await pTimeout(socket.handshake(), timeout);
        const duration = Date.now() - start;

        timeout = Math.max(timeout - duration, 0);
      }

      // Send request
      const { response, retryAfterSecs = 0 } = await pTimeout(
        socket.request(options),
        timeout
      );

      if (retryAfterSecs > 0) {
        this.retryAfter = Math.max(
          this.retryAfter ?? Date.now(),
          Date.now() + retryAfterSecs * durations.SECOND
        );
      }

      return response;
    } finally {
      log.info('CDSSocketManager: closing socket');
      socket.close(3000, 'Normal');
    }
  }

  private connect(auth: CDSAuthType): AbortableProcess<Socket> {
    return connectWebSocket<Socket>({
      name: 'CDSSocket',
      url: this.getSocketUrl(),
      version: this.options.version,
      proxyAgent: this.proxyAgent,
      certificateAuthority: this.options.certificateAuthority,
      extraHeaders: {
        authorization: getBasicAuth(auth),
      },

      createResource: (socket: WebSocket): Socket => {
        return this.createSocket(socket);
      },
    });
  }

  protected abstract getSocketUrl(): string;

  protected abstract createSocket(socket: WebSocket): Socket;
}
