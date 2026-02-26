// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ChatFolderId, ChatFolderParams } from './ChatFolder.std.js';
import type { PanelArgsType } from './Panels.std.js';

export type Location = ReadonlyDeep<
  | {
      tab: NavTab.Chats;
      details: ChatDetails;
    }
  | {
      tab: NavTab.Settings;
      details: SettingsLocation;
    }
  | { tab: Exclude<NavTab, NavTab.Chats | NavTab.Settings> }
>;

export type ChatDetails = ReadonlyDeep<{
  conversationId?: string;
  panels?: PanelInfo;
}>;

export type PanelInfo = {
  direction: 'push' | 'pop' | undefined;
  isAnimating: boolean;
  // When navigating deep into a panel stack, we only want to render the leaf panel
  leafPanelOnly?: boolean;
  stack: ReadonlyArray<PanelArgsType>;
  wasAnimated: boolean;
  watermark: number;
};

export type SettingsLocation = ReadonlyDeep<
  | {
      page: SettingsPage.Profile;
      state: ProfileEditorPage;
    }
  | {
      page: SettingsPage.ChatFolders;
      previousLocation: Location | null;
    }
  | {
      page: SettingsPage.EditChatFolder;
      chatFolderId: ChatFolderId | null;
      initChatFolderParams: ChatFolderParams | null;
      previousLocation: Location | null;
    }
  | {
      page: Exclude<
        SettingsPage,
        | SettingsPage.Profile
        | SettingsPage.ChatFolders
        | SettingsPage.EditChatFolder
      >;
    }
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
  NotificationProfilesHome = 'NotificationProfilesHome',
  NotificationProfilesCreateFlow = 'NotificationProfilesCreateFlow',
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
