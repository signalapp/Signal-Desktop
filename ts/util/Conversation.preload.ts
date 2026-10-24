// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import type { ConversationAttributesType } from '../model-types.std.ts';
import { maybeDeleteAttachmentFile } from './migrations.preload.ts';
import * as Bytes from '../Bytes.std.ts';
import { sha256 } from '../Crypto.node.ts';
import * as RemoteConfig from '../RemoteConfig.dom.ts';
import { parseIntWithFallback } from './parseIntWithFallback.std.ts';

async function deleteExternalFiles(
  conversation: ConversationAttributesType
): Promise<void> {
  if (!conversation) {
    return;
  }

  const { avatar, profileAvatar } = conversation;

  if (avatar && avatar.path) {
    await maybeDeleteAttachmentFile(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    await maybeDeleteAttachmentFile(profileAvatar.path);
  }
}

export async function removeConversation(id: string): Promise<void> {
  const existing = await DataReader.getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await DataWriter._removeConversation(id);
    await deleteExternalFiles(existing);
  }
}

export function computeGroupNameHash(name: string): string {
  return Bytes.toBase64(sha256(Bytes.fromString(name)));
}

export function getPinnedConversationLimit(): number {
  const remoteValue = RemoteConfig.getValue('global.pinnedChatLimit');
  return parseIntWithFallback(remoteValue, 4);
}
