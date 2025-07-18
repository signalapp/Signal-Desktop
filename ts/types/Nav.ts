// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export type Location = ReadonlyDeep<
  | {
      tab: NavTab.Settings;
      details:
        | {
            page: SettingsPage.Profile;
            state: ProfileEditorPage;
          }
        | { page: Exclude<SettingsPage, SettingsPage.Profile> };
    }
  | { tab: Exclude<NavTab, NavTab.Settings> }
>;

export enum NavTab {
  Chats = 'Chats',
  Calls = 'Calls',
  Stories = 'Stories',
  Settings = 'Settings',
}

export enum SettingsPage {
  // Accessible through left nav
  Profile = 'Profile',
  General = 'General',
  Donations = 'Donations',
  Appearance = 'Appearance',
  Chats = 'Chats',
  Calls = 'Calls',
  Notifications = 'Notifications',
  Privacy = 'Privacy',
  DataUsage = 'DataUsage',
  Backups = 'Backups',
  Internal = 'Internal',

  // Sub pages
  ChatColor = 'ChatColor',
  ChatFolders = 'ChatFolders',
  DonationsDonateFlow = 'DonationsDonateFlow',
  DonationsReceiptList = 'DonationsReceiptList',
  EditChatFolder = 'EditChatFolder',
  PNP = 'PNP',
  BackupsDetails = 'BackupsDetails',
  LocalBackups = 'LocalBackups',
  LocalBackupsSetupFolder = 'LocalBackupsSetupFolder',
  LocalBackupsSetupKey = 'LocalBackupsSetupKey',
  LocalBackupsKeyReference = 'LocalBackupsKeyReference',
}

export enum ProfileEditorPage {
  None = 'None',
  BetterAvatar = 'BetterAvatar',
  ProfileName = 'ProfileName',
  Bio = 'Bio',
  Username = 'Username',
  UsernameLink = 'UsernameLink',
}
