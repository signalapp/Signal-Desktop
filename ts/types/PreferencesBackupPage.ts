// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Page } from '../components/Preferences';

// Should be in sync with isBackupPage()
export type PreferencesBackupPage =
  | Page.Backups
  | Page.BackupsDetails
  | Page.LocalBackups
  | Page.LocalBackupsKeyReference
  | Page.LocalBackupsSetupFolder
  | Page.LocalBackupsSetupKey;

// Should be in sync with PreferencesBackupPage
export function isBackupPage(page: Page): page is PreferencesBackupPage {
  return (
    page === Page.Backups ||
    page === Page.BackupsDetails ||
    page === Page.LocalBackups ||
    page === Page.LocalBackupsSetupFolder ||
    page === Page.LocalBackupsSetupKey ||
    page === Page.LocalBackupsKeyReference
  );
}
