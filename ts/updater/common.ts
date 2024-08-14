// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import { createWriteStream } from 'fs';
import { pathExists } from 'fs-extra';
import { readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join, normalize, extname } from 'path';
import { tmpdir, release as osRelease } from 'os';
import { throttle } from 'lodash';

import type { ParserConfiguration } from 'dashdash';
import { createParser } from 'dashdash';
import { FAILSAFE_SCHEMA, safeLoad } from 'js-yaml';
import { gt, lt } from 'semver';
import config from 'config';
import got from 'got';
import { v4 as getGuid } from 'uuid';
import type { BrowserWindow } from 'electron';
import { app, ipcMain } from 'electron';

import * as durations from '../util/durations';
import { getTempPath, getUpdateCachePath } from '../../app/attachments';
import { markShouldNotQuit, markShouldQuit } from '../../app/window_state';
import { DialogType } from '../types/Dialogs';
import * as Errors from '../types/errors';
import { isAlpha, isBeta, isStaging } from '../util/version';
import { strictAssert } from '../util/assert';
import { drop } from '../util/drop';

import * as packageJson from '../../package.json';
import {
  hexToBinary,
  verifySignature,
  getSignatureFileName,
} from './signature';
import { isPathInside } from '../util/isPathInside';
import type { SettingsChannel } from '../main/settingsChannel';

import type { LoggerType } from '../types/Logging';
import { getGotOptions } from './got';
import { checkIntegrity, gracefulRename, gracefulRimraf } from './util';
import type { PrepareDownloadResultType as DifferentialDownloadDataType } from './differential';
import {
  prepareDownload as prepareDifferentialDownload,
  download as downloadDifferentialData,
  getBlockMapFileName,
  isValidPreparedData as isValidDifferentialData,
} from './differential';

const POLL_INTERVAL = 30 * durations.MINUTE;

type JSONVendorSchema = {
  minOSVersion?: string;
  requireManualUpdate?: 'true' | 'false';
  requireUserConfirmation?: 'true' | 'false';
};

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
  vendor?: JSONVendorSchema;
};

export type UpdateInformationType = {
  fileName: string;
  size: number;
  version: string;
  sha512: string;
  differentialData: DifferentialDownloadDataType | undefined;
  vendor?: JSONVendorSchema;
};

enum DownloadMode {
  DifferentialOnly = 'DifferentialOnly',
  FullOnly = 'FullOnly',
  Automatic = 'Automatic',
}

type DownloadUpdateResultType = Readonly<{
  updateFilePath: string;
  signature: Buffer;
}>;

export type UpdaterOptionsType = Readonly<{
  settingsChannel: SettingsChannel;
  logger: LoggerType;
  getMainWindow: () => BrowserWindow | undefined;
  canRunSilently: () => boolean;
}>;

export abstract class Updater {
  protected fileName: string | undefined;

  protected version: string | undefined;

  protected cachedDifferentialData: DifferentialDownloadDataType | undefined;

  protected readonly logger: LoggerType;

  private readonly settingsChannel: SettingsChannel;

  protected readonly getMainWindow: () => BrowserWindow | undefined;

  private throttledSendDownloadingUpdate: ((downloadedSize: number) => void) & {
    cancel: () => void;
  };

  private activeDownload: Promise<boolean> | undefined;

  private markedCannotUpdate = false;

  private restarting = false;

  private readonly canRunSilently: () => boolean;

  constructor({
    settingsChannel,
    logger,
    getMainWindow,
    canRunSilently,
  }: UpdaterOptionsType) {
    this.settingsChannel = settingsChannel;
    this.logger = logger;
    this.getMainWindow = getMainWindow;
    this.canRunSilently = canRunSilently;

    this.throttledSendDownloadingUpdate = throttle((downloadedSize: number) => {
      const mainWindow = this.getMainWindow();
      mainWindow?.webContents.send(
        'show-update-dialog',
        DialogType.Downloading,
        { downloadedSize }
      );
    }, 50);
  }

  //
  // Public APIs
  //

  public async force(): Promise<void> {
    return this.checkForUpdatesMaybeInstall(true);
  }

  // If the updater was about to restart the app but the user cancelled it, show dialog
  // to let them retry the restart
  public onRestartCancelled(): void {
    if (!this.restarting) {
      return;
    }

    this.logger.info(
      'updater/onRestartCancelled: restart was cancelled. forcing update to reset updater state'
    );
    this.restarting = false;
    markShouldNotQuit();
    drop(this.force());
  }

