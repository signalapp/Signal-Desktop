// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import {
  createWriteStream,
  statSync,
  writeFile as writeFileCallback,
} from 'fs';
import { join, normalize } from 'path';
import { tmpdir } from 'os';
import { throttle } from 'lodash';

import { createParser, ParserConfiguration } from 'dashdash';
import ProxyAgent from 'proxy-agent';
import { FAILSAFE_SCHEMA, safeLoad } from 'js-yaml';
import { gt } from 'semver';
import config from 'config';
import { get, GotOptions, stream } from 'got';
import { v4 as getGuid } from 'uuid';
import pify from 'pify';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import { app, BrowserWindow, ipcMain } from 'electron';

import { getTempPath } from '../../app/attachments';
import { DialogType } from '../types/Dialogs';
import { getUserAgent } from '../util/getUserAgent';
import { isAlpha, isBeta } from '../util/version';

import * as packageJson from '../../package.json';
import { getSignatureFileName } from './signature';
import { isPathInside } from '../util/isPathInside';

import { LoggerType } from '../types/Logging';

const writeFile = pify(writeFileCallback);
const mkdirpPromise = pify(mkdirp);
const rimrafPromise = pify(rimraf);
const { platform } = process;

export const GOT_CONNECT_TIMEOUT = 2 * 60 * 1000;
export const GOT_LOOKUP_TIMEOUT = 2 * 60 * 1000;
export const GOT_SOCKET_TIMEOUT = 2 * 60 * 1000;

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

export type UpdaterInterface = {
  force(): Promise<void>;
};

export type UpdateInformationType = {
  fileName: string;
  size: number;
  version: string;
};

export async function checkForUpdates(
  logger: LoggerType,
  forceUpdate = false
): Promise<UpdateInformationType | null> {
  const yaml = await getUpdateYaml();
  const parsedYaml = parseYaml(yaml);
  const version = getVersion(parsedYaml);

  if (!version) {
    logger.warn('checkForUpdates: no version extracted from downloaded yaml');

    return null;
  }

  if (forceUpdate || isVersionNewer(version)) {
    logger.info(
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

  logger.info(
    `checkForUpdates: ${version} is not newer; no new update available`
  );

  return null;
}

export function validatePath(basePath: string, targetPath: string): void {
  const normalized = normalize(targetPath);

  if (!isPathInside(normalized, basePath)) {
    throw new Error(
      `validatePath: Path ${normalized} is not under base path ${basePath}`
    );
  }
}

export async function downloadUpdate(
  fileName: string,
  logger: LoggerType,
  mainWindow?: BrowserWindow
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

    logger.info(`downloadUpdate: Downloading signature ${signatureUrl}`);
    const { body } = await get(signatureUrl, getGotOptions());
    await writeFile(targetSignaturePath, body);

    logger.info(`downloadUpdate: Downloading update ${updateFileUrl}`);
    const downloadStream = stream(updateFileUrl, getGotOptions());
    const writeStream = createWriteStream(targetUpdatePath);

    await new Promise<void>((resolve, reject) => {
      if (mainWindow) {
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
  const { body } = await get(targetUrl, getGotOptions());

  if (!body) {
    throw new Error('Got unexpected response back from update check');
  }

  return body.toString('utf8');
}

function getGotOptions(): GotOptions<null> {
  const ca = getCertificateAuthority();
  const proxyUrl = getProxyUrl();
  const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  return {
    agent,
    ca,
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': getUserAgent(packageJson.version),
    },
    useElectronNet: false,
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

export function getPrintableError(error: Error | string): Error | string {
  if (typeof error === 'string') {
    return error;
  }
  return error && error.stack ? error.stack : error;
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

export function setUpdateListener(performUpdateCallback: () => void): void {
  ipcMain.removeAllListeners('start-update');
  ipcMain.once('start-update', performUpdateCallback);
}

export async function getAutoDownloadUpdateSetting(
  mainWindow: BrowserWindow | undefined,
  logger: LoggerType
): Promise<boolean> {
  if (!mainWindow) {
    logger.warn(
      'getAutoDownloadUpdateSetting: No main window, returning false'
    );
    return false;
  }

  return new Promise((resolve, reject) => {
    ipcMain.once(
      'settings:get-success:autoDownloadUpdate',
      (_, error, value: boolean) => {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      }
    );
    mainWindow.webContents.send('settings:get:autoDownloadUpdate');
  });
}
