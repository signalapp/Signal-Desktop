// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import ProxyAgent from 'proxy-agent';
import { HsmEnclaveClient, PublicKey } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';

import * as Bytes from '../Bytes';
import type { AbortableProcess } from '../util/AbortableProcess';
import * as log from '../logging/log';
import type { UUIDStringType } from '../types/UUID';
import { CDSSocket } from './CDSSocket';
import { connect as connectWebSocket } from './WebSocket';

export type CDSSocketManagerOptionsType = Readonly<{
  url: string;
  publicKey: string;
  codeHash: string;
  certificateAuthority: string;
  proxyUrl?: string;
  version: string;
}>;

export class CDSSocketManager {
  private readonly publicKey: PublicKey;

  private readonly codeHash: Buffer;

  private readonly proxyAgent?: ReturnType<typeof ProxyAgent>;

  constructor(private readonly options: CDSSocketManagerOptionsType) {
    this.publicKey = PublicKey.deserialize(
      Buffer.from(Bytes.fromHex(options.publicKey))
    );
    this.codeHash = Buffer.from(Bytes.fromHex(options.codeHash));
    if (options.proxyUrl) {
      this.proxyAgent = new ProxyAgent(options.proxyUrl);
    }
  }

  public async request({
    e164s,
    timeout,
  }: {
    e164s: ReadonlyArray<string>;
    timeout?: number;
  }): Promise<ReadonlyArray<UUIDStringType | null>> {
    log.info('CDSSocketManager: connecting socket');
    const socket = await this.connect().getResult();
    log.info('CDSSocketManager: connected socket');

    try {
      return await socket.request({ e164s, timeout });
    } finally {
      log.info('CDSSocketManager: closing socket');
      socket.close(3000, 'Normal');
    }
  }

  private connect(): AbortableProcess<CDSSocket> {
    const enclaveClient = HsmEnclaveClient.new(this.publicKey, [this.codeHash]);

    const {
      publicKey: publicKeyHex,
      codeHash: codeHashHex,
      version,
    } = this.options;

    const url = `${this.options.url}/discovery/${publicKeyHex}/${codeHashHex}`;

    return connectWebSocket<CDSSocket>({
      url,
      version,
      proxyAgent: this.proxyAgent,
      certificateAuthority: this.options.certificateAuthority,

      createResource: (socket: WebSocket): CDSSocket => {
        return new CDSSocket(socket, enclaveClient);
      },
    });
  }
}
