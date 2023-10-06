import { expect } from 'chai';
import Sinon from 'sinon';
import { stubWindowLog } from '../../../test-utils/utils';
import {
  DisappearingMessageConversationModeType,
  setExpirationStartTimestamp,
} from '../../../../util/expiringMessages';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';

describe('Disappearing Messages', () => {
  stubWindowLog();
  const getLatestTimestampOffset = 200000;

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
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

    it('changeToDisappearingMessageType', async () => {
      expect('TODO').to.be.eq('TODO');
    });

    it('changeToDisappearingConversationMode', async () => {
      expect('TODO').to.be.eq('TODO');
    });

    it('checkForExpireUpdateInContentMessage', async () => {
      expect('TODO').to.be.eq('TODO');
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
