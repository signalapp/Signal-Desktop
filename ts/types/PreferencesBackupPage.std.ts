// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SettingsPage } from './Nav.std.js';

// Should be in sync with isBackupPage()
export type PreferencesBackupPage =
  | SettingsPage.Backups
  | SettingsPage.BackupsDetails
  | SettingsPage.LocalBackups
  | SettingsPage.LocalBackupsKeyReference
  | SettingsPage.LocalBackupsSetupFolder
  | SettingsPage.LocalBackupsSetupKey;

// Should be in sync with PreferencesBackupPage
export function isBackupPage(
  page: SettingsPage
): page is PreferencesBackupPage {
  return (
    page === SettingsPage.Backups ||
    page === SettingsPage.BackupsDetails ||
    page === SettingsPage.LocalBackups ||
    page === SettingsPage.LocalBackupsSetupFolder ||
    page === SettingsPage.LocalBackupsSetupKey ||
    page === SettingsPage.LocalBackupsKeyReference
  );
}
