// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { expect } from 'playwright/test';
import { type PrimaryDevice, StorageState } from '@signalapp/mock-server';
import * as path from 'node:path';

import type { App } from '../playwright.js';
import { Bootstrap } from '../bootstrap.js';
import { composerAttachImages } from '../helpers.js';
import * as durations from '../../util/durations/index.js';

const CAT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);

describe('MediaEditor', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let pinned: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    let state = StorageState.getEmpty();

    const { phone, contacts } = bootstrap;
    [pinned] = contacts;

    state = state.addContact(pinned, {
      identityKey: pinned.publicKey.serialize(),
      profileKey: pinned.profileKey.serialize(),
      whitelisted: true,
    });

    state = state.pin(pinned);
    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  async function openMediaEditor(page: Awaited<ReturnType<App['getWindow']>>) {
    await page.getByTestId(pinned.device.aci).click();

    await composerAttachImages(page, [CAT_PATH]);

    const AttachmentsList = page.locator('.module-attachments');
    await AttachmentsList.waitFor({ state: 'visible' });

    const EditableAttachment = AttachmentsList.locator(
      '.module-attachments--editable'
    ).first();
    await EditableAttachment.waitFor({ state: 'visible' });

    const StagedImage = EditableAttachment.locator('.module-image--loaded');
    await StagedImage.waitFor({ state: 'visible' });

    await StagedImage.click();

    const MediaEditor = page.locator('.MediaEditor');
    await MediaEditor.waitFor({ state: 'visible' });

    return MediaEditor;
  }

  async function drawLineOnCanvas(
    page: Awaited<ReturnType<App['getWindow']>>,
    MediaEditor: Awaited<ReturnType<typeof openMediaEditor>>,
    options?: {
      startX?: number;
      startY?: number;
      endX?: number;
      endY?: number;
    }
  ) {
    const canvas = MediaEditor.locator('.MediaEditor__media--canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas bounding box not found');
    }

    // Draw diagonal line by default
    const startX = options?.startX ?? canvasBox.x + canvasBox.width * 0.3;
    const startY = options?.startY ?? canvasBox.y + canvasBox.height * 0.3;
    const endX = options?.endX ?? canvasBox.x + canvasBox.width * 0.7;
    const endY = options?.endY ?? canvasBox.y + canvasBox.height * 0.7;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
  }

  it('can undo after drawing a line', async () => {
    const page = await app.getWindow();
    const MediaEditor = await openMediaEditor(page);

    const canvas = MediaEditor.locator('.MediaEditor__media--canvas').first();

    const screenshotBeforeDrawing = await canvas.screenshot();

    const DrawButton = MediaEditor.locator('.MediaEditor__control--pen');
    await DrawButton.click();

    await page.waitForTimeout(100);

    await drawLineOnCanvas(page, MediaEditor);

    await page.waitForTimeout(100);

    const screenshotAfterDrawing = await canvas.screenshot();

    const UndoButton = MediaEditor.locator('.MediaEditor__control--undo');
    await expect(UndoButton).toBeEnabled();
    await UndoButton.click();

    await page.waitForTimeout(100);

    const screenshotAfterUndo = await canvas.screenshot();

    expect(
      Buffer.compare(screenshotBeforeDrawing, screenshotAfterDrawing),
      'screenshots before and after drawing should be different'
    ).not.toBe(0);

    expect(
      Buffer.compare(screenshotBeforeDrawing, screenshotAfterUndo),
      'screenshot before drawing should be the same as after undo'
    ).toBe(0);
  });

  it('undo button is disabled when there is nothing to undo', async () => {
    const page = await app.getWindow();
    const MediaEditor = await openMediaEditor(page);

    const UndoButton = MediaEditor.locator('.MediaEditor__control--undo');
    await expect(UndoButton).toBeDisabled();

    const DrawButton = MediaEditor.locator('.MediaEditor__control--pen');
    await DrawButton.click();

    await page.waitForTimeout(100);

    await drawLineOnCanvas(page, MediaEditor);

    await page.waitForTimeout(100);

    await expect(UndoButton).toBeEnabled();
    await UndoButton.click();

    await page.waitForTimeout(100);

    await expect(UndoButton).toBeDisabled();
  });
});
