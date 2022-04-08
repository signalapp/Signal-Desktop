// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { Worker } from 'worker_threads';
import { format } from 'util';
import { app } from 'electron';

import { strictAssert } from '../util/assert';
import { explodePromise } from '../util/explodePromise';
import type { LoggerType } from '../types/Logging';
import { isCorruptionError } from './errors';

const MIN_TRACE_DURATION = 40;

export type InitializeOptions = Readonly<{
  configDir: string;
  key: string;
  logger: LoggerType;
}>;

export type WorkerRequest = Readonly<
  | {
      type: 'init';
      options: Omit<InitializeOptions, 'logger'>;
    }
  | {
      type: 'close';
    }
  | {
      type: 'removeDB';
    }
  | {
      type: 'sqlCall';
      method: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: ReadonlyArray<any>;
    }
>;

export type WrappedWorkerRequest = Readonly<{
  seq: number;
  request: WorkerRequest;
}>;

export type WrappedWorkerLogEntry = Readonly<{
  type: 'log';
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  args: ReadonlyArray<unknown>;
}>;

export type WrappedWorkerResponse =
  | Readonly<{
      type: 'response';
      seq: number;
      error: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: any;
    }>
  | WrappedWorkerLogEntry;

type PromisePair<T> = {
  resolve: (response: T) => void;
  reject: (error: Error) => void;
};

export class MainSQL {
  private readonly worker: Worker;

  private isReady = false;

  private onReady: Promise<void> | undefined;

  private readonly onExit: Promise<void>;

  // This promise is resolved when any of the queries that we run against the
  // database reject with a corruption error (see `isCorruptionError`)
  private readonly onCorruption: Promise<Error>;

  private seq = 0;

  private logger?: LoggerType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onResponse = new Map<number, PromisePair<any>>();

  constructor() {
    const scriptDir = join(app.getAppPath(), 'ts', 'sql', 'mainWorker.js');
    this.worker = new Worker(scriptDir);

    const { promise: onCorruption, resolve: resolveCorruption } =
      explodePromise<Error>();
    this.onCorruption = onCorruption;

    this.worker.on('message', (wrappedResponse: WrappedWorkerResponse) => {
      if (wrappedResponse.type === 'log') {
        const { level, args } = wrappedResponse;
        strictAssert(this.logger !== undefined, 'Logger not initialized');
        this.logger[level](`MainSQL: ${format(...args)}`);
        return;
      }

      const { seq, error, response } = wrappedResponse;

      const pair = this.onResponse.get(seq);
      this.onResponse.delete(seq);
      if (!pair) {
        throw new Error(`Unexpected worker response with seq: ${seq}`);
      }

      if (error) {
        const errorObj = new Error(error);
        if (isCorruptionError(errorObj)) {
          resolveCorruption(errorObj);
        }

        pair.reject(errorObj);
      } else {
        pair.resolve(response);
      }
    });

    this.onExit = new Promise<void>(resolve => {
      this.worker.once('exit', resolve);
    });
  }

  public async initialize({
    configDir,
    key,
    logger,
  }: InitializeOptions): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    this.logger = logger;

    this.onReady = this.send({
      type: 'init',
      options: { configDir, key },
    });

    await this.onReady;

    this.onReady = undefined;
    this.isReady = true;
  }

  public whenCorrupted(): Promise<Error> {
    return this.onCorruption;
  }

  public async close(): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    await this.send({ type: 'close' });
    await this.onExit;
  }

  public async removeDB(): Promise<void> {
    await this.send({ type: 'removeDB' });
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
      strictAssert(this.logger !== undefined, 'Logger not initialized');
      this.logger.info(`MainSQL: slow query ${method} duration=${duration}ms`);
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
