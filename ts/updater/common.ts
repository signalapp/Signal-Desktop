// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import {
  createWriteStream,
  statSync,
  writeFile as writeFileCallback,
} from 'fs';
import { join, normalize, dirname } from 'path';
import { tmpdir } from 'os';
import { throttle } from 'lodash';

import type { ParserConfiguration } from 'dashdash';
import { createParser } from 'dashdash';
import ProxyAgent from 'proxy-agent';
import { FAILSAFE_SCHEMA, safeLoad } from 'js-yaml';
import { gt } from 'semver';
import config from 'config';
import type { StrictOptions as GotOptions } from 'got';
import got from 'got';
import { v4 as getGuid } from 'uuid';
import pify from 'pify';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import type { BrowserWindow } from 'electron';
import { app, ipcMain } from 'electron';

import * as durations from '../util/durations';
import { getTempPath } from '../util/attachments';
import { DialogType } from '../types/Dialogs';
import * as Errors from '../types/errors';
import { getUserAgent } from '../util/getUserAgent';
import { isAlpha, isBeta } from '../util/version';

import * as packageJson from '../../package.json';
import {
  hexToBinary,
  verifySignature,
  getSignatureFileName,
} from './signature';
import { isPathInside } from '../util/isPathInside';
import type { SettingsChannel } from '../main/settingsChannel';

import type { LoggerType } from '../types/Logging';

const writeFile = pify(writeFileCallback);
const mkdirpPromise = pify(mkdirp);
const rimrafPromise = pify(rimraf);
const { platform } = process;

export const GOT_CONNECT_TIMEOUT = 2 * 60 * 1000;
export const GOT_LOOKUP_TIMEOUT = 2 * 60 * 1000;
export const GOT_SOCKET_TIMEOUT = 2 * 60 * 1000;

const INTERVAL = 30 * durations.MINUTE;

type JSONUpdateSchema = {
  version: string;
  files: Array<{
    url: string;
    sha512: string;
    size: string;
    blockMapSize?: string;
  }>;
  path: string;
  sha512: string;
  releaseDate: string;
};

export type UpdateInformationType = {
  fileName: string;
  size: number;
  version: string;
};

export abstract class Updater {
  protected fileName: string | undefined;

  protected version: string | undefined;

  protected updateFilePath: string | undefined;

  constructor(
    protected readonly logger: LoggerType,
    private readonly settingsChannel: SettingsChannel,
    protected readonly getMainWindow: () => BrowserWindow | undefined
  ) {}

  //
  // Public APIs
  //

  public async force(): Promise<void> {
    return this.checkForUpdatesMaybeInstall(true);
  }

  public async start(): Promise<void> {
    this.logger.info('updater/start: starting checks...');

    app.once('quit', () => this.quitHandler());

    setInterval(async () => {
      try {
        await this.checkForUpdatesMaybeInstall();
      } catch (error) {
        this.logger.error(`updater/start: ${Errors.toLogFormat(error)}`);
      }
    }, INTERVAL);

    await this.deletePreviousInstallers();
    await this.checkForUpdatesMaybeInstall();
  }

  public quitHandler(): void {
    if (this.updateFilePath) {
      this.deleteCache(this.updateFilePath);
    }
  }

  //
  // Abstract methods
  //

  protected abstract deletePreviousInstallers(): Promise<void>;

  protected abstract installUpdate(updateFilePath: string): Promise<void>;

  //
  // Protected methods
  //

  protected setUpdateListener(performUpdateCallback: () => void): void {
    ipcMain.removeAllListeners('start-update');
    ipcMain.once('start-update', performUpdateCallback);
  }

  //
  // Private methods
  //

