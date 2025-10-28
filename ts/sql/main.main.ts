// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { format } from 'node:util';
import { app } from 'electron';

import { strictAssert } from '../util/assert.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import type { LoggerType } from '../types/Logging.std.js';
import * as Errors from '../types/errors.std.js';
import { SqliteErrorKind } from './errors.std.js';
import type {
  ServerReadableDirectInterface,
  ServerWritableDirectInterface,
} from './Interface.std.js';

const MIN_TRACE_DURATION = 40;

const WORKER_COUNT = 4;

const PAGING_QUERIES = new Set<keyof ServerReadableDirectInterface>([
  'pageMessages',
  'finishPageMessages',
  'getKnownMessageAttachments',
  'finishGetKnownMessageAttachments',
]);

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
      isPrimary: boolean;
    }
  | {
      type: 'close' | 'removeDB';
    }
  | {
      type: 'sqlCall:read';
      method: keyof ServerReadableDirectInterface;
      args: ReadonlyArray<unknown>;
    }
  | {
      type: 'sqlCall:write';
      method: keyof ServerWritableDirectInterface;
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
      error:
        | Readonly<{
            name: string;
            message: string;
            stack: string | undefined;
          }>
        | undefined;
      errorKind: SqliteErrorKind | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: any;
    }>
  | WrappedWorkerLogEntry;

type ResponseEntry<T> = {
  errorId: string;
  resolve: (response: T) => void;
  reject: (error: Error) => void;
};

type KnownErrorResolverType = Readonly<{
  kind: SqliteErrorKind;
  resolve: (err: Error) => void;
  once?: boolean;
}>;

type CreateWorkerResultType = Readonly<{
  worker: Worker;
  onExit: Promise<void>;
}>;

type PoolEntry = {
  readonly worker: Worker;
  load: number;
};

type QueryStatsType = {
  queryName: string;
  count: number;
  cumulative: number;
  max: number;
};

export type QueryStatsOptions = {
  maxQueriesToLog?: number;
  epochName?: string;
};

export class MainSQL {
  readonly #pool = new Array<PoolEntry>();
  #pauseWaiters: Array<() => void> | undefined;
  #isReady = false;
  #onReady: Promise<void> | undefined;
  readonly #onExit: Promise<unknown>;

  // Promise resolve callbacks for corruption and readonly errors.
  #errorResolvers = new Array<KnownErrorResolverType>();

  #seq = 0;
  #logger?: LoggerType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #onResponse = new Map<number, ResponseEntry<any>>();

  #shouldTimeQueries = false;
  #shouldTrackQueryStats = false;

