// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IpcMainEvent } from 'electron';
import { ipcMain as ipc } from 'electron';

import { createLogger } from '../logging/log.std.js';
import type {
  IPCRequest,
  IPCResponse,
  ChallengeResponse,
} from '../challenge.dom.js';
import { getEnvironment, Environment } from '../environment.std.js';

const log = createLogger('challengeMain');

export class ChallengeMainHandler {
  #handlers: Array<(response: ChallengeResponse) => void> = [];
  #hardcodedResult?: ChallengeResponse;

  constructor(hardcodedResult?: string) {
    if (hardcodedResult && getEnvironment() === Environment.Development) {
      this.#hardcodedResult = { captcha: hardcodedResult };
    }
    this.#initialize();
  }

  public handleCaptcha(captcha: string): void {
    const response: ChallengeResponse = { captcha };

    const handlers = this.#handlers;
    this.#handlers = [];

    log.info(
      'handleCaptcha: sending captcha response to ' +
        `${handlers.length} handlers`
    );
    for (const resolve of handlers) {
      resolve(response);
    }
  }

  async #onRequest(event: IpcMainEvent, request: IPCRequest): Promise<void> {
    const logId = `challengeMain.onRequest(${request.reason})`;
    log.info(`${logId}: received challenge request, waiting for response`);

    const start = Date.now();

    const data =
      this.#hardcodedResult ||
      (await new Promise<ChallengeResponse>(resolve => {
        this.#handlers.push(resolve);
      }));

    const duration = Date.now() - start;
    log.info(`${logId}: got response after ${duration}ms`);

    const ipcResponse: IPCResponse = {
      seq: request.seq,
      data,
    };
    event.sender.send('challenge:response', ipcResponse);
  }

  #initialize(): void {
    ipc.on('challenge:request', (event, request) => {
      void this.#onRequest(event, request);
    });
  }
}
