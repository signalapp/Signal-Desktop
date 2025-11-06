// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

class BadgeImageFileDownloader {
  async checkForFilesToDownload(): Promise<void> {
    // No-op stub
  }
}

export const badgeImageFileDownloader = new BadgeImageFileDownloader();
