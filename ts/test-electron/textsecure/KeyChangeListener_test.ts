// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { DataWriter } from '../../sql/Client.js';
import { getRandomBytes } from '../../Crypto.js';
import { Address } from '../../types/Address.js';
import { generateAci } from '../../types/ServiceId.js';
import { explodePromise } from '../../util/explodePromise.js';
import { SignalProtocolStore } from '../../SignalProtocolStore.js';
import type { ConversationModel } from '../../models/conversations.js';
import * as KeyChangeListener from '../../textsecure/KeyChangeListener.js';
import { itemStorage } from '../../textsecure/Storage.js';
import * as Bytes from '../../Bytes.js';
import { cleanupMessages } from '../../util/cleanup.js';

describe('KeyChangeListener', () => {
  let oldNumberId: string | undefined;
  let oldUuidId: string | undefined;

  const ourServiceId = generateAci();
  const ourServiceIdWithKeyChange = generateAci();
  const address = Address.create(ourServiceIdWithKeyChange, 1);
  const oldKey = getRandomBytes(33);
  const newKey = getRandomBytes(33);
  let store: SignalProtocolStore;

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    oldNumberId = itemStorage.get('number_id');
    oldUuidId = itemStorage.get('uuid_id');
    await itemStorage.put('number_id', '+14155555556.2');
    await itemStorage.put('uuid_id', `${ourServiceId}.2`);
  });

  after(async () => {
    await DataWriter.removeAll();

    await itemStorage.fetch();

    if (oldNumberId) {
      await itemStorage.put('number_id', oldNumberId);
    }
    if (oldUuidId) {
      await itemStorage.put('uuid_id', oldUuidId);
    }
  });

  let convo: ConversationModel;

  beforeEach(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    convo = await window.ConversationController.getOrCreateAndWait(
      ourServiceIdWithKeyChange,
      'private'
    );

    store = new SignalProtocolStore();
    await store.hydrateCaches();
    KeyChangeListener.init(store);
    return store.saveIdentity(address, oldKey);
  });

  afterEach(async () => {
    await DataWriter.removeMessagesInConversation(convo.id, {
      logId: ourServiceIdWithKeyChange,
      cleanupMessages,
    });
    await DataWriter.removeConversation(convo.id);

    await store.removeIdentityKey(ourServiceIdWithKeyChange);
  });

  describe('When we have a conversation with this contact', () => {
    it('generates a key change notice in the private conversation with this contact', async () => {
      const original = convo.addKeyChange;
      const { resolve, promise } = explodePromise<void>();
      convo.addKeyChange = async () => {
        convo.addKeyChange = original;
        resolve();
      };
      await store.saveIdentity(address, newKey);
      return promise;
    });
  });

  describe('When we have a group with this contact', () => {
    let groupConvo: ConversationModel;

    beforeEach(async () => {
      await window.ConversationController.getOrCreateAndWait(
        ourServiceId,
        'private'
      );
      groupConvo = await window.ConversationController.getOrCreateAndWait(
        Bytes.toBinary(
          new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5])
        ),
        'group',
        {
          members: [ourServiceIdWithKeyChange, ourServiceId],
        }
      );
    });

    afterEach(async () => {
      await DataWriter.removeMessagesInConversation(groupConvo.id, {
        logId: ourServiceIdWithKeyChange,
        cleanupMessages,
      });
      await DataWriter.removeConversation(groupConvo.id);
    });

    it('generates a key change notice in the group conversation with this contact', async () => {
      const original = groupConvo.addKeyChange;

      const { resolve, promise } = explodePromise<void>();
      groupConvo.addKeyChange = async (_, keyChangedId) => {
        assert.equal(ourServiceIdWithKeyChange, keyChangedId);
        groupConvo.addKeyChange = original;
        resolve();
      };

      await store.saveIdentity(address, newKey);
      return promise;
    });
  });
});
