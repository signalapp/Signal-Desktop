// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';
import { DataWriter } from '../../sql/Client.preload.js';
import { generateAci, generatePni } from '../../types/ServiceId.std.js';
import { isMessageAMatchForReaction } from '../../messageModifiers/Reactions.preload.js';
import { generateMessageId } from '../../util/generateMessageId.node.js';
import { incrementMessageCounter } from '../../util/incrementMessageCounter.preload.js';
import type { ConversationModel } from '../../models/conversations.preload.js';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { SendStatus } from '../../messages/MessageSendState.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

describe('isMessageAMatchForReaction', () => {
  let contactA: ConversationModel;
  let contactB: ConversationModel;
  let contactC: ConversationModel;
  let ourConversation: ConversationModel;
  const OUR_ACI = generateAci();
  const OUR_PNI = generatePni();
  beforeEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.user.setCredentials({
      number: '+15550000000',
      aci: OUR_ACI,
      pni: OUR_PNI,
      deviceId: 2,
      deviceName: 'my device',
      password: 'password',
    });

    window.ConversationController.reset();
    await window.ConversationController.load();

    contactA = window.ConversationController.getOrCreate(
      generateAci(),
      'private'
    );
    contactB = window.ConversationController.getOrCreate(
      generateAci(),
      'private'
    );
    contactC = window.ConversationController.getOrCreate(
      generateAci(),
      'private'
    );

    ourConversation = window.ConversationController.getOrCreate(
      OUR_ACI,
      'private'
    );
  });

  describe('incoming 1:1 message', () => {
    let message: MessageAttributesType;
    beforeEach(() => {
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'incoming',
        timestamp: 123,
        sent_at: 123,
        conversationId: contactA.id,
        sourceServiceId: contactA.attributes.serviceId,
        source: contactA.id,
      };
    });

    it('matches on our reaction', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: ourConversation.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not match if target author differs', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactB.getCheckedAci(''),
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not match if reaction sender is not in the conversation', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });

    it('does not match if timestamp differs', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 124,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does match if timestamp matches edit history', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message: {
            ...message,
            editHistory: [
              {
                timestamp: 124,
                received_at: 124,
              },
            ],
          },
          targetTimestamp: 124,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it("matches on sender's own reaction", async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not match if reaction comes from a different sender', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('outgoing 1:1 message', () => {
    let message: MessageAttributesType;
    beforeEach(() => {
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'outgoing',
        timestamp: 123,
        sent_at: 123,
        conversationId: contactA.id,
        sourceServiceId: ourConversation.attributes.serviceId,
        source: ourConversation.id,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Sent,
          },
        },
      };
    });
    it("matches on recipient's reaction", async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('matches on our own reaction', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: ourConversation.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not match if reaction comes from a different sender', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not match if message not fully sent', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message: {
            ...message,
            sendStateByConversationId: {
              [contactA.id]: {
                status: SendStatus.Pending,
              },
            },
          },
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('incoming group message', () => {
    let message: MessageAttributesType;
    let group: ConversationModel;
    beforeEach(() => {
      group = window.ConversationController.getOrCreate(
        generateGuid(),
        'group',
        {
          groupVersion: 2,
          membersV2: [
            {
              aci: contactA.getCheckedAci(''),
              joinedAtVersion: 2,
              role: 1,
            },
            {
              aci: contactB.getCheckedAci(''),
              joinedAtVersion: 2,
              role: 1,
            },
            {
              aci: OUR_ACI,
              joinedAtVersion: 2,
              role: 1,
            },
          ],
        }
      );
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'incoming',
        timestamp: 123,
        sent_at: 123,
        conversationId: group.id,
        sourceServiceId: contactA.attributes.serviceId,
        source: contactA.id,
      };
    });

    it("matches on another recipient's reaction", async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not matches if sender is not in group', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactC.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('outgoing 1:1 story', () => {
    let message: MessageAttributesType;
    beforeEach(() => {
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'story',
        timestamp: 123,
        sent_at: 123,
        conversationId: contactA.id,
        sourceServiceId: ourConversation.attributes.serviceId,
        source: ourConversation.id,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Sent,
            isAllowedToReplyToStory: true,
          },
          [contactB.id]: {
            status: SendStatus.Sent,
            isAllowedToReplyToStory: false,
          },
        },
      };
    });
    it('allows reactions from those allowed to react', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not allow reactions from those disallowed from reacting', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not allow reactions from non-recipients', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactC.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('incoming 1:1 story', () => {
    let message: MessageAttributesType;
    beforeEach(() => {
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'story',
        timestamp: 123,
        sent_at: 123,
        conversationId: contactA.id,
        sourceServiceId: contactA.attributes.serviceId,
        source: contactA.id,
      };
    });
    it('allows reactions from self', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: ourConversation.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not allow reactions from others', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('outgoing group story', () => {
    let message: MessageAttributesType;
    beforeEach(() => {
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'story',
        timestamp: 123,
        sent_at: 123,
        conversationId: contactA.id,
        sourceServiceId: ourConversation.attributes.serviceId,
        source: ourConversation.id,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Sent,
            isAllowedToReplyToStory: true,
          },
          [contactB.id]: {
            status: SendStatus.Sent,
            isAllowedToReplyToStory: false,
          },
        },
      };
    });
    it('allows reactions from those allowed to react', async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not allow reactions from those disallowed from reacting', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not allow reactions from non-recipients', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: OUR_ACI,
          reactionSenderConversationId: contactC.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('incoming group story message', () => {
    let message: MessageAttributesType;
    let group: ConversationModel;
    beforeEach(() => {
      group = window.ConversationController.getOrCreate(
        generateGuid(),
        'group',
        {
          groupVersion: 2,
          membersV2: [
            {
              aci: contactA.getCheckedAci(''),
              joinedAtVersion: 2,
              role: 1,
            },
            {
              aci: contactB.getCheckedAci(''),
              joinedAtVersion: 2,
              role: 1,
            },
            {
              aci: OUR_ACI,
              joinedAtVersion: 2,
              role: 1,
            },
          ],
        }
      );
      message = {
        ...generateMessageId(incrementMessageCounter()),
        type: 'story',
        timestamp: 123,
        sent_at: 123,
        conversationId: group.id,
        sourceServiceId: contactA.attributes.serviceId,
        source: contactA.id,
      };
    });

    it("matches on another recipient's reaction", async () => {
      assert.isTrue(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactB.id,
          ourAci: OUR_ACI,
        })
      );
    });
    it('does not matches if sender is not in group', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message,
          targetTimestamp: 123,
          targetAuthorAci: contactA.getCheckedAci(''),
          reactionSenderConversationId: contactC.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
  describe('other message types', () => {
    it('does not match on other message types', async () => {
      assert.isFalse(
        isMessageAMatchForReaction({
          message: {
            ...generateMessageId(incrementMessageCounter()),
            type: 'verified-change',
            timestamp: 123,
            sent_at: 123,
            conversationId: contactA.id,
            sourceServiceId: ourConversation.attributes.serviceId,
            source: ourConversation.id,
          },
          targetTimestamp: 123,
          targetAuthorAci: ourConversation.getCheckedAci(''),
          reactionSenderConversationId: contactA.id,
          ourAci: OUR_ACI,
        })
      );
    });
  });
});
