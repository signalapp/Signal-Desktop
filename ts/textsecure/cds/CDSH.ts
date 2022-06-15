// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { HsmEnclaveClient } from '@signalapp/libsignal-client';
import type { connection as WebSocket } from 'websocket';

import * as Bytes from '../../Bytes';
import { CDSHSocket } from './CDSHSocket';
import type { CDSSocketManagerBaseOptionsType } from './CDSSocketManagerBase';
import { CDSSocketManagerBase } from './CDSSocketManagerBase';

export type CDSHOptionsType = Readonly<{
  publicKey: string;
  codeHashes: ReadonlyArray<string>;
}> &
  CDSSocketManagerBaseOptionsType;

export class CDSH extends CDSSocketManagerBase<CDSHSocket, CDSHOptionsType> {
  private readonly publicKey: Buffer;

  private readonly codeHashes: Array<Buffer>;

  constructor(options: CDSHOptionsType) {
    super(options);

    this.publicKey = Buffer.from(Bytes.fromHex(options.publicKey));
    this.codeHashes = options.codeHashes.map(hash =>
      Buffer.from(Bytes.fromHex(hash))
    );
  }

  protected override getSocketUrl(): string {
    const { publicKey: publicKeyHex, codeHashes } = this.options;

    return (
      `${this.options.url}/discovery/${publicKeyHex}/` +
      `${codeHashes.join(',')}`
    );
  }

  protected override createSocket(socket: WebSocket): CDSHSocket {
    const enclaveClient = HsmEnclaveClient.new(this.publicKey, this.codeHashes);

    return new CDSHSocket({
      logger: this.logger,
      socket,
      enclaveClient,
    });
  }
}
