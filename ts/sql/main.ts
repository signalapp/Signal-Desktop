// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { Worker } from 'worker_threads';
import { format } from 'util';
import { app } from 'electron';

import { strictAssert } from '../util/assert';
import { explodePromise } from '../util/explodePromise';
import type { LoggerType } from '../types/Logging';
import { SqliteErrorKind } from './errors';
import type DB from './Server';

const MIN_TRACE_DURATION = 40;

export type InitializeOptions = Readonly<{
  appVersion: string;
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
      method: keyof typeof DB;
      args: ReadonlyArray<unknown>;
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
      errorKind: SqliteErrorKind | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: any;
    }>
  | WrappedWorkerLogEntry;

type PromisePair<T> = {
  resolve: (response: T) => void;
  reject: (error: Error) => void;
};

type KnownErrorResolverType = Readonly<{
  kind: SqliteErrorKind;
  resolve: (err: Error) => void;
}>;

export class MainSQL {
  private readonly worker: Worker;

  private isReady = false;

  private onReady: Promise<void> | undefined;

  private readonly onExit: Promise<void>;

  // Promise resolve callbacks for corruption and readonly errors.
  private errorResolvers = new Array<KnownErrorResolverType>();

  private seq = 0;

  private logger?: LoggerType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onResponse = new Map<number, PromisePair<any>>();

  private shouldTimeQueries = false;

  constructor() {
    const scriptDir = join(app.getAppPath(), 'ts', 'sql', 'mainWorker.js');
    this.worker = new Worker(scriptDir);

    this.worker.on('message', (wrappedResponse: WrappedWorkerResponse) => {
      if (wrappedResponse.type === 'log') {
        const { level, args } = wrappedResponse;
        strictAssert(this.logger !== undefined, 'Logger not initialized');
        this.logger[level](`MainSQL: ${format(...args)}`);
        return;
      }

      const { seq, error, errorKind, response } = wrappedResponse;

      const pair = this.onResponse.get(seq);
      this.onResponse.delete(seq);
      if (!pair) {
        throw new Error(`Unexpected worker response with seq: ${seq}`);
      }

      if (error) {
        const errorObj = new Error(error);
        this.onError(errorKind ?? SqliteErrorKind.Unknown, errorObj);

        pair.reject(errorObj);
      } else {
        pair.resolve(response);
      }
    });

    const { promise: onExit, resolve: resolveOnExit } = explodePromise<void>();
    this.onExit = onExit;
    this.worker.once('exit', resolveOnExit);
  }

  public async initialize({
    appVersion,
    configDir,
    key,
    logger,
  }: InitializeOptions): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    this.shouldTimeQueries = Boolean(process.env.TIME_QUERIES);

    this.logger = logger;

    this.onReady = this.send({
      type: 'init',
      options: { appVersion, configDir, key },
    });

    await this.onReady;

    this.onReady = undefined;
    this.isReady = true;
  }

  public whenCorrupted(): Promise<Error> {
    const { promise, resolve } = explodePromise<Error>();
    this.errorResolvers.push({ kind: SqliteErrorKind.Corrupted, resolve });
    return promise;
  }

  public whenReadonly(): Promise<Error> {
    const { promise, resolve } = explodePromise<Error>();
    this.errorResolvers.push({ kind: SqliteErrorKind.Readonly, resolve });
    return promise;
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

  public async sqlCall<Method extends keyof typeof DB>(
    method: Method,
    ...args: Parameters<typeof DB[Method]>
  ): Promise<ReturnType<typeof DB[Method]>> {
    if (this.onReady) {
      await this.onReady;
    }

    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    type SqlCallResult = Readonly<{
      result: ReturnType<typeof DB[Method]>;
      duration: number;
    }>;

    const { result, duration } = await this.send<SqlCallResult>({
      type: 'sqlCall',
      method,
      args,
    });

    if (this.shouldTimeQueries && !app.isPackaged) {
      const twoDecimals = Math.round(100 * duration) / 100;
      this.logger?.info(`MainSQL query: ${method}, duration=${twoDecimals}ms`);
    }
    if (duration > MIN_TRACE_DURATION) {
      strictAssert(this.logger !== undefined, 'Logger not initialized');
      this.logger.info(
        `MainSQL: slow query ${method} duration=${Math.round(duration)}ms`
      );
    }

    return result;
  }

  private async send<Response>(request: WorkerRequest): Promise<Response> {
    const { seq } = this;
    this.seq += 1;

    const { promise: result, resolve, reject } = explodePromise<Response>();
    this.onResponse.set(seq, { resolve, reject });

    const wrappedRequest: WrappedWorkerRequest = {
      seq,
      request,
    };
    this.worker.postMessage(wrappedRequest);

    return result;
  }

  private onError(errorKind: SqliteErrorKind, error: Error): void {
    if (errorKind === SqliteErrorKind.Unknown) {
      return;
    }

    const resolvers = new Array<(error: Error) => void>();
    this.errorResolvers = this.errorResolvers.filter(entry => {
      if (entry.kind === errorKind) {
        resolvers.push(entry.resolve);
        return false;
      }
      return true;
    });

    for (const resolve of resolvers) {
      resolve(error);
    }
  }
}
