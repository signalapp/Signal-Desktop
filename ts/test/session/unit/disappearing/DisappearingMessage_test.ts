import chai, { expect } from 'chai';
import Sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import {
  generateDisappearingVisibleMessage,
  generateVisibleMessage,
  stubWindowLog,
} from '../../../test-utils/utils';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageType,
  changeToDisappearingConversationMode,
  changeToDisappearingMessageType,
  checkForExpireUpdateInContentMessage,
  setExpirationStartTimestamp,
} from '../../../../util/expiringMessages';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { ConversationModel } from '../../../../models/conversation';
import { ConversationTypeEnum } from '../../../../models/conversationAttributes';
import { UserUtils } from '../../../../session/utils';
import { ReleasedFeatures } from '../../../../util/releaseFeature';
import { TestUtils } from '../../../test-utils';

chai.use(chaiAsPromised as any);

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
      it("if it's a Private Conversation and the expirationMode is off and expireTimer = 0 then the message's expirationType is unknown", async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expireTimer = 0; // seconds
        const expirationMode = 'off';
        const messageExpirationType = changeToDisappearingMessageType(
          conversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
      });
      it("if it's a Private Conversation and the expirationMode is deleteAfterRead and expireTimer > 0 then the message's expirationType is deleteAfterRead", async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expireTimer = 60; // seconds
        const expirationMode = 'deleteAfterRead';
        const messageExpirationType = changeToDisappearingMessageType(
          conversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns deleteAfterRead').to.be.eq('deleteAfterRead');
      });
      it("if it's a Private Conversation and the expirationMode is deleteAfterSend and expireTimer > 0 then the message's expirationType is deleteAfterSend", async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expireTimer = 60; // seconds
        const expirationMode = 'deleteAfterSend';
        const messageExpirationType = changeToDisappearingMessageType(
          conversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });
      it("if it's a Note to Self Conversation and expireTimer > 0 then the message's expirationType is always deleteAfterSend", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
          id: ourNumber,
        } as any);
        const expireTimer = 60; // seconds
        const expirationMode = 'deleteAfterRead'; // not correct
        const messageExpirationType = changeToDisappearingMessageType(
          ourConversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });
      it("if it's a Group Conversation and expireTimer > 0 then the message's expirationType is always deleteAfterSend", async () => {
        const ourConversation = new ConversationModel({
          ...conversationArgs,
          type: ConversationTypeEnum.GROUP,
          // TODO update to 03 prefix when we release new groups
          id: '05123456564',
        } as any);
        const expireTimer = 60; // seconds
        const expirationMode = 'deleteAfterRead'; // not correct
        const messageExpirationType = changeToDisappearingMessageType(
          ourConversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
      });
      // TODO legacy messages support will be removed in a future release
      it("if it's a Private Conversation and the expirationMode is legacy and expireTimer = 0 then the message's expirationType is unknown", async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expireTimer = 0; // seconds
        const expirationMode = 'legacy';
        const messageExpirationType = changeToDisappearingMessageType(
          conversation,
          expireTimer,
          expirationMode
        );

        expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
      });
      it("if it's a Private Conversation and the expirationMode is undefined and expireTimer > 0 then the message's expirationType is unknown", async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        const expireTimer = 0; // seconds
        const messageExpirationType = changeToDisappearingMessageType(conversation, expireTimer);

        expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
      });
    });

    describe('changeToDisappearingConversationMode', () => {
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

    describe('checkForExpireUpdateInContentMessage', () => {
      it('if we receive a regular message then it returns falsy values', async () => {
        const visibleMessage = generateVisibleMessage();
        const convoToUpdate = new ConversationModel({
          ...conversationArgs,
        } as any);
        // TODO legacy messages support will be removed in a future release
        Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

        const expireUpdate = await checkForExpireUpdateInContentMessage(
          visibleMessage.contentProto(),
          convoToUpdate,
          true
        );

        expect(expireUpdate?.expirationType, 'expirationType should be unknown').to.equal(
          'unknown'
        );
        expect(expireUpdate?.expirationTimer, 'expirationTimer should be 0').to.equal(0);
        expect(
          expireUpdate?.lastDisappearingMessageChangeTimestamp,
          'lastDisappearingMessageChangeTimestamp should be 0'
        ).to.equal(0);
        expect(
          expireUpdate?.isLegacyConversationSettingMessage,
          'isLegacyConversationSettingMessage should be false'
        ).to.be.false;
        expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be
          .false;
        expect(expireUpdate?.isOutdated, 'isOutdated should be undefined').to.be.undefined;
      });
      it('if we receive a deleteAfterRead message after 1 minute then it returns those values', async () => {
        const disappearingMessage = generateDisappearingVisibleMessage({
          expirationType: 'deleteAfterRead',
          expireTimer: 60,
        });

        const convoToUpdate = new ConversationModel({
          ...conversationArgs,
        } as any);
        // TODO legacy messages support will be removed in a future release
        Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

        const expireUpdate = await checkForExpireUpdateInContentMessage(
          disappearingMessage.contentProto(),
          convoToUpdate,
          true
        );

        expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterRead').to.equal(
          'deleteAfterRead'
        );
        expect(expireUpdate?.expirationTimer, 'expirationTimer should be 60').to.equal(60);
        expect(
          expireUpdate?.lastDisappearingMessageChangeTimestamp,
          'lastDisappearingMessageChangeTimestamp should be 0'
        ).to.equal(0);
        expect(
          expireUpdate?.isLegacyConversationSettingMessage,
          'isLegacyConversationSettingMessage should be false'
        ).to.be.false;
        expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be
          .false;
        expect(expireUpdate?.isOutdated, 'isOutdated should be undefined').to.be.undefined;
      });
      it('if we receive an ExpirationTimerUpdate message for deleteAfterSend after 5 minutes then it returns those values', async () => {
        const lastDisappearingMessageChangeTimestamp = GetNetworkTime.getNowWithNetworkOffset();
        const expirationTimerUpdateMessage = generateDisappearingVisibleMessage({
          expirationType: 'deleteAfterSend',
          expireTimer: 300,
          expirationTimerUpdate: {
            expirationType: 'deleteAfterSend',
            expireTimer: 300,
            lastDisappearingMessageChangeTimestamp,
            source: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
          },
        });

        const convoToUpdate = new ConversationModel({
          ...conversationArgs,
        } as any);
        // TODO legacy messages support will be removed in a future release
        Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

        const expireUpdate = await checkForExpireUpdateInContentMessage(
          expirationTimerUpdateMessage.contentProto(),
          convoToUpdate,
          true
        );

        expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterSend').to.equal(
          'deleteAfterSend'
        );
        expect(expireUpdate?.expirationTimer, 'expirationTimer should be 300').to.equal(300);
        expect(
          expireUpdate?.lastDisappearingMessageChangeTimestamp,
          'lastDisappearingMessageChangeTimestamp should match input value'
        ).to.equal(lastDisappearingMessageChangeTimestamp);
        expect(
          expireUpdate?.isLegacyConversationSettingMessage,
          'isLegacyConversationSettingMessage should be false'
        ).to.be.false;
        expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be
          .false;
        expect(expireUpdate?.isOutdated, 'isOutdated should be undefined').to.be.undefined;
      });
      it('if we receive an outdated ExpirationTimerUpdate message then it should be ignored and is outdated', async () => {
        const lastDisappearingMessageChangeTimestamp = GetNetworkTime.getNowWithNetworkOffset();
        const expirationTimerUpdateMessage = generateDisappearingVisibleMessage({
          expirationType: 'deleteAfterSend',
          expireTimer: 300,
          expirationTimerUpdate: {
            expirationType: 'deleteAfterSend',
            expireTimer: 300,
            lastDisappearingMessageChangeTimestamp: lastDisappearingMessageChangeTimestamp - 20000,
            source: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
          },
        });

        const convoToUpdate = new ConversationModel({
          ...conversationArgs,
          lastDisappearingMessageChangeTimestamp,
        } as any);
        // TODO legacy messages support will be removed in a future release
        Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

        const expireUpdate = await checkForExpireUpdateInContentMessage(
          expirationTimerUpdateMessage.contentProto(),
          convoToUpdate,
          true
        );

        expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterSend').to.equal(
          'deleteAfterSend'
        );
        expect(expireUpdate?.expirationTimer, 'expirationTimer should be 300').to.equal(300);
        expect(
          expireUpdate?.lastDisappearingMessageChangeTimestamp,
          'lastDisappearingMessageChangeTimestamp should be undefined'
        ).to.equal(undefined);
        expect(
          expireUpdate?.isLegacyConversationSettingMessage,
          'isLegacyConversationSettingMessage should be undefined'
        ).to.be.undefined;
        expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be undefined').to.be
          .undefined;
        expect(expireUpdate?.isOutdated, 'isOutdated should be true').to.be.true;
      });
    });
  });

  describe('conversation.ts', () => {
    describe('updateExpireTimer', () => {
      it('if the coversation is public it should return false', async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);

        Sinon.stub(conversation, 'isPublic').returns(true);
        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterSend',
          providedExpireTimer: 600,
          providedChangeTimestamp: GetNetworkTime.getNowWithNetworkOffset(),
          fromSync: false, // if the update comes from a config or sync message
          shouldCommitConvo: false,
          existingMessage: undefined,
        });
        expect(updateSuccess, 'should be false').to.be.false;
      });
      it('if the lastDisappearingMessageChangeTimestamp is outdated we ignore it', async () => {
        const lastDisappearingMessageChangeTimestamp = GetNetworkTime.getNowWithNetworkOffset();
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        conversation.set({
          expirationMode: 'deleteAfterRead',
          expireTimer: 60,
          lastDisappearingMessageChangeTimestamp: lastDisappearingMessageChangeTimestamp + 20000,
        });

        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterSend',
          providedExpireTimer: 600,
          providedChangeTimestamp: lastDisappearingMessageChangeTimestamp,
          fromSync: false,
          shouldCommitConvo: false,
          existingMessage: undefined,
        });
        expect(updateSuccess, 'should be false').to.be.false;
      });
      it('if we receive the same settings we ignore it', async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        conversation.set({
          expirationMode: 'deleteAfterRead',
          expireTimer: 60,
        });

        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterRead',
          providedExpireTimer: 60,
          providedChangeTimestamp: GetNetworkTime.getNowWithNetworkOffset(),
          fromSync: false,
          shouldCommitConvo: false,
          existingMessage: undefined,
        });
        expect(updateSuccess, 'should be false').to.be.false;
      });
      it("if an update is successful then the conversation should have it's settings updated", async () => {
        const lastDisappearingMessageChangeTimestamp = GetNetworkTime.getNowWithNetworkOffset();
        const conversation = new ConversationModel({
          ...conversationArgs,
        } as any);
        Sinon.stub(conversation, 'addSingleOutgoingMessage').resolves();
        Sinon.stub(conversation, 'commit').resolves();
        TestUtils.stubData('saveMessage').resolves();

        // NOTE we pretend its a sync message so that we can avoiding sending a sync message during testing
        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterSend',
          providedExpireTimer: 600,
          providedChangeTimestamp: lastDisappearingMessageChangeTimestamp,
          providedSource: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
          receivedAt: GetNetworkTime.getNowWithNetworkOffset(),
          fromSync: true,
          shouldCommitConvo: false,
          shouldCommitMessage: false,
          existingMessage: undefined,
        });
        expect(updateSuccess, 'should be true').to.be.true;
        expect(
          conversation.get('expirationMode'),
          'expirationMode should be deleteAfterSend'
        ).to.equal('deleteAfterSend');
        expect(conversation.get('expireTimer'), 'expireTimer should be 5 minutes').to.equal(600);
        expect(
          conversation.get('lastDisappearingMessageChangeTimestamp'),
          'lastDisappearingMessageChangeTimestamp should match the input value'
        ).to.equal(lastDisappearingMessageChangeTimestamp);
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
