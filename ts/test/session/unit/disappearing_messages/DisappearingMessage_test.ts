import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';
import { Conversation, ConversationModel } from '../../../../models/conversation';
import {
  ConversationAttributes,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { DisappearingMessages } from '../../../../session/disappearing_messages';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageType,
} from '../../../../session/disappearing_messages/types';
import { UserUtils } from '../../../../session/utils';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { ReleasedFeatures } from '../../../../util/releaseFeature';
import { TestUtils } from '../../../test-utils';
import {
  generateDisappearingVisibleMessage,
  generateFakeExpirationTimerUpdate,
  generateFakeIncomingPrivateMessage,
  generateFakeOutgoingPrivateMessage,
  generateVisibleMessage,
} from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);

const testPubkey = TestUtils.generateFakePubKeyStr();

describe('DisappearingMessage', () => {
  const getLatestTimestampOffset = 200000;
  const ourNumber = TestUtils.generateFakePubKeyStr();
  const conversationArgs = {
    id: testPubkey,
    type: ConversationTypeEnum.PRIVATE,
    isApproved: true,
    active_at: 123,
    didApproveMe: true,
  } as ConversationAttributes;

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('setExpirationStartTimestamp', () => {
    it('returns a valid unix timestamp for deleteAfterRead', async () => {
      const mode: DisappearingMessageConversationModeType = 'deleteAfterRead';
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(mode);

      expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
      expect(isValidUnixTimestamp(expirationStartTimestamp!), 'it should be a valid unix timestamp')
        .to.be.true;
    });
    it('returns a valid unix timestamp for deleteAfterSend', async () => {
      const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(mode);

      expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
      expect(isValidUnixTimestamp(expirationStartTimestamp!), 'it should be a valid unix timestamp')
        .to.be.true;
    });
    it('returns undefined when disappearing messages is off', async () => {
      const mode: DisappearingMessageConversationModeType = 'off';
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(mode);

      expect(expirationStartTimestamp, 'it should return undefined').to.be.undefined;
    });
    it('if we give it a timestamp it returns the older timestamp for deleteAfterRead', async () => {
      const mode: DisappearingMessageConversationModeType = 'deleteAfterRead';
      const timestamp = new Date().valueOf();
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
        mode,
        timestamp
      );

      expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
      expect(isValidUnixTimestamp(expirationStartTimestamp!), 'it should be a valid unix timestamp')
        .to.be.true;
      expect(
        expirationStartTimestamp,
        'expirationStartTimestamp should be less than the input timestamp'
      ).to.be.lessThan(timestamp);
    });
    it('if we give it a timestamp it returns the older timestamp for deleteAfterSend', async () => {
      const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
      const timestamp = new Date().valueOf();
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
        mode,
        timestamp
      );

      expect(expirationStartTimestamp, 'it should return a number').to.be.is.a('number');
      expect(isValidUnixTimestamp(expirationStartTimestamp!), 'it should be a valid unix timestamp')
        .to.be.true;
      expect(
        expirationStartTimestamp,
        'expirationStartTimestamp should be less than the input timestamp'
      ).to.be.lessThan(timestamp);
    });
    it('if we give it an invalid timestamp it returns undefined', async () => {
      const mode: DisappearingMessageConversationModeType = 'deleteAfterSend';
      const timestamp = -1;
      const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
        mode,
        timestamp
      );

      expect(expirationStartTimestamp, 'it should return undefined').to.be.undefined;
    });
  });

  describe('changeToDisappearingMessageType', () => {
    it("if it's a Private Conversation and the expirationMode is off and expireTimer = 0 then the message's expirationType is unknown", async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
      });
      const expireTimer = 0; // seconds
      const expirationMode = 'off';
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
        conversation,
        expireTimer,
        expirationMode
      );

      expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
    });
    it("if it's a Private Conversation and the expirationMode is deleteAfterRead and expireTimer > 0 then the message's expirationType is deleteAfterRead", async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
      });
      const expireTimer = 60; // seconds
      const expirationMode = 'deleteAfterRead';
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
        conversation,
        expireTimer,
        expirationMode
      );

      expect(messageExpirationType, 'returns deleteAfterRead').to.be.eq('deleteAfterRead');
    });
    it("if it's a Private Conversation and the expirationMode is deleteAfterSend and expireTimer > 0 then the message's expirationType is deleteAfterSend", async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
      });
      const expireTimer = 60; // seconds
      const expirationMode = 'deleteAfterSend';
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
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
      });
      const expireTimer = 60; // seconds
      const expirationMode = 'deleteAfterRead'; // not correct
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
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
      });
      const expireTimer = 60; // seconds
      const expirationMode = 'deleteAfterRead'; // not correct
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
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
      });
      const expireTimer = 0; // seconds
      const expirationMode = 'legacy';
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
        conversation,
        expireTimer,
        expirationMode
      );

      expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
    });
    it("if it's a Private Conversation and the expirationMode is undefined and expireTimer > 0 then the message's expirationType is unknown", async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
      });
      const expireTimer = 0; // seconds
      const messageExpirationType = DisappearingMessages.changeToDisappearingMessageType(
        conversation,
        expireTimer
      );

      expect(messageExpirationType, 'returns unknown').to.be.eq('unknown');
    });
  });

  describe('changeToDisappearingConversationMode', () => {
    it("if it's a Note to Self Conversation and expireTimer > 0 then the conversation mode is always deleteAfterSend", async () => {
      const ourConversation = new ConversationModel({
        ...conversationArgs,
        id: ourNumber,
      });
      const expirationType = 'deleteAfterRead'; // not correct
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
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
      });
      const expirationType = 'deleteAfterRead'; // not correct
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        ourConversation,
        expirationType,
        expireTimer
      );

      expect(conversationMode, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
    });
    it("if it's a Private Conversation and expirationType is deleteAfterRead and expireTimer > 0 then the conversation mode stays as deleteAfterRead", async () => {
      const ourConversation = new ConversationModel({
        ...conversationArgs,
      });
      const expirationType = 'deleteAfterRead';
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        ourConversation,
        expirationType,
        expireTimer
      );

      expect(conversationMode, 'returns deleteAfterRead').to.be.eq('deleteAfterRead');
    });
    it("if it's a Private Conversation and expirationType is deleteAfterSend and expireTimer > 0 then the conversation mode stays as deleteAfterSend", async () => {
      const ourConversation = new ConversationModel({
        ...conversationArgs,
      });
      const expirationType = 'deleteAfterSend';
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        ourConversation,
        expirationType,
        expireTimer
      );

      expect(conversationMode, 'returns deleteAfterSend').to.be.eq('deleteAfterSend');
    });
    it('if the type is unknown and expireTimer = 0 then the conversation mode is off', async () => {
      const conversation = new ConversationModel({ ...conversationArgs });
      const expirationType: DisappearingMessageType = 'unknown';
      const expireTimer = 0; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        conversation,
        expirationType,
        expireTimer
      );

      expect(conversationMode, 'returns off').to.be.eq('off');
    });
    it('if the type is undefined and expireTimer = 0 then the conversation mode is off', async () => {
      const conversation = new ConversationModel({ ...conversationArgs });
      const expireTimer = 0; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        conversation,
        undefined,
        expireTimer
      );

      expect(conversationMode, 'returns off').to.be.eq('off');
    });
    it('if the type and expireTimer are undefined then the conversation mode is off', async () => {
      const conversation = new ConversationModel({ ...conversationArgs });
      const conversationMode =
        DisappearingMessages.changeToDisappearingConversationMode(conversation);

      expect(conversationMode, 'returns off').to.be.eq('off');
    });
    // TODO legacy messages support will be removed in a future release
    it('if the type is unknown and expireTimer > 0 then the conversation mode is legacy', async () => {
      const conversation = new ConversationModel({ ...conversationArgs });
      const expirationType: DisappearingMessageType = 'unknown';
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
        conversation,
        expirationType,
        expireTimer
      );

      expect(conversationMode, 'returns legacy').to.be.eq('legacy');
    });
    it('if the type is undefined and expireTimer > 0 then the conversation mode is legacy', async () => {
      const conversation = new ConversationModel({ ...conversationArgs });
      const expireTimer = 60; // seconds
      const conversationMode = DisappearingMessages.changeToDisappearingConversationMode(
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
      });
      // TODO legacy messages support will be removed in a future release
      Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

      const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
        visibleMessage.contentProto(),
        convoToUpdate,
        null
      );

      expect(expireUpdate?.expirationType, 'expirationType should be unknown').to.equal('unknown');
      expect(expireUpdate?.expirationTimer, 'expirationTimer should be 0').to.equal(0);

      expect(
        expireUpdate?.isLegacyConversationSettingMessage,
        'isLegacyConversationSettingMessage should be false'
      ).to.be.false;
      expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be.false;
    });
    it('if we receive a deleteAfterRead message after 1 minute then it returns those values', async () => {
      const disappearingMessage = generateDisappearingVisibleMessage({
        expirationType: 'deleteAfterRead',
        expireTimer: 60,
      });

      const convoToUpdate = new ConversationModel({
        ...conversationArgs,
      });
      // TODO legacy messages support will be removed in a future release
      Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

      const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
        disappearingMessage.contentProto(),
        convoToUpdate,
        null
      );

      expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterRead').to.equal(
        'deleteAfterRead'
      );
      expect(expireUpdate?.expirationTimer, 'expirationTimer should be 60').to.equal(60);

      expect(
        expireUpdate?.isLegacyConversationSettingMessage,
        'isLegacyConversationSettingMessage should be false'
      ).to.be.false;
      expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be.false;
    });
    it('if we receive an ExpirationTimerUpdate message for deleteAfterSend after 5 minutes then it returns those values', async () => {
      const expirationTimerUpdateMessage = generateDisappearingVisibleMessage({
        expirationType: 'deleteAfterSend',
        expireTimer: 300,
        expirationTimerUpdate: {
          expirationType: 'deleteAfterSend',
          expireTimer: 300,
          source: testPubkey,
        },
      });

      const convoToUpdate = new ConversationModel({
        ...conversationArgs,
      });
      // TODO legacy messages support will be removed in a future release
      Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

      const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
        expirationTimerUpdateMessage.contentProto(),
        convoToUpdate,
        null
      );

      expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterSend').to.equal(
        'deleteAfterSend'
      );
      expect(expireUpdate?.expirationTimer, 'expirationTimer should be 300').to.equal(300);

      expect(
        expireUpdate?.isLegacyConversationSettingMessage,
        'isLegacyConversationSettingMessage should be false'
      ).to.be.false;
      expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be.false;
    });
    it('if we receive an outdated ExpirationTimerUpdate message then it should be ignored and is outdated', async () => {
      const expirationTimerUpdateMessage = generateDisappearingVisibleMessage({
        expirationType: 'deleteAfterSend',
        expireTimer: 300,
        expirationTimerUpdate: {
          expirationType: 'deleteAfterSend',
          expireTimer: 300,
          source: testPubkey,
        },
      });

      const convoToUpdate = new ConversationModel({
        ...conversationArgs,
      });
      // TODO legacy messages support will be removed in a future release
      Sinon.stub(ReleasedFeatures, 'checkIsDisappearMessageV2FeatureReleased').resolves(true);

      const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
        expirationTimerUpdateMessage.contentProto(),
        convoToUpdate,
        null
      );

      expect(expireUpdate?.expirationType, 'expirationType should be deleteAfterSend').to.equal(
        'deleteAfterSend'
      );
      expect(expireUpdate?.expirationTimer, 'expirationTimer should be 300').to.equal(300);

      expect(
        expireUpdate?.isLegacyConversationSettingMessage,
        'isLegacyConversationSettingMessage should be false'
      ).to.be.false;
      expect(expireUpdate?.isLegacyDataMessage, 'isLegacyDataMessage should be false').to.be.false;
    });
  });

  describe('checkForExpiringInOutgoingMessage', () => {
    it('if the message is supposed to disappear then the expirationStartTimestamp should be set to the sent_at value', async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
        id: ourNumber,
      });
      const message = generateFakeOutgoingPrivateMessage(conversation.get('id'));
      message.set({
        expirationType: 'deleteAfterRead',
        expireTimer: 300,
        sent_at: GetNetworkTime.getNowWithNetworkOffset(),
      });
      Sinon.stub(message, 'getConversation').returns(conversation);

      DisappearingMessages.checkForExpiringOutgoingMessage(message, 'unit tests');

      expect(message.getExpirationStartTimestamp(), 'it should be defined').to.not.be.undefined;
      expect(
        isValidUnixTimestamp(message.getExpirationStartTimestamp()),
        'it should be a valid unix timestamp'
      ).to.be.true;
      expect(message.getExpirationStartTimestamp(), 'it should equal the sent_at value').to.equal(
        message.get('sent_at')
      );
    });
    it('if there is no expireTimer then the expirationStartTimestamp should be undefined', async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
        id: ourNumber,
      });
      const message = generateFakeOutgoingPrivateMessage(conversation.get('id'));
      message.set({
        expirationType: 'deleteAfterRead',
        sent_at: GetNetworkTime.getNowWithNetworkOffset(),
      });
      Sinon.stub(message, 'getConversation').returns(conversation);

      DisappearingMessages.checkForExpiringOutgoingMessage(message, 'unit tests');

      expect(message.getExpirationStartTimestamp(), 'it should be undefined').to.be.undefined;
    });
    it('if there is no expirationType then the expirationStartTimestamp should be undefined', async () => {
      const conversation = new ConversationModel({
        ...conversationArgs,
        id: ourNumber,
      });
      const message = generateFakeOutgoingPrivateMessage(conversation.get('id'));
      message.set({
        expireTimer: 300,
        sent_at: GetNetworkTime.getNowWithNetworkOffset(),
      });
      Sinon.stub(message, 'getConversation').returns(conversation);

      DisappearingMessages.checkForExpiringOutgoingMessage(message, 'unit tests');

      expect(message.getExpirationStartTimestamp(), 'it should be undefined').to.be.undefined;
    });
    it('if expirationStartTimestamp is already defined then it should not have changed', async () => {
      const now = GetNetworkTime.getNowWithNetworkOffset();
      const conversation = new ConversationModel({
        ...conversationArgs,
        id: ourNumber,
      });
      const message = generateFakeOutgoingPrivateMessage(conversation.get('id'));
      message.set({
        expirationType: 'deleteAfterRead',
        expireTimer: 300,
        sent_at: now,
        expirationStartTimestamp: now + 10000,
      });
      Sinon.stub(message, 'getConversation').returns(conversation);

      DisappearingMessages.checkForExpiringOutgoingMessage(message, 'unit tests');

      expect(message.getExpirationStartTimestamp(), 'it should be defined').to.not.be.undefined;
      expect(
        isValidUnixTimestamp(message.getExpirationStartTimestamp()),
        'it should be a valid unix timestamp'
      ).to.be.true;
      expect(message.getExpirationStartTimestamp(), 'it should equal its original value').to.equal(
        now + 10000
      );
    });
  });

  describe('conversation.ts', () => {
    describe('updateExpireTimer', () => {
      it('if the conversation is public it should throw', async () => {
        const conversation = new ConversationModel({
          ...conversationArgs,
        });

        Sinon.stub(conversation, 'isPublic').returns(true);

        const promise = conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterSend',
          providedExpireTimer: 600,
          fromSync: false, // if the update comes from a config or sync message
          shouldCommitConvo: false,
          existingMessage: undefined,
          fromCurrentDevice: false,
          fromConfigMessage: false,
        });
        await expect(promise).is.rejectedWith(
          "updateExpireTimer() Disappearing messages aren't supported in communities"
        );
      });

      // we always add a message when we get an update as we remove previous ones and only keep one in the history
      it("if we receive the same settings we don't ignore it", async () => {
        TestUtils.stubData('saveMessage').resolves();
        TestUtils.stubData('getItemById').resolves();
        TestUtils.stubData('createOrUpdateItem').resolves();

        const conversation = new ConversationModel({
          ...conversationArgs,
        });
        conversation.set({
          expirationMode: 'deleteAfterRead',
          expireTimer: 60,
        });
        Sinon.stub(conversation, 'commit').resolves();
        Sinon.stub(Conversation, 'cleanUpExpireHistoryFromConvo').resolves();

        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterRead',
          providedExpireTimer: 60,
          fromSync: false,
          shouldCommitConvo: false,
          existingMessage: undefined,
          fromCurrentDevice: false,
          fromConfigMessage: false,
        });
        expect(updateSuccess, 'should be true').to.be.true;
      });

      it("if an update is successful then the conversation should have it's settings updated", async () => {
        Sinon.stub(Conversation, 'cleanUpExpireHistoryFromConvo').resolves();
        const conversation = new ConversationModel({
          ...conversationArgs,
        });
        Sinon.stub(conversation, 'addSingleOutgoingMessage').resolves();
        Sinon.stub(conversation, 'commit').resolves();
        TestUtils.stubData('saveMessage').resolves();

        // NOTE we pretend its a sync message so that we can avoiding sending a sync message during testing
        const updateSuccess = await conversation.updateExpireTimer({
          providedDisappearingMode: 'deleteAfterSend',
          providedExpireTimer: 600,
          providedSource: testPubkey,
          receivedAt: GetNetworkTime.getNowWithNetworkOffset(),
          fromSync: true,
          shouldCommitConvo: false,
          existingMessage: undefined,
          fromCurrentDevice: false,
          fromConfigMessage: false,
        });
        expect(updateSuccess, 'should be true').to.be.true;
        expect(
          conversation.getExpirationMode(),
          'expirationMode should be deleteAfterSend'
        ).to.equal('deleteAfterSend');
        expect(conversation.getExpireTimer(), 'expireTimer should be 5 minutes').to.equal(600);
      });
    });
  });

  describe('message.ts', () => {
    describe('isExpirationTimerUpdate', () => {
      it('should return true if the message is an expirationTimerUpdate', async () => {
        const expirationTimerUpdateMessage = generateFakeExpirationTimerUpdate({
          expirationType: 'deleteAfterSend',
          expireTimer: 300,
          source: testPubkey,
        });

        expect(expirationTimerUpdateMessage.get('flags'), 'flags should be 2').to.equal(2);
        expect(
          expirationTimerUpdateMessage.getExpirationTimerUpdate(),
          'expirationTimerUpdate should not be empty'
        ).to.not.be.empty;
        expect(
          expirationTimerUpdateMessage.getExpirationTimerUpdate(),
          'expirationTimerUpdate should not be empty'
        ).to.not.be.empty;
        expect(expirationTimerUpdateMessage.isExpirationTimerUpdate(), 'should be true').to.be.true;
      });
      it('should return false if the message is not an expirationTimerUpdate', async () => {
        const message = generateFakeIncomingPrivateMessage();
        expect(message.isExpirationTimerUpdate(), 'should be false').to.be.false;
      });
    });
  });
});
