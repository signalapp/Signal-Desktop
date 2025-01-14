// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, dirname } from 'node:path';
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ipcMain } from 'electron';
import { LRUCache } from 'lru-cache';
import got from 'got';
import PQueue from 'p-queue';

import type {
  OptionalResourceType,
  OptionalResourcesDictType,
} from '../ts/types/OptionalResource';
import { OptionalResourcesDictSchema } from '../ts/types/OptionalResource';
import * as log from '../ts/logging/log';
import { getGotOptions } from '../ts/updater/got';
import { drop } from '../ts/util/drop';
import { parseUnknown } from '../ts/util/schemas';

const RESOURCES_DICT_PATH = join(
  __dirname,
  '..',
  'build',
  'optional-resources.json'
);

const MAX_CACHE_SIZE = 50 * 1024 * 1024;

export class OptionalResourceService {
  #maybeDeclaration: OptionalResourcesDictType | undefined;

  readonly #cache = new LRUCache<string, Buffer>({
    maxSize: MAX_CACHE_SIZE,

    sizeCalculation: buf => buf.length,
  });

  readonly #fileQueues = new Map<string, PQueue>();

  private constructor(private readonly resourcesDir: string) {
    ipcMain.handle('OptionalResourceService:getData', (_event, name) =>
      this.getData(name)
    );

    drop(this.#lazyInit());
  }

  public static create(resourcesDir: string): OptionalResourceService {
    return new OptionalResourceService(resourcesDir);
  }

  public async getData(name: string): Promise<Buffer | undefined> {
    await this.#lazyInit();

    const decl = this.#declaration[name];
    if (!decl) {
      return undefined;
    }

    const inMemory = this.#cache.get(name);
    if (inMemory) {
      return inMemory;
    }

    const filePath = join(this.resourcesDir, name);
    return this.#queueFileWork(filePath, async () => {
      try {
        const onDisk = await readFile(filePath);
        const digest = createHash('sha512').update(onDisk).digest();

        // Same digest and size
        if (
          timingSafeEqual(digest, Buffer.from(decl.digest, 'base64')) &&
          onDisk.length === decl.size
        ) {
          log.warn(`OptionalResourceService: loaded ${name} from disk`);
          this.#cache.set(name, onDisk);
          return onDisk;
        }

        log.warn(`OptionalResourceService: ${name} is no longer valid on disk`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // We get here if file doesn't exist or if its digest/size is different
      try {
        await unlink(filePath);
      } catch {
        // Just do our best effort and move forward
      }

      return this.#fetch(name, decl, filePath);
    });
  }

  //
  // Private
  //

  async #lazyInit(): Promise<void> {
    if (this.#maybeDeclaration !== undefined) {
      return;
    }

    const json: unknown = JSON.parse(
      await readFile(RESOURCES_DICT_PATH, 'utf8')
    );
    this.#maybeDeclaration = parseUnknown(OptionalResourcesDictSchema, json);

    // Clean unknown resources
    let subPaths: Array<string>;
    try {
      subPaths = await readdir(this.resourcesDir);
    } catch (error) {
      // Directory wasn't created yet
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    await Promise.all(
      subPaths.map(async subPath => {
        if (this.#declaration[subPath]) {
          return;
        }

        const fullPath = join(this.resourcesDir, subPath);

        try {
          await unlink(fullPath);
        } catch (error) {
          log.error(
            `OptionalResourceService: failed to cleanup ${subPath}`,
            error
          );
        }
      })
    );
  }

  get #declaration(): OptionalResourcesDictType {
    if (this.#maybeDeclaration === undefined) {
      throw new Error('optional-resources.json not loaded yet');
    }
    return this.#maybeDeclaration;
  }

  async #queueFileWork<R>(
    filePath: string,
    body: () => Promise<R>
  ): Promise<R> {
    let queue = this.#fileQueues.get(filePath);
    if (!queue) {
      queue = new PQueue({ concurrency: 1 });
      this.#fileQueues.set(filePath, queue);
    }
    try {
      return await queue.add(body);
    } finally {
      if (queue.size === 0) {
        this.#fileQueues.delete(filePath);
      }
    }
  }

  async #fetch(
    name: string,
    decl: OptionalResourceType,
    destPath: string
  ): Promise<Buffer> {
    const result = await got(decl.url, await getGotOptions()).buffer();

    this.#cache.set(name, result);

    try {
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, result);
    } catch (error) {
      log.error('OptionalResourceService: failed to save file', error);
      // Still return the data that we just fetched
    }

    return result;
  }
}
