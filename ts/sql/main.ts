// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { join } from 'path';
import { Worker } from 'worker_threads';

const ASAR_PATTERN = /app\.asar$/;
const MIN_TRACE_DURATION = 10;

export type InitializeOptions = {
  readonly configDir: string;
  readonly key: string;
};

export type WorkerRequest =
  | {
      readonly type: 'init';
      readonly options: InitializeOptions;
    }
  | {
      readonly type: 'close';
    }
  | {
      readonly type: 'sqlCall';
      readonly method: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readonly args: ReadonlyArray<any>;
    };

export type WrappedWorkerRequest = {
  readonly seq: number;
  readonly request: WorkerRequest;
};

export type WrappedWorkerResponse = {
  readonly seq: number;
  readonly error: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly response: any;
};

type PromisePair<T> = {
  resolve: (response: T) => void;
  reject: (error: Error) => void;
};

export class MainSQL {
  private readonly worker: Worker;

  private isReady = false;

  private onReady: Promise<void> | undefined;

  private readonly onExit: Promise<void>;

  private seq = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onResponse = new Map<number, PromisePair<any>>();

  constructor() {
    let appDir = join(__dirname, '..', '..');
    let isBundled = false;

    if (ASAR_PATTERN.test(appDir)) {
      appDir = appDir.replace(ASAR_PATTERN, 'app.asar.unpacked');
      isBundled = true;
    }

    const scriptDir = join(appDir, 'ts', 'sql');
    this.worker = new Worker(
      join(scriptDir, isBundled ? 'mainWorker.bundle.js' : 'mainWorker.js')
    );

    this.worker.on('message', (wrappedResponse: WrappedWorkerResponse) => {
      const { seq, error, response } = wrappedResponse;

      const pair = this.onResponse.get(seq);
      this.onResponse.delete(seq);
      if (!pair) {
        throw new Error(`Unexpected worker response with seq: ${seq}`);
      }

      if (error) {
        pair.reject(new Error(error));
      } else {
        pair.resolve(response);
      }
    });

    this.onExit = new Promise<void>(resolve => {
      this.worker.once('exit', resolve);
    });
  }

  public async initialize(options: InitializeOptions): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    this.onReady = this.send({ type: 'init', options });

    await this.onReady;

    this.onReady = undefined;
    this.isReady = true;
  }

  public async close(): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    await this.send({ type: 'close' });
    await this.onExit;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async sqlCall(method: string, args: ReadonlyArray<any>): Promise<any> {
    if (this.onReady) {
      await this.onReady;
    }

    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    const { result, duration } = await this.send({
      type: 'sqlCall',
      method,
      args,
    });

    if (duration > MIN_TRACE_DURATION) {
      console.log(`ts/sql/main: slow query ${method} duration=${duration}ms`);
    }

    return result;
  }

  private async send<Response>(request: WorkerRequest): Promise<Response> {
    const { seq } = this;
    this.seq += 1;

    const result = new Promise<Response>((resolve, reject) => {
      this.onResponse.set(seq, { resolve, reject });
    });

    const wrappedRequest: WrappedWorkerRequest = {
      seq,
      request,
    };
    this.worker.postMessage(wrappedRequest);

    return result;
  }
}
