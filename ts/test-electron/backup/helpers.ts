// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import { tmpdir } from 'os';
import { pick, sortBy } from 'lodash';
import { createReadStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';

import type { MessageAttributesType } from '../../model-types';

import { backupsService } from '../../services/backups';
import { generateAci, generatePni } from '../../types/ServiceId';
import Data from '../../sql/Client';
import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';

export const OUR_ACI = generateAci();
export const OUR_PNI = generatePni();
export const MASTER_KEY = Bytes.toBase64(getRandomBytes(32));
export const PROFILE_KEY = getRandomBytes(32);

// This is preserved across data erasure
const CONVO_ID_TO_STABLE_ID = new Map<string, string>();

function mapConvoId(id?: string | null): string | undefined | null {
  if (id == null) {
    return id;
  }

  return CONVO_ID_TO_STABLE_ID.get(id) ?? id;
}

// We need to eliminate fields that won't stay stable through import/export
function sortAndNormalize(
  messages: Array<MessageAttributesType>
): Array<unknown> {
  return sortBy(messages, 'sent_at').map(message => {
    const shallow = pick(
      message,
      'contact',
      'conversationMerge',
      'droppedGV2MemberIds',
      'expirationTimerUpdate',
      'flags',
      'groupMigration',
      'groupV2Change',
      'invitedGV2Members',
      'isErased',
      'payment',
      'profileChange',
      'sent_at',
      'sticker',
      'timestamp',
      'type',
      'verified'
    );

    return {
      ...shallow,
      reactions: message.reactions?.map(({ fromId, ...rest }) => {
        return {
          from: mapConvoId(fromId),
          ...rest,
        };
      }),
      changedId: mapConvoId(message.changedId),
      key_changed: mapConvoId(message.key_changed),
      verifiedChanged: mapConvoId(message.verifiedChanged),
    };
  });
}

export async function symmetricRoundtripHarness(
  messages: Array<MessageAttributesType>
): Promise<void> {
  return asymmetricRoundtripHarness(messages, messages);
}

async function updateConvoIdToTitle() {
  const all = await Data.getAllConversations();
  for (const convo of all) {
    CONVO_ID_TO_STABLE_ID.set(
      convo.id,
      convo.serviceId ?? convo.e164 ?? convo.id
    );
  }
}

export async function asymmetricRoundtripHarness(
  before: Array<MessageAttributesType>,
  after: Array<MessageAttributesType>
): Promise<void> {
  const outDir = await mkdtemp(path.join(tmpdir(), 'signal-temp-'));
  try {
    const targetOutputFile = path.join(outDir, 'backup.bin');

    await Data.saveMessages(before, { forceSave: true, ourAci: OUR_ACI });

    await backupsService.exportToDisk(targetOutputFile);

    await updateConvoIdToTitle();

    await clearData();

    await backupsService.importBackup(() => createReadStream(targetOutputFile));

    const messagesFromDatabase = await Data._getAllMessages();

    await updateConvoIdToTitle();

    const expected = sortAndNormalize(after);
    const actual = sortAndNormalize(messagesFromDatabase);
    assert.deepEqual(expected, actual);
  } finally {
    await rm(outDir, { recursive: true });
  }
}

async function clearData() {
  await Data._removeAllMessages();
  await Data._removeAllConversations();
  await Data.removeAllItems();
  window.storage.reset();
  window.ConversationController.reset();

  await setupBasics();
}

export async function setupBasics(): Promise<void> {
  await window.storage.put('uuid_id', `${OUR_ACI}.2`);
  await window.storage.put('pni', OUR_PNI);
  await window.storage.put('masterKey', MASTER_KEY);
  await window.storage.put('profileKey', PROFILE_KEY);

  await window.ConversationController.getOrCreateAndWait(OUR_ACI, 'private', {
    pni: OUR_PNI,
    systemGivenName: 'ME',
    profileKey: Bytes.toBase64(PROFILE_KEY),
  });

  window.Events = {
    ...window.Events,
    getTypingIndicatorSetting: () => false,
    getLinkPreviewSetting: () => false,
  };
}