  private async downloadAndInstall(
    newFileName: string,
    newVersion: string,
    updateOnProgress?: boolean
  ): Promise<void> {
    const { logger } = this;
    try {
      const oldFileName = this.fileName;
      const oldVersion = this.version;

      if (this.updateFilePath) {
        this.deleteCache(this.updateFilePath);
      }
      this.fileName = newFileName;
      this.version = newVersion;

      try {
        this.updateFilePath = await this.downloadUpdate(
          this.fileName,
          updateOnProgress
        );
      } catch (error) {
        // Restore state in case of download error
        this.fileName = oldFileName;
        this.version = oldVersion;
        throw error;
      }

      const publicKey = hexToBinary(config.get('updatesPublicKey'));
      const verified = await verifySignature(
        this.updateFilePath,
        this.version,
        publicKey
      );
      if (!verified) {
        // Note: We don't delete the cache here, because we don't want to continually
        //   re-download the broken release. We will download it only once per launch.
        throw new Error(
          'Downloaded update did not pass signature verification ' +
            `(version: '${this.version}'; fileName: '${this.fileName}')`
        );
      }

      await this.installUpdate(this.updateFilePath);

      const mainWindow = this.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('show-update-dialog', DialogType.Update, {
          version: this.version,
        });
      } else {
        logger.warn(
          'downloadAndInstall: no mainWindow, cannot show update dialog'
        );
      }
    } catch (error) {
      logger.error(`downloadAndInstall: ${Errors.toLogFormat(error)}`);
    }
  }

  private async checkForUpdatesMaybeInstall(force = false): Promise<void> {
    const { logger } = this;

    logger.info('checkForUpdatesMaybeInstall: checking for update...');
    const result = await this.checkForUpdates(force);
    if (!result) {
      return;
    }

    const { fileName: newFileName, version: newVersion } = result;

    if (
      force ||
      this.fileName !== newFileName ||
      !this.version ||
      gt(newVersion, this.version)
    ) {
      const autoDownloadUpdates = await this.getAutoDownloadUpdateSetting();
      if (!autoDownloadUpdates) {
        this.setUpdateListener(async () => {
          logger.info(
            'checkForUpdatesMaybeInstall: have not downloaded update, going to download'
          );
          await this.downloadAndInstall(newFileName, newVersion, true);
        });
        const mainWindow = this.getMainWindow();

        if (mainWindow) {
          mainWindow.webContents.send(
            'show-update-dialog',
            DialogType.DownloadReady,
            {
              downloadSize: result.size,
              version: result.version,
            }
          );
        } else {
          logger.warn(
            'checkForUpdatesMaybeInstall: no mainWindow, cannot show update dialog'
          );
        }
        return;
      }
      await this.downloadAndInstall(newFileName, newVersion);
    }
  }

  private async checkForUpdates(
    forceUpdate = false
  ): Promise<UpdateInformationType | null> {
    const yaml = await getUpdateYaml();
    const parsedYaml = parseYaml(yaml);
    const version = getVersion(parsedYaml);

    if (!version) {
      this.logger.warn(
        'checkForUpdates: no version extracted from downloaded yaml'
      );

      return null;
    }

    if (forceUpdate || isVersionNewer(version)) {
      this.logger.info(
        `checkForUpdates: found newer version ${version} ` +
          `forceUpdate=${forceUpdate}`
      );

      const fileName = getUpdateFileName(parsedYaml);

      return {
        fileName,
        size: getSize(parsedYaml, fileName),
        version,
      };
    }

    this.logger.info(
      `checkForUpdates: ${version} is not newer; no new update available`
    );

    return null;
  }

  private async downloadUpdate(
    fileName: string,
    updateOnProgress?: boolean
  ): Promise<string> {
    const baseUrl = getUpdatesBase();
    const updateFileUrl = `${baseUrl}/${fileName}`;

    const signatureFileName = getSignatureFileName(fileName);
    const signatureUrl = `${baseUrl}/${signatureFileName}`;

    let tempDir;
    try {
      tempDir = await createTempDir();
      const targetUpdatePath = join(tempDir, fileName);
      const targetSignaturePath = join(tempDir, getSignatureFileName(fileName));

      validatePath(tempDir, targetUpdatePath);
      validatePath(tempDir, targetSignaturePath);

      this.logger.info(`downloadUpdate: Downloading signature ${signatureUrl}`);
      const { body } = await got.get(signatureUrl, getGotOptions());
      await writeFile(targetSignaturePath, body);

      this.logger.info(`downloadUpdate: Downloading update ${updateFileUrl}`);
      const downloadStream = got.stream(updateFileUrl, getGotOptions());
      const writeStream = createWriteStream(targetUpdatePath);

      await new Promise<void>((resolve, reject) => {
        const mainWindow = this.getMainWindow();
        if (updateOnProgress && mainWindow) {
          let downloadedSize = 0;

          const throttledSend = throttle(() => {
            mainWindow.webContents.send(
              'show-update-dialog',
              DialogType.Downloading,
              { downloadedSize }
            );
          }, 500);

          downloadStream.on('data', data => {
            downloadedSize += data.length;
            throttledSend();
          });
        }

        downloadStream.on('error', error => {
          reject(error);
        });
        downloadStream.on('end', () => {
          resolve();
        });

        writeStream.on('error', error => {
          reject(error);
        });

        downloadStream.pipe(writeStream);
      });

      return targetUpdatePath;
    } catch (error) {
      if (tempDir) {
        await deleteTempDir(tempDir);
      }
      throw error;
    }
  }

  private async getAutoDownloadUpdateSetting(): Promise<boolean> {
    try {
      return await this.settingsChannel.getSettingFromMainWindow(
        'autoDownloadUpdate'
      );
    } catch (error) {
      this.logger.warn(
        'getAutoDownloadUpdateSetting: Failed to fetch, returning false',
        Errors.toLogFormat(error)
      );
      return false;
    }
  }

  private async deleteCache(filePath: string | null): Promise<void> {
    if (!filePath) {
      return;
    }
    const tempDir = dirname(filePath);
    try {
      await deleteTempDir(tempDir);
    } catch (error) {
      this.logger.error(`quitHandler: ${Errors.toLogFormat(error)}`);
    }
  }
}

