// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { DataWriter } from '../sql/Client';
import * as log from '../logging/log';
import { MINUTE } from '../util/durations';
import { missingCaseError } from '../util/missingCaseError';
import { waitForOnline } from '../util/waitForOnline';

enum BadgeDownloaderState {
  Idle,
  Checking,
  CheckingWithAnotherCheckEnqueued,
}

class BadgeImageFileDownloader {
  #state = BadgeDownloaderState.Idle;
  #queue = new PQueue({ concurrency: 3 });

  public async checkForFilesToDownload(): Promise<void> {
    switch (this.#state) {
      case BadgeDownloaderState.CheckingWithAnotherCheckEnqueued:
        log.info(
          'BadgeDownloader#checkForFilesToDownload: not enqueuing another check'
        );
        return;
      case BadgeDownloaderState.Checking:
        log.info(
          'BadgeDownloader#checkForFilesToDownload: enqueuing another check'
        );
        this.#state = BadgeDownloaderState.CheckingWithAnotherCheckEnqueued;
        return;
      case BadgeDownloaderState.Idle: {
        this.#state = BadgeDownloaderState.Checking;

        const urlsToDownload = getUrlsToDownload();
        log.info(
          `BadgeDownloader#checkForFilesToDownload: downloading ${urlsToDownload.length} badge(s)`
        );

        try {
          await this.#queue.addAll(
            urlsToDownload.map(url => () => downloadBadgeImageFile(url))
          );
        } catch (err: unknown) {
          // Errors are ignored.
        }

        // Without this cast, TypeScript has an incorrect type for this value, assuming
        //   it's a constant when it could've changed. This is a [long-standing TypeScript
        //   issue][0].
        //
        // [0]: https://github.com/microsoft/TypeScript/issues/9998
        const previousState = this.#state as BadgeDownloaderState;
        this.#state = BadgeDownloaderState.Idle;
        if (
          previousState ===
          BadgeDownloaderState.CheckingWithAnotherCheckEnqueued
        ) {
          void this.checkForFilesToDownload();
        }
        return;
      }
      default:
        throw missingCaseError(this.#state);
    }
  }
}

export const badgeImageFileDownloader = new BadgeImageFileDownloader();

function getUrlsToDownload(): Array<string> {
  const result: Array<string> = [];
  const badges = Object.values(window.reduxStore.getState().badges.byId);
  for (const badge of badges) {
    for (const image of badge.images) {
      for (const imageFile of Object.values(image)) {
        if (!imageFile.localPath) {
          result.push(imageFile.url);
        }
      }
    }
  }
  return result;
}

async function downloadBadgeImageFile(url: string): Promise<string> {
  await waitForOnline({ timeout: 1 * MINUTE });

  const { server } = window.textsecure;
  if (!server) {
    throw new Error(
      'downloadBadgeImageFile: window.textsecure.server is not available!'
    );
  }

  const imageFileData = await server.getBadgeImageFile(url);
  const localPath =
    await window.Signal.Migrations.writeNewBadgeImageFileData(imageFileData);

  await DataWriter.badgeImageFileDownloaded(url, localPath);

  window.reduxActions.badges.badgeImageFileDownloaded(url, localPath);

  return localPath;
}
