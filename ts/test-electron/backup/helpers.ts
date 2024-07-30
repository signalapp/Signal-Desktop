// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import { tmpdir } from 'os';
import { sortBy } from 'lodash';
import { createReadStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import * as sinon from 'sinon';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';

import type {
  EditHistoryType,
  MessageAttributesType,
  MessageReactionType,
} from '../../model-types';
import type {
  SendStateByConversationId,
  SendState,
} from '../../messages/MessageSendState';

import { backupsService } from '../../services/backups';
import { isUnsupportedMessage } from '../../state/selectors/message';
import { generateAci, generatePni } from '../../types/ServiceId';
import { DataReader, DataWriter } from '../../sql/Client';
import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';

export const OUR_ACI = generateAci();
export const OUR_PNI = generatePni();
export const MASTER_KEY = Bytes.toBase64(getRandomBytes(32));
export const PROFILE_KEY = getRandomBytes(32);

// This is preserved across data erasure
const CONVO_ID_TO_STABLE_ID = new Map<string, string>();

function mapConvoId(id?: string | null): string | undefined {
  if (id == null) {
    return undefined;
  }

  return CONVO_ID_TO_STABLE_ID.get(id) ?? id;
}

type MessageAttributesForComparisonType = Omit<
  MessageAttributesType,
  'id' | 'received_at' | 'editHistory' | 'reactions' | 'conversationId'
> & {
  conversationId: string | undefined;
  editHistory?: Array<Omit<EditHistoryType, 'received_at'>>;
  reactions?: Array<Omit<MessageReactionType, 'fromId'>>;
};

// We need to eliminate fields that won't stay stable through import/export
function sortAndNormalize(
  messages: Array<MessageAttributesType>
): Array<MessageAttributesForComparisonType> {
  return sortBy(messages, 'sent_at').map(message => {
    const {
      changedId,
      conversationId,
      editHistory,
      key_changed: keyChanged,
      reactions,
      sendStateByConversationId,
      verifiedChanged,

      // This is not in the backup
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      id: _id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      received_at: _receivedAt,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sourceDevice: _sourceDevice,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      editMessageReceivedAt: _editMessageReceivedAt,

      ...rest
    } = message;

    function mapSendState(
      sendState?: SendStateByConversationId
    ): SendStateByConversationId | undefined {
      if (sendState == null) {
        return undefined;
      }

      const result: Record<string, SendState> = {};
      for (const [id, state] of Object.entries(sendState)) {
        result[mapConvoId(id) ?? id] = state;
      }
      return result;
    }

    // Get rid of unserializable `undefined` values.
    return JSON.parse(
      JSON.stringify({
        ...rest,
        conversationId: mapConvoId(conversationId),
        reactions: reactions?.map(({ fromId, ...restOfReaction }) => {
          return {
            from: mapConvoId(fromId),
            ...restOfReaction,
          };
        }),
        changedId: mapConvoId(changedId),
        key_changed: mapConvoId(keyChanged),
        verifiedChanged: mapConvoId(verifiedChanged),
        sendStateByConverationId: mapSendState(sendStateByConversationId),
        editHistory: editHistory?.map(history => {
          const {
            sendStateByConversationId: historySendState,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            received_at: _receivedAtHistory,
            ...restOfHistory
          } = history;

          return {
            ...restOfHistory,
            sendStateByConversationId: mapSendState(historySendState),
          };
        }),

        // Not an original property, but useful
        isUnsupported: isUnsupportedMessage(message),
      })
    );
  });
}

type HarnessOptionsType = {
  backupLevel: BackupLevel;
  comparator?: (
    msgBefore: MessageAttributesForComparisonType,
    msgAfter: MessageAttributesForComparisonType
  ) => void;
};

export async function symmetricRoundtripHarness(
  messages: Array<MessageAttributesType>,
  options: HarnessOptionsType = { backupLevel: BackupLevel.Messages }
): Promise<void> {
  return asymmetricRoundtripHarness(messages, messages, options);
}

async function updateConvoIdToTitle() {
  const all = await DataReader.getAllConversations();
  for (const convo of all) {
    CONVO_ID_TO_STABLE_ID.set(
      convo.id,
      convo.serviceId ?? convo.e164 ?? convo.masterKey ?? convo.id
    );
  }
}

export async function asymmetricRoundtripHarness(
  before: Array<MessageAttributesType>,
  after: Array<MessageAttributesType>,
  options: HarnessOptionsType = { backupLevel: BackupLevel.Messages }
): Promise<void> {
  const outDir = await mkdtemp(path.join(tmpdir(), 'signal-temp-'));
  const fetchAndSaveBackupCdnObjectMetadata = sinon.stub(
    backupsService,
    'fetchAndSaveBackupCdnObjectMetadata'
  );
  try {
    const targetOutputFile = path.join(outDir, 'backup.bin');

    await DataWriter.saveMessages(before, { forceSave: true, ourAci: OUR_ACI });

    await backupsService.exportToDisk(targetOutputFile, options.backupLevel);

    await updateConvoIdToTitle();

    await clearData();

    await backupsService.importBackup(() => createReadStream(targetOutputFile));

    const messagesFromDatabase = await DataReader._getAllMessages();

    await updateConvoIdToTitle();

    const expected = sortAndNormalize(after);
    const actual = sortAndNormalize(messagesFromDatabase);

    if (options.comparator) {
      assert.strictEqual(actual.length, expected.length);
      for (let i = 0; i < actual.length; i += 1) {
        options.comparator(expected[i], actual[i]);
      }
    } else {
      assert.deepEqual(actual, expected);
    }
  } finally {
    fetchAndSaveBackupCdnObjectMetadata.restore();
    await rm(outDir, { recursive: true });
  }
}

async function clearData() {
  await DataWriter._removeAllMessages();
  await DataWriter._removeAllConversations();
  await DataWriter.removeAllItems();
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
