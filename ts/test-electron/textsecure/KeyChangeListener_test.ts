// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as getGuid } from 'uuid';

import { getRandomBytes } from '../../Crypto';
import { Address } from '../../types/Address';
import { UUID } from '../../types/UUID';
import { SignalProtocolStore } from '../../SignalProtocolStore';
import type { ConversationModel } from '../../models/conversations';
import * as KeyChangeListener from '../../textsecure/KeyChangeListener';
import * as Bytes from '../../Bytes';

describe('KeyChangeListener', () => {
  let oldNumberId: string | undefined;
  let oldUuidId: string | undefined;

  const ourUuid = getGuid();
  const uuidWithKeyChange = getGuid();
  const address = Address.create(uuidWithKeyChange, 1);
  const oldKey = getRandomBytes(33);
  const newKey = getRandomBytes(33);
  let store: SignalProtocolStore;

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    const { storage } = window.textsecure;

    oldNumberId = storage.get('number_id');
    oldUuidId = storage.get('uuid_id');
    await storage.put('number_id', '+14155555556.2');
    await storage.put('uuid_id', `${ourUuid}.2`);
  });

  after(async () => {
    await window.Signal.Data.removeAll();

    const { storage } = window.textsecure;
    await storage.fetch();

    if (oldNumberId) {
      await storage.put('number_id', oldNumberId);
    }
    if (oldUuidId) {
      await storage.put('uuid_id', oldUuidId);
    }
  });

  let convo: ConversationModel;

  beforeEach(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    convo = await window.ConversationController.getOrCreateAndWait(
      uuidWithKeyChange,
      'private'
    );

    store = new SignalProtocolStore();
    await store.hydrateCaches();
    KeyChangeListener.init(store);
    return store.saveIdentity(address, oldKey);
  });

  afterEach(async () => {
    await window.Signal.Data.removeAllMessagesInConversation(convo.id, {
      logId: uuidWithKeyChange,
    });
    await window.Signal.Data.removeConversation(convo.id);

    await store.removeIdentityKey(new UUID(uuidWithKeyChange));
  });

  describe('When we have a conversation with this contact', () => {
    it('generates a key change notice in the private conversation with this contact', done => {
      const original = convo.addKeyChange;
      convo.addKeyChange = async () => {
        convo.addKeyChange = original;
        done();
      };
      store.saveIdentity(address, newKey);
    });
  });

  describe('When we have a group with this contact', () => {
    let groupConvo: ConversationModel;

    beforeEach(async () => {
      groupConvo = await window.ConversationController.getOrCreateAndWait(
        Bytes.toBinary(
          new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5])
        ),
        'group',
        {
          members: [uuidWithKeyChange],
        }
      );
    });

    afterEach(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(groupConvo.id, {
        logId: uuidWithKeyChange,
      });
      await window.Signal.Data.removeConversation(groupConvo.id);
    });

    it('generates a key change notice in the group conversation with this contact', done => {
      const original = groupConvo.addKeyChange;
      groupConvo.addKeyChange = async (_, keyChangedId) => {
        assert.equal(uuidWithKeyChange, keyChangedId?.toString());
        groupConvo.addKeyChange = original;
        done();
      };

      store.saveIdentity(address, newKey);
    });
  });
});
