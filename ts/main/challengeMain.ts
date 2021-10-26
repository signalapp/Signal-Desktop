// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import type { IpcMainEvent } from 'electron';
import { ipcMain as ipc } from 'electron';

import type { IPCRequest, IPCResponse, ChallengeResponse } from '../challenge';

export class ChallengeMainHandler {
  private handlers: Array<(response: ChallengeResponse) => void> = [];

  constructor() {
    this.initialize();
  }

  public handleCaptcha(captcha: string): void {
    const response: ChallengeResponse = { captcha };

    const { handlers } = this;
    this.handlers = [];
    for (const resolve of handlers) {
      resolve(response);
    }
  }

  private async onRequest(
    event: IpcMainEvent,
    request: IPCRequest
  ): Promise<void> {
    console.log('Received challenge request, waiting for response');

    const data = await new Promise<ChallengeResponse>(resolve => {
      this.handlers.push(resolve);
    });

    console.log('Sending challenge response', data);

    const ipcResponse: IPCResponse = {
      seq: request.seq,
      data,
    };
    event.sender.send('challenge:response', ipcResponse);
  }

  private initialize(): void {
    ipc.on('challenge:request', (event, request) => {
      this.onRequest(event, request);
    });
  }
}