export function validatePath(basePath: string, targetPath: string): void {
  const normalized = normalize(targetPath);

  if (!isPathInside(normalized, basePath)) {
    throw new Error(
      `validatePath: Path ${normalized} is not under base path ${basePath}`
    );
  }
}

// Helper functions

export function getUpdateCheckUrl(): string {
  return `${getUpdatesBase()}/${getUpdatesFileName()}`;
}

export function getUpdatesBase(): string {
  return config.get('updatesUrl');
}
export function getCertificateAuthority(): string {
  return config.get('certificateAuthority');
}
export function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}

export function getUpdatesFileName(): string {
  const prefix = getChannel();

  if (platform === 'darwin') {
    return `${prefix}-mac.yml`;
  }

  return `${prefix}.yml`;
}

function getChannel(): string {
  const { version } = packageJson;

  if (isAlpha(version)) {
    return 'alpha';
  }
  if (isBeta(version)) {
    return 'beta';
  }
  return 'latest';
}

function isVersionNewer(newVersion: string): boolean {
  const { version } = packageJson;

  return gt(newVersion, version);
}

export function getVersion(info: JSONUpdateSchema): string | null {
  return info && info.version;
}

const validFile = /^[A-Za-z0-9.-]+$/;
export function isUpdateFileNameValid(name: string): boolean {
  return validFile.test(name);
}

export function getUpdateFileName(info: JSONUpdateSchema): string {
  if (!info || !info.path) {
    throw new Error('getUpdateFileName: No path present in YAML file');
  }

  const { path } = info;
  if (!isUpdateFileNameValid(path)) {
    throw new Error(
      `getUpdateFileName: Path '${path}' contains invalid characters`
    );
  }

  return path;
}

function getSize(info: JSONUpdateSchema, fileName: string): number {
  if (!info || !info.files) {
    throw new Error('getUpdateFileName: No files present in YAML file');
  }

  const foundFile = info.files.find(file => file.url === fileName);

  return Number(foundFile?.size) || 0;
}

export function parseYaml(yaml: string): JSONUpdateSchema {
  return safeLoad(yaml, { schema: FAILSAFE_SCHEMA, json: true });
}

async function getUpdateYaml(): Promise<string> {
  const targetUrl = getUpdateCheckUrl();
  const body = await got(targetUrl, getGotOptions()).text();

  if (!body) {
    throw new Error('Got unexpected response back from update check');
  }

  return body;
}

function getGotOptions(): GotOptions {
  const certificateAuthority = getCertificateAuthority();
  const proxyUrl = getProxyUrl();
  const agent = proxyUrl
    ? {
        http: new ProxyAgent(proxyUrl),
        https: new ProxyAgent(proxyUrl),
      }
    : undefined;

  return {
    agent,
    https: {
      certificateAuthority,
    },
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': getUserAgent(packageJson.version),
    },
    timeout: {
      connect: GOT_CONNECT_TIMEOUT,
      lookup: GOT_LOOKUP_TIMEOUT,

      // This timeout is reset whenever we get new data on the socket
      socket: GOT_SOCKET_TIMEOUT,
    },
  };
}

function getBaseTempDir() {
  // We only use tmpdir() when this code is run outside of an Electron app (as in: tests)
  return app ? getTempPath(app.getPath('userData')) : tmpdir();
}

export async function createTempDir(): Promise<string> {
  const baseTempDir = getBaseTempDir();
  const uniqueName = getGuid();
  const targetDir = join(baseTempDir, uniqueName);
  await mkdirpPromise(targetDir);

  return targetDir;
}

export async function deleteTempDir(targetDir: string): Promise<void> {
  const pathInfo = statSync(targetDir);
  if (!pathInfo.isDirectory()) {
    throw new Error(
      `deleteTempDir: Cannot delete path '${targetDir}' because it is not a directory`
    );
  }

  const baseTempDir = getBaseTempDir();
  if (!isPathInside(targetDir, baseTempDir)) {
    throw new Error(
      `deleteTempDir: Cannot delete path '${targetDir}' since it is not within base temp dir`
    );
  }

  await rimrafPromise(targetDir);
}

export function getCliOptions<T>(options: ParserConfiguration['options']): T {
  const parser = createParser({ options });
  const cliOptions = parser.parse(process.argv);

  if (cliOptions.help) {
    const help = parser.help().trimRight();
    console.log(help);
    process.exit(0);
  }

  return (cliOptions as unknown) as T;
}