  public async start(): Promise<void> {
    this.logger.info('updater/start: starting checks...');

    this.schedulePoll();

    await this.deletePreviousInstallers();
    await this.checkForUpdatesMaybeInstall();
  }

  //
  // Abstract methods
  //

  protected abstract deletePreviousInstallers(): Promise<void>;

  protected abstract installUpdate(
    updateFilePath: string,
    isSilent: boolean
  ): Promise<void>;

  //
  // Protected methods
  //

  protected setUpdateListener(
    performUpdateCallback: () => Promise<void> | void
  ): void {
    ipcMain.removeHandler('start-update');
    ipcMain.handleOnce('start-update', performUpdateCallback);
  }

  protected markCannotUpdate(
    error: Error,
    dialogType = DialogType.Cannot_Update
  ): void {
    if (this.markedCannotUpdate) {
      this.logger.warn(
        'updater/markCannotUpdate: already marked',
        Errors.toLogFormat(error)
      );
      return;
    }
    this.markedCannotUpdate = true;

    this.logger.error(
      'updater/markCannotUpdate: marking due to error: ' +
        `${Errors.toLogFormat(error)}, ` +
        `dialogType: ${dialogType}`
    );

    const mainWindow = this.getMainWindow();
    mainWindow?.webContents.send('show-update-dialog', dialogType);

    this.setUpdateListener(async () => {
      this.logger.info('updater/markCannotUpdate: retrying after user action');

      this.markedCannotUpdate = false;
      await this.checkForUpdatesMaybeInstall();
    });
  }

  protected markRestarting(): void {
    this.restarting = true;
    markShouldQuit();
  }

  //
  // Private methods
  //

  private schedulePoll(): void {
    const now = Date.now();

    const earliestPollTime = now - (now % POLL_INTERVAL) + POLL_INTERVAL;
    const selectedPollTime = Math.round(
      earliestPollTime + Math.random() * POLL_INTERVAL
    );
    const timeoutMs = selectedPollTime - now;

    this.logger.info(`updater/start: polling in ${timeoutMs}ms`);

    setTimeout(() => {
      drop(this.safePoll());
    }, timeoutMs);
  }

  private async safePoll(): Promise<void> {
    try {
      this.logger.info('updater/start: polling now');
      await this.checkForUpdatesMaybeInstall();
    } catch (error) {
      this.logger.error(`updater/start: ${Errors.toLogFormat(error)}`);
    } finally {
      this.schedulePoll();
    }
  }

  private async downloadAndInstall(
    updateInfo: UpdateInformationType,
    mode: DownloadMode
  ): Promise<boolean> {
    if (this.activeDownload) {
      return this.activeDownload;
    }

    try {
      this.activeDownload = this.doDownloadAndInstall(updateInfo, mode);

      return await this.activeDownload;
    } finally {
      this.activeDownload = undefined;
    }
  }

  private async doDownloadAndInstall(
    updateInfo: UpdateInformationType,
    mode: DownloadMode
  ): Promise<boolean> {
    const { logger } = this;

    const { fileName: newFileName, version: newVersion } = updateInfo;

    try {
      const oldVersion = this.version;
      this.version = newVersion;

      let downloadResult: DownloadUpdateResultType | undefined;

      try {
        downloadResult = await this.downloadUpdate(updateInfo, mode);
      } catch (error) {
        // Restore state in case of download error
        this.version = oldVersion;

        throw error;
      }

      if (!downloadResult) {
        logger.warn('downloadAndInstall: no update was downloaded');
        strictAssert(
          mode !== DownloadMode.Automatic && mode !== DownloadMode.FullOnly,
          'Automatic and full mode downloads are guaranteed to happen or error'
        );
        return false;
      }

      const { updateFilePath, signature } = downloadResult;

      const publicKey = hexToBinary(config.get('updatesPublicKey'));
      const verified = await verifySignature(
        updateFilePath,
        this.version,
        signature,
        publicKey
      );
      if (!verified) {
        // Note: We don't delete the cache here, because we don't want to continually
        //   re-download the broken release. We will download it only once per launch.
        throw new Error(
          'Downloaded update did not pass signature verification ' +
            `(version: '${this.version}'; fileName: '${newFileName}')`
        );
      }

      await this.installUpdate(
        updateFilePath,
        updateInfo.vendor?.requireUserConfirmation !== 'true' &&
          this.canRunSilently()
      );

      const mainWindow = this.getMainWindow();
      if (mainWindow) {
        logger.info('downloadAndInstall: showing update dialog...');
        mainWindow.webContents.send(
          'show-update-dialog',
          mode === DownloadMode.Automatic
            ? DialogType.AutoUpdate
            : DialogType.DownloadedUpdate,
          {
            version: this.version,
          }
        );
      } else {
        logger.warn(
          'downloadAndInstall: no mainWindow, cannot show update dialog'
        );
      }

      return true;
    } catch (error) {
      logger.error(`downloadAndInstall: ${Errors.toLogFormat(error)}`);
      this.markCannotUpdate(error);
      throw error;
    }
  }

