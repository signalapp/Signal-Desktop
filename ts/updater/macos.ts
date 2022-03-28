// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream, statSync } from 'fs';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';

import { v4 as getGuid } from 'uuid';
import { autoUpdater } from 'electron';
import got from 'got';

import { Updater } from './common';
import { explodePromise } from '../util/explodePromise';
import * as Errors from '../types/errors';
import { markShouldQuit } from '../../app/window_state';
import { DialogType } from '../types/Dialogs';

export class MacOSUpdater extends Updater {
  protected async deletePreviousInstallers(): Promise<void> {
    // No installers are cache on macOS
  }

  protected async installUpdate(updateFilePath: string): Promise<void> {
    const { logger } = this;

    try {
      await this.handToAutoUpdate(updateFilePath);
    } catch (error) {
      const readOnly = 'Cannot update while running on a read-only volume';
      const message: string = error.message || '';
      this.markCannotUpdate(
        error,
        message.includes(readOnly)
          ? DialogType.MacOS_Read_Only
          : DialogType.Cannot_Update
      );

      throw error;
    }

    // At this point, closing the app will cause the update to be installed automatically
    //   because Squirrel has cached the update file and will do the right thing.
    logger.info('downloadAndInstall: showing update dialog...');

    this.setUpdateListener(async () => {
      logger.info('performUpdate: calling quitAndInstall...');
      markShouldQuit();
      autoUpdater.quitAndInstall();
    });
  }

  private async handToAutoUpdate(filePath: string): Promise<void> {
    const { logger } = this;
    const { promise, resolve, reject } = explodePromise<void>();

    const token = getGuid();
    const updateFileUrl = generateFileUrl();
    const server = createServer();
    let serverUrl: string;

    server.on('error', (error: Error) => {
      logger.error(`handToAutoUpdate: ${Errors.toLogFormat(error)}`);
      this.shutdown(server);
      reject(error);
    });

    server.on(
      'request',
      (request: IncomingMessage, response: ServerResponse) => {
        const { url } = request;

        if (url === '/') {
          const absoluteUrl = `${serverUrl}${updateFileUrl}`;
          writeJSONResponse(absoluteUrl, response);

          return;
        }

        if (url === '/token') {
          writeTokenResponse(token, response);

          return;
        }

        if (!url || !url.startsWith(updateFileUrl)) {
          this.logger.error(
            `write404: Squirrel requested unexpected url '${url}'`
          );
          response.writeHead(404);
          response.end();
          return;
        }

        this.pipeUpdateToSquirrel(filePath, server, response, reject);
      }
    );

    server.listen(0, '127.0.0.1', async () => {
      try {
        serverUrl = getServerUrl(server);

        autoUpdater.on('error', (...args) => {
          logger.error('autoUpdater: error', ...args.map(Errors.toLogFormat));

          const [error] = args;
          reject(error);
        });
        autoUpdater.on('update-downloaded', () => {
          logger.info('autoUpdater: update-downloaded event fired');
          this.shutdown(server);
          resolve();
        });

        const response = await got.get(`${serverUrl}/token`);
        if (JSON.parse(response.body).token !== token) {
          throw new Error(
            'autoUpdater: did not receive token back from updates server'
          );
        }

        autoUpdater.setFeedURL({
          url: serverUrl,
          headers: { 'Cache-Control': 'no-cache' },
        });
        autoUpdater.checkForUpdates();
      } catch (error) {
        reject(error);
      }
    });

    return promise;
  }

  private pipeUpdateToSquirrel(
    filePath: string,
    server: Server,
    response: ServerResponse,
    reject: (error: Error) => void
  ): void {
    const { logger } = this;

    const updateFileSize = getFileSize(filePath);
    const readStream = createReadStream(filePath);

    response.on('error', (error: Error) => {
      logger.error(
        `pipeUpdateToSquirrel: update file download request had an error ${Errors.toLogFormat(
          error
        )}`
      );
      this.shutdown(server);
      reject(error);
    });

    readStream.on('error', (error: Error) => {
      logger.error(
        `pipeUpdateToSquirrel: read stream error response: ${Errors.toLogFormat(
          error
        )}`
      );
      this.shutdown(server, response);
      reject(error);
    });

    response.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': updateFileSize,
    });

    readStream.pipe(response);
  }

  private shutdown(server: Server, response?: ServerResponse): void {
    const { logger } = this;

    try {
      if (server) {
        server.close();
      }
    } catch (error) {
      logger.error(
        `shutdown: Error closing server ${Errors.toLogFormat(error)}`
      );
    }

    try {
      if (response) {
        response.end();
      }
    } catch (endError) {
      logger.error(
        `shutdown: couldn't end response ${Errors.toLogFormat(endError)}`
      );
    }
  }
}

// Helpers

function writeJSONResponse(url: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      url,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function writeTokenResponse(token: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      token,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function getServerUrl(server: Server) {
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}
function generateFileUrl(): string {
  return `/${getGuid()}.zip`;
}

function getFileSize(targetPath: string): number {
  const { size } = statSync(targetPath);

  return size;
}
