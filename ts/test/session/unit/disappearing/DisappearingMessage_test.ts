import { expect } from 'chai';
import Sinon from 'sinon';
import { stubWindowLog } from '../../../test-utils/utils';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageType,
  changeToDisappearingConversationMode,
  setExpirationStartTimestamp,
} from '../../../../util/expiringMessages';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { ConversationModel } from '../../../../models/conversation';
import { ConversationTypeEnum } from '../../../../models/conversationAttributes';
import { UserUtils } from '../../../../session/utils';

describe('Disappearing Messages', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = '051234567890acbdef';
  const conversationArgs = {
    id: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
    type: ConversationTypeEnum.PRIVATE,
    isApproved: true,
    active_at: 123,
    didApproveMe: true,
  };

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('expiringMessages.ts', () => {
    describe('setExpirationStartTimestamp', () => {
      it('returns a valid unix timestamp for deleteAfterRead', async () => {
        const mode: DisappearingMessageConversationModeType = 'deleteAfterRead';
        const expirationStartTimestamp = setExpirationStartTimestamp(mode);

        expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
        expect(
          isValidUnixTimestamp(expirationStartTimestamp!),
          'it should be a valid unix timestamp'
        ).to.be.true;
      });
      it('returns a valid unix timestamp for deleteAfterSend', async () => {
        const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
        const expirationStartTimestamp = setExpirationStartTimestamp(mode);

        expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
        expect(
          isValidUnixTimestamp(expirationStartTimestamp!),
          'it should be a valid unix timestamp'
        ).to.be.true;
      });
      it('returns undefined when disappearing messages is off', async () => {
        const mode: DisappearingMessageConversationModeType = 'off';
        const expirationStartTimestamp = setExpirationStartTimestamp(mode);

        expect(expirationStartTimestamp, 'it should return undefined').to.be.undefined;
      });
      it('if we give it a timestamp it returns the older timestamp for deleteAfterRead', async () => {
        const mode: DisappearingMessageConversationModeType = 'deleteAfterRead';
        const timestamp = new Date().valueOf();
        const expirationStartTimestamp = setExpirationStartTimestamp(mode, timestamp);

        expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
        expect(
          isValidUnixTimestamp(expirationStartTimestamp!),
          'it should be a valid unix timestamp'
        ).to.be.true;
        expect(
          expirationStartTimestamp,
          'expirationStartTimestamp should be less than the input timestamp'
        ).to.be.lessThan(timestamp);
      });
      it('if we give it a timestamp it returns the older timestamp for deleteAfterSend', async () => {
        const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
        const timestamp = new Date().valueOf();
        const expirationStartTimestamp = setExpirationStartTimestamp(mode, timestamp);

        expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
        expect(
          isValidUnixTimestamp(expirationStartTimestamp!),
          'it should be a valid unix timestamp'
        ).to.be.true;
        expect(
          expirationStartTimestamp,
          'expirationStartTimestamp should be less than the input timestamp'
        ).to.be.lessThan(timestamp);
      });
      it('if we give it an invalid timestamp it returns undefined', async () => {
        const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
        const timestamp = -1;
        const expirationStartTimestamp = setExpirationStartTimestamp(mode, timestamp);

        expect(expirationStartTimestamp, 'it should return undefined').to.be.undefined;
      });
    });

    describe('changeToDisappearingMessageType', () => {
      it("if it's a Note to Self Conversation and expireTimer > 0 then the conversation mode is always deleteAfterSend", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
          id: ourNumber,
        } as any);
        const expirationType = 'deleteAfterRead'; // not correct
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          ourConversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });

      it("if it's a Group Conversation and expireTimer > 0 then the conversation mode is always deleteAfterSend", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
          type: ConversationTypeEnum.GROUP,
          // TODO update to 03 prefix when we release new groups
          id: '05123456564',
        } as any);
        const expirationType = 'deleteAfterRead'; // not correct
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          ourConversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });

      it("if it's a Private Conversation and expirationType is deleteAfterRead and expireTimer > 0 then the conversation mode stays as deleteAfterRead", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expirationType = 'deleteAfterRead';
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          ourConversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns deleteAfterRead').to.be.eq('deleteAfterRead');
      });

      it("if it's a Private Conversation and expirationType is deleteAfterSend and expireTimer > 0 then the conversation mode stays as deleteAfterSend", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expirationType = 'deleteAfterSend';
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          ourConversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });

      it('if the type is unknown and expireTimer = 0 then the conversation mode is off', async () => {
        const conversation = new ConversationModel({ ...conversationArgs } as any);
        const expirationType: DisappearingMessageType = 'unknown';
        const expireTimer = 0; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          conversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns off').to.be.eq('off');
      });

      it('if the type is undefined and expireTimer = 0 then the conversation mode is off', async () => {
        const conversation = new ConversationModel({ ...conversationArgs } as any);
        const expireTimer = 0; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          conversation,
          undefined,
          expireTimer
        );

        expect(conversationMode, 'returns off').to.be.eq('off');
      });

      it('if the type and expireTimer are undefined then the conversation mode is off', async () => {
        const conversation = new ConversationModel({ ...conversationArgs } as any);
        const conversationMode = changeToDisappearingConversationMode(conversation);

        expect(conversationMode, 'returns off').to.be.eq('off');
      });

      // TODO legacy messages support will be removed in a future release
      it('if the type is unknown and expireTimer > 0 then the conversation mode is legacy', async () => {
        const conversation = new ConversationModel({ ...conversationArgs } as any);
        const expirationType: DisappearingMessageType = 'unknown';
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          conversation,
          expirationType,
          expireTimer
        );

        expect(conversationMode, 'returns legacy').to.be.eq('legacy');
      });

      it('if the type is undefined and expireTimer > 0 then the conversation mode is legacy', async () => {
        const conversation = new ConversationModel({ ...conversationArgs } as any);
        const expireTimer = 60; // seconds
        const conversationMode = changeToDisappearingConversationMode(
          conversation,
          undefined,
          expireTimer
        );

        expect(conversationMode, 'returns legacy').to.be.eq('legacy');
      });
    });

    describe('changeToDisappearingConversationMode', () => {
      it('TODO', async () => {
        expect('TODO').to.be.eq('TODO');
      });
    });

    describe('checkForExpireUpdateInContentMessage', () => {
      it('TODO', async () => {
        expect('TODO').to.be.eq('TODO');
      });
    });
  });

  describe('conversation.ts', () => {
    describe('updateExpireTimer', () => {
      it('TODO', async () => {
        expect('TODO').to.be.eq('TODO');
      });
    });
  });

  describe('message.ts', () => {
    describe('isExpirationTimerUpdate', () => {
      it('TODO', async () => {
        expect('TODO').to.be.eq('TODO');
      });
    });
  });
});
