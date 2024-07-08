// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import EventEmitter from 'events';

import * as log from '../logging/log';

const DEFAULT_ZOOM_FACTOR = 1.0;

// https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc
const ZOOM_LEVEL_MULTIPLIER_RATIO = 1.2;

function zoomLevelToZoomFactor(zoomLevel: number): number {
  return ZOOM_LEVEL_MULTIPLIER_RATIO ** zoomLevel;
}

function zoomFactorToZoomLevel(zoomFactor: number) {
  return Math.log(zoomFactor) / Math.log(ZOOM_LEVEL_MULTIPLIER_RATIO);
}

function zoomFactorEquals(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.001;
}

type ZoomFactorServiceConfig = Readonly<{
  getZoomFactorSetting: () => Promise<number | null>;
  setZoomFactorSetting: (zoomFactor: number) => Promise<void>;
}>;

export class ZoomFactorService extends EventEmitter {
  #config: ZoomFactorServiceConfig;
  #cachedZoomFactor: number | null = null;

  constructor(config: ZoomFactorServiceConfig) {
    super();
    this.#config = config;
    ipcMain.handle('getZoomFactor', () => {
      return this.getZoomFactor();
    });
    ipcMain.on('setZoomFactor', (_event, zoomFactor) => {
      return this.setZoomFactor(zoomFactor);
    });
  }

  async getZoomFactor(): Promise<number> {
    if (this.#cachedZoomFactor != null) {
      return this.#cachedZoomFactor;
    }
    const zoomFactorSetting = await this.#config.getZoomFactorSetting();
    const zoomFactor = zoomFactorSetting ?? DEFAULT_ZOOM_FACTOR;
    this.#cachedZoomFactor = zoomFactor;
    return zoomFactor;
  }

  async getZoomLevel(): Promise<number> {
    const zoomFactor = await this.getZoomFactor();
    return zoomFactorToZoomLevel(zoomFactor);
  }

  async setZoomFactor(zoomFactor: number): Promise<void> {
    if (
      this.#cachedZoomFactor != null &&
      zoomFactorEquals(this.#cachedZoomFactor, zoomFactor)
    ) {
      return;
    }
    this.#cachedZoomFactor = zoomFactor;
    await this.#config.setZoomFactorSetting(zoomFactor);
    this.emit('zoomFactorChanged', zoomFactor);
  }

  async setZoomLevel(zoomLevel: number): Promise<void> {
    const zoomFactor = zoomLevelToZoomFactor(zoomLevel);
    await this.setZoomFactor(zoomFactor);
  }

  async zoomIn(): Promise<void> {
    const zoomLevel = await this.getZoomLevel();
    await this.setZoomLevel(zoomLevel + 1);
  }

  async zoomOut(): Promise<void> {
    const zoomLevel = await this.getZoomLevel();
    await this.setZoomLevel(zoomLevel - 1);
  }

  async zoomReset(): Promise<void> {
    await this.setZoomLevel(0);
  }

  // Call this after creating a new window before you show it
  async syncWindow(window: BrowserWindow): Promise<void> {
    const onWindowChange = async () => {
      const zoomFactor = window.webContents.getZoomFactor();
      await this.setZoomFactor(zoomFactor);
    };

    const onServiceChange = (zoomFactor: number) => {
      window.webContents.setZoomFactor(zoomFactor);
      window.webContents.send('zoomFactorChanged', zoomFactor);
    };

    let initialZoomFactor: number;
    try {
      initialZoomFactor = await this.getZoomFactor();
    } catch (error) {
      log.error('Failed to get zoom factor', error);
      initialZoomFactor = DEFAULT_ZOOM_FACTOR;
    }

    window.once('ready-to-show', () => {
      // Workaround to apply zoomFactor because webPreferences does not handle it
      // https://github.com/electron/electron/issues/10572
      window.webContents.setZoomFactor(initialZoomFactor);
    });

    window.once('show', async () => {
      // Install handler here after we init zoomFactor otherwise an initial
      // preferred-size-changed event emits with an undesired zoomFactor.
      window.webContents.on('preferred-size-changed', onWindowChange);
      window.webContents.on('zoom-changed', onWindowChange);
      this.on('zoomFactorChanged', onServiceChange);
    });

    window.on('close', () => {
      window.webContents.off('preferred-size-changed', onWindowChange);
      window.webContents.off('zoom-changed', onWindowChange);
      this.off('zoomFactorChanged', onServiceChange);
    });
  }
}
