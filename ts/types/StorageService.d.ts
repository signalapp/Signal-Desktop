// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type ExtendedStorageID = {
  storageID: string;
  storageVersion?: number;
};

export type RemoteRecord = ExtendedStorageID & {
  itemType: number;
};

export type UnknownRecord = RemoteRecord;
