// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { HsmEnclaveClient } from '@signalapp/libsignal-client';

import { strictAssert } from '../../util/assert';
import { CDSSocketBase, CDSSocketState } from './CDSSocketBase';
import type { CDSSocketBaseOptionsType } from './CDSSocketBase';

export type CDSHSocketOptionsType = Readonly<{
  enclaveClient: HsmEnclaveClient;
}> &
  CDSSocketBaseOptionsType;

export class CDSHSocket extends CDSSocketBase<CDSHSocketOptionsType> {
  public override async handshake(): Promise<void> {
    strictAssert(
      this.state === CDSSocketState.Open,
      'CDSH handshake called twice'
    );
    this.state = CDSSocketState.Handshake;

    // Handshake
    this.socket.sendBytes(this.options.enclaveClient.initialRequest());

    const { done, value: message } = await this.socketIterator.next();
    strictAssert(!done, 'Expected CDSH handshake response');

    this.options.enclaveClient.completeHandshake(message);
    this.state = CDSSocketState.Established;
  }

  protected override async sendRequest(
    version: number,
    request: Buffer
  ): Promise<void> {
    this.socket.sendBytes(
      this.options.enclaveClient.establishedSend(
        Buffer.concat([Buffer.from([version]), request])
      )
    );
  }

  protected override async decryptResponse(
    ciphertext: Buffer
  ): Promise<Buffer> {
    return this.options.enclaveClient.establishedRecv(ciphertext);
  }
}