  private async checkForUpdatesMaybeInstall(force = false): Promise<void> {
    const { logger } = this;

    logger.info('checkForUpdatesMaybeInstall: checking for update...');
    const updateInfo = await this.checkForUpdates(force);
    if (!updateInfo) {
      return;
    }

    const { version: newVersion } = updateInfo;

    if (!force && this.version && !gt(newVersion, this.version)) {
      return;
    }

    const autoDownloadUpdates = await this.getAutoDownloadUpdateSetting();
    if (autoDownloadUpdates) {
      await this.downloadAndInstall(updateInfo, DownloadMode.Automatic);
      return;
    }

    let mode = DownloadMode.FullOnly;
    if (updateInfo.differentialData) {
      mode = DownloadMode.DifferentialOnly;
    }

    await this.offerUpdate(updateInfo, mode, 0);
  }

  private async offerUpdate(
    updateInfo: UpdateInformationType,
    mode: DownloadMode,
    attempt: number
  ): Promise<void> {
    const { logger } = this;

    this.setUpdateListener(async () => {
      logger.info('offerUpdate: have not downloaded update, going to download');

      const didDownload = await this.downloadAndInstall(updateInfo, mode);
      if (!didDownload && mode === DownloadMode.DifferentialOnly) {
        this.logger.warn(
          'offerUpdate: Failed to download differential update, offering full'
        );
        this.throttledSendDownloadingUpdate.cancel();
        return this.offerUpdate(updateInfo, DownloadMode.FullOnly, attempt + 1);
      }

      strictAssert(didDownload, 'FullOnly must always download update');
    });

    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      logger.warn('offerUpdate: no mainWindow, cannot show update dialog');
      return;
    }

    let downloadSize: number;
    if (mode === DownloadMode.DifferentialOnly) {
      strictAssert(
        updateInfo.differentialData,
        'Must have differential data in DifferentialOnly mode'
      );
      downloadSize = updateInfo.differentialData.downloadSize;
    } else {
      downloadSize = updateInfo.size;
    }

