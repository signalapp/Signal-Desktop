// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';
import sinon from 'sinon';
import { DataWriter } from '../sql/Client';
import { ConversationModel } from '../models/conversations';
import type { ConversationAttributesType } from '../model-types.d';
import type { WebAPIType } from '../textsecure/WebAPI';
import { generateAci, normalizeServiceId } from '../types/ServiceId';
import { normalizeAci } from '../util/normalizeAci';

import { updateConversationsWithUuidLookup } from '../updateConversationsWithUuidLookup';

describe('updateConversationsWithUuidLookup', () => {
  class FakeConversationController {
    constructor(
      private readonly conversations: Array<ConversationModel> = []
    ) {}

    get(id?: string | null): ConversationModel | undefined {
      return this.conversations.find(
        conversation =>
          conversation.id === id ||
          conversation.get('e164') === id ||
          conversation.getServiceId() === id
      );
    }

    maybeMergeContacts({
      e164,
      aci: aciFromServer,
      reason,
    }: {
      e164?: string | null;
      aci?: string | null;
      reason?: string;
    }): {
      conversation: ConversationModel;
      mergePromises: Array<Promise<void>>;
    } {
      assert(
        e164,
        'FakeConversationController is not set up for this case (E164 must be provided)'
      );
      assert(
        aciFromServer,
        'FakeConversationController is not set up for this case (UUID must be provided)'
      );
      assert(
        reason,
        'FakeConversationController must be provided a reason when merging'
      );
      const normalizedAci = normalizeAci(aciFromServer!, 'test');

      const convoE164 = this.get(e164);
      const convoUuid = this.get(normalizedAci);
      assert(
        convoE164 || convoUuid,
        'FakeConversationController is not set up for this case (at least one conversation should be found)'
      );

      if (convoE164 && convoUuid) {
        if (convoE164 === convoUuid) {
          return { conversation: convoUuid, mergePromises: [] };
        }

        convoE164.unset('e164');
        convoUuid.updateE164(e164);
        return { conversation: convoUuid, mergePromises: [] };
      }

      if (convoE164 && !convoUuid) {
        convoE164.updateServiceId(normalizedAci);
        return { conversation: convoE164, mergePromises: [] };
      }

      throw new Error('FakeConversationController should never get here');
    }

    lookupOrCreate({
      e164,
      serviceId: serviceIdFromServer,
    }: {
      e164?: string | null;
      serviceId?: string | null;
    }): string | undefined {
      assert(
        e164,
        'FakeConversationController is not set up for this case (E164 must be provided)'
      );
      assert(
        serviceIdFromServer,
        'FakeConversationController is not set up for this case (UUID must be provided)'
      );
      const normalizedServiceId = normalizeServiceId(
        serviceIdFromServer!,
        'test'
      );

      const convoE164 = this.get(e164);
      const convoUuid = this.get(normalizedServiceId);
      assert(
        convoE164 || convoUuid,
        'FakeConversationController is not set up for this case (at least one conversation should be found)'
      );

      if (convoE164 && convoUuid) {
        if (convoE164 === convoUuid) {
          return convoUuid.get('id');
        }

        return convoUuid.get('id');
      }

      if (convoE164 && !convoUuid) {
        return convoE164.get('id');
      }

      assert.fail('FakeConversationController should never get here');
      return undefined;
    }
  }

  function createConversation(
    attributes: Readonly<Partial<ConversationAttributesType>> = {}
  ): ConversationModel {
    return new ConversationModel({
      id: generateUuid(),
      inbox_position: 0,
      isPinned: false,
      lastMessageDeletedForEveryone: false,
      markedUnread: false,
      messageCount: 1,
      profileSharing: true,
      sentMessageCount: 0,
      type: 'private' as const,
      version: 0,
      expireTimerVersion: 2,
      ...attributes,
    });
  }

  let sinonSandbox: sinon.SinonSandbox;

  let fakeCdsLookup: sinon.SinonStub;
  let fakeCheckAccountExistence: sinon.SinonStub;
  let fakeServer: Pick<WebAPIType, 'cdsLookup' | 'checkAccountExistence'>;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();

    sinonSandbox.stub(DataWriter, 'updateConversation');

    fakeCdsLookup = sinonSandbox.stub().resolves({
      entries: new Map(),
    });
    fakeCheckAccountExistence = sinonSandbox.stub().resolves(false);
    fakeServer = {
      cdsLookup: fakeCdsLookup,
      checkAccountExistence: fakeCheckAccountExistence,
    };
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('does nothing when called with an empty array', async () => {
    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController(),
      conversations: [],
      server: fakeServer,
    });

    sinon.assert.notCalled(fakeServer.cdsLookup as sinon.SinonStub);
  });

  it('does nothing when called with an array of conversations that lack E164s', async () => {
    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController(),
      conversations: [
        createConversation(),
        createConversation({ serviceId: generateAci() }),
      ],
      server: fakeServer,
    });

    sinon.assert.notCalled(fakeServer.cdsLookup as sinon.SinonStub);
  });

  it('updates conversations with their UUID', async () => {
    const conversation1 = createConversation({ e164: '+13215559876' });
    const conversation2 = createConversation({
      e164: '+16545559876',
      serviceId: generateAci(), // should be overwritten
    });

    const aci1 = generateAci();
    const aci2 = generateAci();

    fakeCdsLookup.resolves({
      entries: new Map([
        ['+13215559876', { aci: aci1, pni: undefined }],
        ['+16545559876', { aci: aci2, pni: undefined }],
      ]),
    });

    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController([
        conversation1,
        conversation2,
      ]),
      conversations: [conversation1, conversation2],
      server: fakeServer,
    });

    assert.strictEqual(conversation1.getServiceId(), aci1);
    assert.strictEqual(conversation2.getServiceId(), aci2);
  });

  it("marks conversations unregistered if we didn't have a UUID for them and the server also doesn't have one", async () => {
    const conversation = createConversation({ e164: '+13215559876' });
    assert.isUndefined(
      conversation.get('discoveredUnregisteredAt'),
      'Test was not set up correctly'
    );

    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController([conversation]),
      conversations: [conversation],
      server: fakeServer,
    });

    assert.approximately(
      conversation.get('discoveredUnregisteredAt') || 0,
      Date.now(),
      5000
    );
  });

  it("doesn't mark conversations unregistered if we already had a UUID for them, even if the account exists on server", async () => {
    const existingServiceId = generateAci();
    const conversation = createConversation({
      e164: '+13215559876',
      serviceId: existingServiceId,
    });
    assert.isUndefined(
      conversation.get('discoveredUnregisteredAt'),
      'Test was not set up correctly'
    );

    fakeCheckAccountExistence.resolves(true);

    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController([conversation]),
      conversations: [conversation],
      server: fakeServer,
    });

    assert.strictEqual(conversation.getServiceId(), existingServiceId);
    assert.isUndefined(conversation.get('discoveredUnregisteredAt'));
  });

  it('marks conversations unregistered and removes UUID if the account does not exist on server', async () => {
    const existingServiceId = generateAci();
    const conversation = createConversation({
      e164: '+13215559876',
      serviceId: existingServiceId,
    });
    assert.isUndefined(
      conversation.get('discoveredUnregisteredAt'),
      'Test was not set up correctly'
    );

    fakeCheckAccountExistence.resolves(false);

    await updateConversationsWithUuidLookup({
      conversationController: new FakeConversationController([conversation]),
      conversations: [conversation],
      server: fakeServer,
    });

    assert.isUndefined(conversation.getServiceId());
    assert.isNumber(conversation.get('discoveredUnregisteredAt'));
  });
});
