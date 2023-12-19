// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum DialogType {
  None = 'None',
  AutoUpdate = 'AutoUpdate',
  Cannot_Update = 'Cannot_Update',
  Cannot_Update_Require_Manual = 'Cannot_Update_Require_Manual',
  UnsupportedOS = 'UnsupportedOS',
  MacOS_Read_Only = 'MacOS_Read_Only',
  DownloadReady = 'DownloadReady',
  FullDownloadReady = 'FullDownloadReady',
  Downloading = 'Downloading',
  DownloadedUpdate = 'DownloadedUpdate',
}