  #queryStats?: {
    start: number;
    statsByQuery: Map<string, QueryStatsType>;
  };

  constructor() {
    const exitPromises = new Array<Promise<void>>();
    for (let i = 0; i < WORKER_COUNT; i += 1) {
      const { worker, onExit } = this.#createWorker();
      this.#pool.push({ worker, load: 0 });

      exitPromises.push(onExit);
    }
    this.#onExit = Promise.all(exitPromises);
  }

  public async initialize({
    appVersion,
    configDir,
    key,
    logger,
  }: InitializeOptions): Promise<void> {
    if (this.#isReady || this.#onReady) {
      throw new Error('Already initialized');
    }

    this.#shouldTimeQueries = Boolean(process.env.TIME_QUERIES);

    this.#logger = logger;

    this.#onReady = (async () => {
      const primary = this.#pool[0];
      const rest = this.#pool.slice(1);

      await this.#send(primary, {
        type: 'init',
        options: { appVersion, configDir, key },
        isPrimary: true,
      });

      await Promise.all(
        rest.map(worker =>
          this.#send(worker, {
            type: 'init',
            options: { appVersion, configDir, key },
            isPrimary: false,
          })
        )
      );
    })();

    await this.#onReady;

    this.#onReady = undefined;
    this.#isReady = true;
  }

  public pauseWriteAccess(): void {
    strictAssert(this.#pauseWaiters == null, 'Already paused');

    this.#pauseWaiters = [];
  }

  public resumeWriteAccess(): void {
    const pauseWaiters = this.#pauseWaiters;
    strictAssert(pauseWaiters != null, 'Not paused');
    this.#pauseWaiters = undefined;

    for (const waiter of pauseWaiters) {
      waiter();
    }
  }

  public whenCorrupted(): Promise<Error> {
    const { promise, resolve } = explodePromise<Error>();
    this.#errorResolvers.push({
      kind: SqliteErrorKind.Corrupted,
      resolve,
      once: true,
    });
    return promise;
  }

  public whenReadonly(): Promise<Error> {
    const { promise, resolve } = explodePromise<Error>();
    this.#errorResolvers.push({
      kind: SqliteErrorKind.Readonly,
      resolve,
      once: true,
    });
    return promise;
  }

  public onUnknownSqlError(callback: (error: Error) => void): void {
    this.#errorResolvers.push({
      kind: SqliteErrorKind.Unknown,
      resolve: callback,
    });
  }

  public async close(): Promise<void> {
    if (this.#onReady) {
      try {
        await this.#onReady;
      } catch (err) {
        this.#logger?.error(
          `MainSQL close, failed: ${Errors.toLogFormat(err)}`
        );
        // Init failed
        return;
      }
    }

    if (!this.#isReady) {
      throw new Error('Not initialized');
    }

    await this.#terminate({ type: 'close' });
    await this.#onExit;
  }

  public async removeDB(): Promise<void> {
    await this.#terminate({ type: 'removeDB' });
  }

  public async sqlRead<Method extends keyof ServerReadableDirectInterface>(
    method: Method,
    ...args: Parameters<ServerReadableDirectInterface[Method]>
  ): Promise<ReturnType<ServerReadableDirectInterface[Method]>> {
    type SqlCallResult = Readonly<{
      result: ReturnType<ServerReadableDirectInterface[Method]>;
      duration: number;
    }>;

    // pageMessages runs over several queries and needs to have access to
    // the same temporary table, it also creates temporary insert/update
    // triggers so it has to run on the same connection that updates the tables
    const isPaging = PAGING_QUERIES.has(method);

    const entry = isPaging ? this.#pool[0] : this.#getWorker();
    strictAssert(entry != null, 'Must have a pool entry');

    const { result, duration } = await this.#send<SqlCallResult>(entry, {
      type: 'sqlCall:read',
      method,
      args,
    });

    this.#traceDuration(method, duration);

    return result;
  }

  public async sqlWrite<Method extends keyof ServerWritableDirectInterface>(
    method: Method,
    ...args: Parameters<ServerWritableDirectInterface[Method]>
  ): Promise<ReturnType<ServerWritableDirectInterface[Method]>> {
    type Result = ReturnType<ServerWritableDirectInterface[Method]>;
    type SqlCallResult = Readonly<{
      result: Result;
      duration: number;
    }>;

    while (this.#pauseWaiters != null) {
      const { promise, resolve } = explodePromise<void>();
      this.#pauseWaiters.push(resolve);
      // eslint-disable-next-line no-await-in-loop
      await promise;
    }

    const primary = this.#pool[0];

    const { result, duration } = await this.#send<SqlCallResult>(primary, {
      type: 'sqlCall:write',
      method,
      args,
    });

    this.#traceDuration(method, duration);

    return result;
  }

  public startTrackingQueryStats(): void {
    if (this.#shouldTrackQueryStats) {
      this.#logQueryStats({});
      this.#logger?.info('Resetting query stats');
    }
    this.#resetQueryStats();
    this.#shouldTrackQueryStats = true;
  }

  public stopTrackingQueryStats(options: QueryStatsOptions): void {
    if (this.#shouldTrackQueryStats) {
      this.#logQueryStats(options);
    }
    this.#queryStats = undefined;
    this.#shouldTrackQueryStats = false;
  }

  async #send<Response>(
    entry: PoolEntry,
    request: WorkerRequest
  ): Promise<Response> {
    let errorId: string = request.type;
    if (request.type === 'sqlCall:read' || request.type === 'sqlCall:write') {
      errorId = `${request.type}(${request.method})`;
      if (this.#onReady) {
        await this.#onReady;
      }

      if (!this.#isReady) {
        throw new Error('Not initialized');
      }
    }

    const seq = this.#seq;
    // eslint-disable-next-line no-bitwise
    this.#seq = (this.#seq + 1) >>> 0;

    const { promise: result, resolve, reject } = explodePromise<Response>();
    this.#onResponse.set(seq, {
      errorId,
      resolve,
      reject,
    });

    const wrappedRequest: WrappedWorkerRequest = {
      seq,
      request,
    };
    entry.worker.postMessage(wrappedRequest);

    try {
      // eslint-disable-next-line no-param-reassign
      entry.load += 1;
      return await result;
    } finally {
      // eslint-disable-next-line no-param-reassign
      entry.load -= 1;
    }
  }

  async #terminate(request: WorkerRequest): Promise<void> {
    const primary = this.#pool[0];
    const rest = this.#pool.slice(1);

    // Terminate non-primary workers first
    await Promise.all(rest.map(worker => this.#send(worker, request)));

    // Primary last
    await this.#send(primary, request);
  }

  #onError(errorKind: SqliteErrorKind, error: Error): void {
    const resolvers = new Array<(error: Error) => void>();
    this.#errorResolvers = this.#errorResolvers.filter(entry => {
      if (entry.kind === errorKind) {
        resolvers.push(entry.resolve);
        if (entry.once) {
          return false;
        }
      }
      return true;
    });

    for (const resolve of resolvers) {
      resolve(error);
    }
  }

  #resetQueryStats() {
    this.#queryStats = { start: Date.now(), statsByQuery: new Map() };
  }

  #roundDuration(duration: number): number {
    return Math.round(100 * duration) / 100;
  }

  #logQueryStats({ maxQueriesToLog = 10, epochName }: QueryStatsOptions) {
    if (!this.#queryStats) {
      return;
    }
    const epochDuration = Date.now() - this.#queryStats.start;
    const sortedByCumulativeDuration = [
      ...this.#queryStats.statsByQuery.values(),
    ].sort((a, b) => (b.cumulative ?? 0) - (a.cumulative ?? 0));
    const cumulativeDuration = sortedByCumulativeDuration.reduce(
      (sum, stats) => sum + stats.cumulative,
      0
    );
    this.#logger?.info(
      `Top ${maxQueriesToLog} queries by cumulative duration (ms) over last ${epochDuration}ms` +
        `${epochName ? ` during '${epochName}'` : ''}: ` +
        `${sortedByCumulativeDuration
          .slice(0, maxQueriesToLog)
          .map(stats => {
            return (
              `${stats.queryName}: cumulative ${this.#roundDuration(stats.cumulative)} | ` +
              `average: ${this.#roundDuration(stats.cumulative / (stats.count || 1))} | ` +
              `max: ${this.#roundDuration(stats.max)} | ` +
              `count: ${stats.count}`
            );
          })
          .join(' ||| ')}` +
        `; Total cumulative duration of all SQL queries during this epoch: ${this.#roundDuration(cumulativeDuration)}ms`
    );
  }

  #traceDuration(method: string, duration: number): void {
    if (this.#shouldTrackQueryStats) {
      if (!this.#queryStats) {
        this.#resetQueryStats();
      }
      strictAssert(this.#queryStats, 'has been initialized');
      let currentStats = this.#queryStats.statsByQuery.get(method);
      if (!currentStats) {
        currentStats = { count: 0, cumulative: 0, queryName: method, max: 0 };
        this.#queryStats.statsByQuery.set(method, currentStats);
      }
      currentStats.count += 1;
      currentStats.cumulative += duration;
      currentStats.max = Math.max(currentStats.max, duration);
    }

    if (this.#shouldTimeQueries && !app.isPackaged) {
      const twoDecimals = this.#roundDuration(duration);
      this.#logger?.info(`MainSQL query: ${method}, duration=${twoDecimals}ms`);
    }
    if (duration > MIN_TRACE_DURATION) {
      strictAssert(this.#logger !== undefined, 'Logger not initialized');
      this.#logger.info(
        `MainSQL: slow query ${method} duration=${Math.round(duration)}ms`
      );
    }
  }

  #createWorker(): CreateWorkerResultType {
    const scriptPath = join(
      app.getAppPath(),
      'ts',
      'sql',
      'mainWorker.node.js'
    );

    const worker = new Worker(scriptPath);

    worker.on('message', (wrappedResponse: WrappedWorkerResponse) => {
      if (wrappedResponse.type === 'log') {
        const { level, args } = wrappedResponse;
        strictAssert(this.#logger !== undefined, 'Logger not initialized');
        this.#logger[level](`MainSQL: ${format(...args)}`);
        return;
      }

      const { seq, error, errorKind, response } = wrappedResponse;

      const entry = this.#onResponse.get(seq);
      this.#onResponse.delete(seq);
      if (!entry) {
        throw new Error(`Unexpected worker response with seq: ${seq}`);
      }

      if (error) {
        const errorObj = new Error(`${entry.errorId}: ${error.message}`);
        errorObj.stack = `${entry.errorId}: ${error.stack}`;
        errorObj.name = error.name;
        this.#onError(errorKind ?? SqliteErrorKind.Unknown, errorObj);

        entry.reject(errorObj);
      } else {
        entry.resolve(response);
      }
    });

    const { promise: onExit, resolve: resolveOnExit } = explodePromise<void>();
    worker.once('exit', resolveOnExit);

    return { worker, onExit };
  }

  // Find first pool entry with minimal load
  #getWorker(): PoolEntry {
    let min = this.#pool[0];
    for (const entry of this.#pool) {
      if (min && min.load < entry.load) {
        continue;
      }

      min = entry;
    }
    return min;
  }
}