    logger.info(`offerUpdate: offering ${mode} update`);
    mainWindow.webContents.send(
      'show-update-dialog',
      attempt === 0 ? DialogType.DownloadReady : DialogType.FullDownloadReady,
      {
        downloadSize,
        downloadMode: mode,
        version: updateInfo.version,
      }
    );
  }

  private async checkForUpdates(
    forceUpdate = false
  ): Promise<UpdateInformationType | undefined> {
    const yaml = await getUpdateYaml();
    const parsedYaml = parseYaml(yaml);

    const { vendor } = parsedYaml;
    if (vendor) {
      if (vendor.requireManualUpdate === 'true') {
        this.logger.warn('checkForUpdates: manual update required');
        this.markCannotUpdate(
          new Error('yaml file has requireManualUpdate flag'),
          DialogType.Cannot_Update_Require_Manual
        );
        return;
      }

      if (vendor.minOSVersion && lt(osRelease(), vendor.minOSVersion)) {
        this.logger.warn(
          `checkForUpdates: OS version ${osRelease()} is less than the ` +
            `minimum supported version ${vendor.minOSVersion}`
        );
        this.markCannotUpdate(
          new Error('yaml file has unsatisfied minOSVersion value'),
          DialogType.UnsupportedOS
        );
        return;
      }
    }

    const version = getVersion(parsedYaml);

    if (!version) {
      this.logger.warn(
        'checkForUpdates: no version extracted from downloaded yaml'
      );

      return;
    }

    if (!forceUpdate && !isVersionNewer(version)) {
      this.logger.info(
        `checkForUpdates: ${version} is not newer than ${packageJson.version}; ` +
          'no new update available'
      );

      return;
    }

    this.logger.info(
      `checkForUpdates: found newer version ${version} ` +
        `forceUpdate=${forceUpdate}`
    );

    const fileName = getUpdateFileName(
      parsedYaml,
      process.platform,
      await this.getArch()
    );

    const sha512 = getSHA512(parsedYaml, fileName);
    strictAssert(sha512 !== undefined, 'Missing required hash');

    const latestInstaller = await this.getLatestCachedInstaller(
      extname(fileName)
    );

    let differentialData: DifferentialDownloadDataType | undefined;
    if (latestInstaller) {
      this.logger.info(
        `checkForUpdates: Found local installer ${latestInstaller}`
      );

      const diffOptions = {
        oldFile: latestInstaller,
        newUrl: `${getUpdatesBase()}/${fileName}`,
        sha512,
      };

      if (
        this.cachedDifferentialData &&
        isValidDifferentialData(this.cachedDifferentialData, diffOptions)
      ) {
        this.logger.info('checkForUpdates: using cached differential data');

        differentialData = this.cachedDifferentialData;
      } else {
        try {
          differentialData = await prepareDifferentialDownload(diffOptions);

          this.cachedDifferentialData = differentialData;

          this.logger.info(
            'checkForUpdates: differential download size',
            differentialData.downloadSize
          );
        } catch (error) {
          this.logger.error(
            'checkForUpdates: Failed to prepare differential update',
            Errors.toLogFormat(error)
          );
          this.cachedDifferentialData = undefined;
        }
      }
    }

    return {
      fileName,
      size: getSize(parsedYaml, fileName),
      version,
      sha512,
      differentialData,
      vendor,
    };
  }

  private async getLatestCachedInstaller(
    extension: string
  ): Promise<string | undefined> {
    const cacheDir = await createUpdateCacheDirIfNeeded();
    const oldFiles = (await readdir(cacheDir)).map(fileName => {
      return join(cacheDir, fileName);
    });

    return oldFiles.find(fileName => extname(fileName) === extension);
  }

  private async downloadUpdate(
    { fileName, sha512, differentialData }: UpdateInformationType,
    mode: DownloadMode
  ): Promise<DownloadUpdateResultType | undefined> {
    const baseUrl = getUpdatesBase();
    const updateFileUrl = `${baseUrl}/${fileName}`;

    const updateOnProgress = mode !== DownloadMode.Automatic;

    const signatureFileName = getSignatureFileName(fileName);
    const blockMapFileName = getBlockMapFileName(fileName);
    const signatureUrl = `${baseUrl}/${signatureFileName}`;
    const blockMapUrl = `${baseUrl}/${blockMapFileName}`;

    let cacheDir = await createUpdateCacheDirIfNeeded();
    const targetUpdatePath = join(cacheDir, fileName);

    const tempDir = await createTempDir();

    const tempUpdatePath = join(tempDir, fileName);
    const tempBlockMapPath = join(tempDir, blockMapFileName);

    // If true - we will attempt to install from a temporary directory.
    let tempPathFailover = false;

    try {
      validatePath(cacheDir, targetUpdatePath);

      validatePath(tempDir, tempUpdatePath);
      validatePath(tempDir, tempBlockMapPath);

      this.logger.info(`downloadUpdate: Downloading signature ${signatureUrl}`);
      const signature = Buffer.from(
        await got(signatureUrl, await getGotOptions()).text(),
        'hex'
      );

      if (differentialData) {
        this.logger.info(`downloadUpdate: Saving blockmap ${blockMapUrl}`);
        await writeFile(tempBlockMapPath, differentialData.newBlockMap);
      } else {
        try {
          this.logger.info(
            `downloadUpdate: Downloading blockmap ${blockMapUrl}`
          );
          const blockMap = await got(
            blockMapUrl,
            await getGotOptions()
          ).buffer();
          await writeFile(tempBlockMapPath, blockMap);
        } catch (error) {
          this.logger.warn(
            'downloadUpdate: Failed to download blockmap, continuing',
            Errors.toLogFormat(error)
          );
        }
      }

      let gotUpdate = false;
      if (!gotUpdate && (await pathExists(targetUpdatePath))) {
        const checkResult = await checkIntegrity(targetUpdatePath, sha512);
        if (checkResult.ok) {
          this.logger.info(
            `downloadUpdate: Not downloading update ${updateFileUrl}, ` +
              'local file has the same hash'
          );

          // Move file into downloads directory
          try {
            await gracefulRename(this.logger, targetUpdatePath, tempUpdatePath);
            gotUpdate = true;
          } catch (error) {
            this.logger.error(
              'downloadUpdate: failed to move already downloaded file',
              Errors.toLogFormat(error)
            );
          }
        } else {
          this.logger.error(
            'downloadUpdate: integrity check failure',
            checkResult.error
          );
        }
      }

      const isDifferentialEnabled =
        differentialData && mode !== DownloadMode.FullOnly;
      if (!gotUpdate && isDifferentialEnabled) {
        this.logger.info(
          `downloadUpdate: Downloading differential update ${updateFileUrl}`
        );

        try {
          await downloadDifferentialData(tempUpdatePath, differentialData, {
            statusCallback: updateOnProgress
              ? this.throttledSendDownloadingUpdate
              : undefined,
            logger: this.logger,
          });

          gotUpdate = true;
        } catch (error) {
          this.logger.error(
            'downloadUpdate: Failed to apply differential update',
            Errors.toLogFormat(error)
          );
        }
      }

      const isFullEnabled = mode !== DownloadMode.DifferentialOnly;
      if (!gotUpdate && isFullEnabled) {
        this.logger.info(
          `downloadUpdate: Downloading full update ${updateFileUrl}`
        );

        // We could have failed to update differentially due to low free disk
        // space. Remove all cached updates since we are doing a full download
        // anyway.
        await gracefulRimraf(this.logger, cacheDir);
        cacheDir = await createUpdateCacheDirIfNeeded();

        await this.downloadAndReport(
          updateFileUrl,
          tempUpdatePath,
          updateOnProgress
        );
        gotUpdate = true;
      }

      if (!gotUpdate) {
        return undefined;
      }

      this.logger.info(
        'downloadUpdate: Downloaded update, moving into cache dir'
      );

      // Backup old files
      const restoreDir = await getTempDir();
      await gracefulRename(this.logger, cacheDir, restoreDir);

      // Move the files into the final position
      try {
        await gracefulRename(this.logger, tempDir, cacheDir);
      } catch (error) {
        try {
          // Attempt to restore old files
          await gracefulRename(this.logger, restoreDir, cacheDir);
        } catch (restoreError) {
          this.logger.warn(
            'downloadUpdate: Failed to restore from backup folder, ignoring',
            Errors.toLogFormat(restoreError)
          );

          // If not possible - at least clean up
          try {
            await deleteTempDir(this.logger, restoreDir);
          } catch (cleanupError) {
            this.logger.warn(
              'downloadUpdate: Failed to remove backup folder after ' +
                'failed restore, ignoring',
              Errors.toLogFormat(cleanupError)
            );
          }
        }

        this.logger.warn(
          'downloadUpdate: running update from a temporary folder due to error',
          Errors.toLogFormat(error)
        );
        tempPathFailover = true;
        return { updateFilePath: tempUpdatePath, signature };
      }

      try {
        await deleteTempDir(this.logger, restoreDir);
      } catch (error) {
        this.logger.warn(
          'downloadUpdate: Failed to remove backup folder, ignoring',
          Errors.toLogFormat(error)
        );
      }

      return { updateFilePath: targetUpdatePath, signature };
    } finally {
      if (!tempPathFailover) {
        await deleteTempDir(this.logger, tempDir);
      }
    }
  }

  private async downloadAndReport(
    updateFileUrl: string,
    targetUpdatePath: string,
    updateOnProgress = false
  ): Promise<void> {
    const downloadStream = got.stream(updateFileUrl, await getGotOptions());
    const writeStream = createWriteStream(targetUpdatePath);

    await new Promise<void>((resolve, reject) => {
      if (updateOnProgress) {
        let downloadedSize = 0;

        downloadStream.on('data', data => {
          downloadedSize += data.length;
          this.throttledSendDownloadingUpdate(downloadedSize);
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

  private async getArch(): Promise<typeof process.arch> {
    if (process.platform !== 'darwin' || process.arch === 'arm64') {
      return process.arch;
    }

    if (app.runningUnderARM64Translation) {
      this.logger.info('updater: running under arm64 translation');
      return 'arm64';
    }

    this.logger.info('updater: not running under arm64 translation');
    return process.arch;
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

export function getUpdatesFileName(): string {
  const prefix = getChannel();

  if (process.platform === 'darwin') {
    return `${prefix}-mac.yml`;
  }

  return `${prefix}.yml`;
}

function getChannel(): string {
  const { version } = packageJson;

  if (isStaging(version)) {
    return 'staging';
  }
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

export function getUpdateFileName(
  info: JSONUpdateSchema,
  platform: typeof process.platform,
  arch: typeof process.arch
): string {
  if (!info || !info.path) {
    throw new Error('getUpdateFileName: No path present in YAML file');
  }

  let path: string | undefined;
  if (platform === 'darwin') {
    const { files } = info;

    const candidates = files.filter(
      ({ url }) => url.includes(arch) && url.endsWith('.zip')
    );

    if (candidates.length === 1) {
      path = candidates[0].url;
    }
  }

  path = path ?? info.path;

  if (!isUpdateFileNameValid(path)) {
    throw new Error(
      `getUpdateFileName: Path '${path}' contains invalid characters`
    );
  }

  return path;
}

function getSHA512(
  info: JSONUpdateSchema,
  fileName: string
): string | undefined {
  if (!info || !info.files) {
    throw new Error('getSHA512: No files present in YAML file');
  }

  const foundFile = info.files.find(file => file.url === fileName);

  return foundFile?.sha512;
}

function getSize(info: JSONUpdateSchema, fileName: string): number {
  if (!info || !info.files) {
    throw new Error('getSize: No files present in YAML file');
  }

  const foundFile = info.files.find(file => file.url === fileName);

  return Number(foundFile?.size) || 0;
}

export function parseYaml(yaml: string): JSONUpdateSchema {
  return safeLoad(yaml, { schema: FAILSAFE_SCHEMA, json: true });
}

async function getUpdateYaml(): Promise<string> {
  const targetUrl = getUpdateCheckUrl();
  const body = await got(targetUrl, await getGotOptions()).text();

  if (!body) {
    throw new Error('Got unexpected response back from update check');
  }

  return body;
}

function getBaseTempDir() {
  // We only use tmpdir() when this code is run outside of an Electron app (as in: tests)
  return app ? getTempPath(app.getPath('userData')) : tmpdir();
}

export async function createTempDir(): Promise<string> {
  const targetDir = await getTempDir();

  await mkdir(targetDir, { recursive: true });

  return targetDir;
}

export async function getTempDir(): Promise<string> {
  const baseTempDir = getBaseTempDir();
  const uniqueName = getGuid();

  // Create parent folder if not already present
  if (!(await pathExists(baseTempDir))) {
    await mkdir(baseTempDir, { recursive: true });
  }

  return join(baseTempDir, uniqueName);
}

function getUpdateCacheDir() {
  // We only use tmpdir() when this code is run outside of an Electron app (as in: tests)
  return app ? getUpdateCachePath(app.getPath('userData')) : tmpdir();
}

export async function createUpdateCacheDirIfNeeded(): Promise<string> {
  const targetDir = getUpdateCacheDir();
  await mkdir(targetDir, { recursive: true });

  return targetDir;
}

export async function deleteTempDir(
  logger: LoggerType,
  targetDir: string
): Promise<void> {
  if (await pathExists(targetDir)) {
    const pathInfo = await stat(targetDir);
    if (!pathInfo.isDirectory()) {
      throw new Error(
        `deleteTempDir: Cannot delete path '${targetDir}' because it is not a directory`
      );
    }
  }

  const baseTempDir = getBaseTempDir();
  if (!isPathInside(targetDir, baseTempDir)) {
    throw new Error(
      `deleteTempDir: Cannot delete path '${targetDir}' since it is not within base temp dir`
    );
  }

  await gracefulRimraf(logger, targetDir);
}

export function getCliOptions<T>(options: ParserConfiguration['options']): T {
  const parser = createParser({ options });
  const cliOptions = parser.parse(process.argv);

  if (cliOptions.help) {
    const help = parser.help().trimRight();
    console.log(help);
    process.exit(0);
  }

  return cliOptions as unknown as T;
}
