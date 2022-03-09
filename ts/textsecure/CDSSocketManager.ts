// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import ProxyAgent from 'proxy-agent';
import { HsmEnclaveClient, PublicKey } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';

import * as Bytes from '../Bytes';
import { prefixPublicKey } from '../Curve';
import type { AbortableProcess } from '../util/AbortableProcess';
import * as durations from '../util/durations';
import { getBasicAuth } from '../util/getBasicAuth';
import { sleep } from '../util/sleep';
import * as log from '../logging/log';
import { CDSSocket } from './CDSSocket';
import type {
  CDSAuthType,
  CDSRequestOptionsType,
  CDSSocketDictionaryType,
} from './CDSSocket';
import { connect as connectWebSocket } from './WebSocket';

export type CDSSocketManagerOptionsType = Readonly<{
  url: string;
  publicKey: string;
  codeHashes: ReadonlyArray<string>;
  certificateAuthority: string;
  proxyUrl?: string;
  version: string;
}>;

export type CDSResponseType = CDSSocketDictionaryType;

export class CDSSocketManager {
  private readonly publicKey: PublicKey;

  private readonly codeHashes: Array<Buffer>;

  private readonly proxyAgent?: ReturnType<typeof ProxyAgent>;

  private retryAfter?: number;

  constructor(private readonly options: CDSSocketManagerOptionsType) {
    this.publicKey = PublicKey.deserialize(
      Buffer.from(prefixPublicKey(Bytes.fromHex(options.publicKey)))
    );
    this.codeHashes = options.codeHashes.map(hash =>
      Buffer.from(Bytes.fromHex(hash))
    );
    if (options.proxyUrl) {
      this.proxyAgent = new ProxyAgent(options.proxyUrl);
    }
  }

  public async request(
    options: CDSRequestOptionsType
  ): Promise<CDSResponseType> {
    if (this.retryAfter !== undefined) {
      const delay = Math.max(0, this.retryAfter - Date.now());

      log.info(`CDSSocketManager: waiting ${delay}ms before retrying`);
      await sleep(delay);
    }

    const { auth } = options;

    log.info('CDSSocketManager: connecting socket');
    const socket = await this.connect(auth).getResult();
    log.info('CDSSocketManager: connected socket');

    try {
      const { dictionary, retryAfterSecs = 0 } = await socket.request(options);

      if (retryAfterSecs > 0) {
        this.retryAfter = Math.max(
          this.retryAfter ?? Date.now(),
          Date.now() + retryAfterSecs * durations.SECOND
        );
      }

      return dictionary;
    } finally {
      log.info('CDSSocketManager: closing socket');
      socket.close(3000, 'Normal');
    }
  }

  private connect(auth: CDSAuthType): AbortableProcess<CDSSocket> {
    const enclaveClient = HsmEnclaveClient.new(this.publicKey, this.codeHashes);

    const { publicKey: publicKeyHex, codeHashes, version } = this.options;

    const url = `${
      this.options.url
    }/discovery/${publicKeyHex}/${codeHashes.join(',')}`;

    return connectWebSocket<CDSSocket>({
      name: 'CDSSocket',
      url,
      version,
      proxyAgent: this.proxyAgent,
      certificateAuthority: this.options.certificateAuthority,
      extraHeaders: {
        authorization: getBasicAuth(auth),
      },

      createResource: (socket: WebSocket): CDSSocket => {
        return new CDSSocket(socket, enclaveClient);
      },
    });
  }
}
