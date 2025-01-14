// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Net } from '@signalapp/libsignal-client';
import type { connection as WebSocket } from 'websocket';

import * as Bytes from '../../Bytes';
import { CDSISocket } from './CDSISocket';
import type { CDSSocketManagerBaseOptionsType } from './CDSSocketManagerBase';
import { CDSSocketManagerBase } from './CDSSocketManagerBase';

export type CDSIOptionsType = Readonly<{
  mrenclave: string;
}> &
  CDSSocketManagerBaseOptionsType;

export class CDSI extends CDSSocketManagerBase<CDSISocket, CDSIOptionsType> {
  readonly #mrenclave: Buffer;

  constructor(libsignalNet: Net.Net, options: CDSIOptionsType) {
    super(libsignalNet, options);

    this.#mrenclave = Buffer.from(Bytes.fromHex(options.mrenclave));
  }

  protected override getSocketUrl(): string {
    const { mrenclave } = this.options;

    return `${this.options.url}/v1/${mrenclave}/discovery`;
  }

  protected override createSocket(socket: WebSocket): CDSISocket {
    return new CDSISocket({
      logger: this.logger,
      socket,
      mrenclave: this.#mrenclave,
    });
  }
}
