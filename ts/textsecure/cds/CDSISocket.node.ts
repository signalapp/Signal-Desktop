// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Cds2Client } from '@signalapp/libsignal-client';

import { strictAssert } from '../../util/assert.std.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import { CDSSocketBase, CDSSocketState } from './CDSSocketBase.node.js';
import type { CDSSocketBaseOptionsType } from './CDSSocketBase.node.js';

export type CDSISocketOptionsType = Readonly<{
  mrenclave: Uint8Array;
}> &
  CDSSocketBaseOptionsType;

export class CDSISocket extends CDSSocketBase<CDSISocketOptionsType> {
  #privCdsClient: Cds2Client | undefined;

  public override async handshake(): Promise<void> {
    strictAssert(
      this.state === CDSSocketState.Open,
      'CDSI handshake called twice'
    );
    this.state = CDSSocketState.Handshake;

    {
      const { done, value: attestationMessage } =
        await this.socketIterator.next();
      strictAssert(!done, 'CDSI socket closed before handshake');

      const earliestValidTimestamp = new Date();

      strictAssert(
        this.#privCdsClient === undefined,
        'CDSI handshake called twice'
      );
      this.#privCdsClient = Cds2Client.new(
        this.options.mrenclave,
        attestationMessage,
        earliestValidTimestamp
      );
    }

    this.socket.sendBytes(Buffer.from(this.#cdsClient.initialRequest()));

    {
      const { done, value: message } = await this.socketIterator.next();
      strictAssert(!done, 'CDSI socket expected handshake data');

      this.#cdsClient.completeHandshake(message);
    }

    this.state = CDSSocketState.Established;
  }

  protected override async sendRequest(
    _version: number,
    request: Uint8Array
  ): Promise<void> {
    this.socket.sendBytes(
      Buffer.from(this.#cdsClient.establishedSend(request))
    );

    const { done, value: ciphertext } = await this.socketIterator.next();
    strictAssert(!done, 'CDSISocket.sendRequest(): expected token message');

    const message = await this.decryptResponse(ciphertext);

    this.logger.info('CDSISocket.sendRequest(): processing token message');

    const { token } = Proto.CDSClientResponse.decode(message);
    strictAssert(token, 'CDSISocket.sendRequest(): expected token');

    this.socket.sendBytes(
      Buffer.from(
        this.#cdsClient.establishedSend(
          Proto.CDSClientRequest.encode({
            tokenAck: true,
          }).finish()
        )
      )
    );
  }

  protected override async decryptResponse(
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    return this.#cdsClient.establishedRecv(ciphertext);
  }

  //
  // Private
  //

  get #cdsClient(): Cds2Client {
    strictAssert(this.#privCdsClient, 'CDSISocket did not start handshake');
    return this.#privCdsClient;
  }
}
