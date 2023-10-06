import { expect } from 'chai';
import Sinon from 'sinon';
import { stubWindowLog } from '../../../test-utils/utils';
import {
  DisappearingMessageConversationModeType,
  setExpirationStartTimestamp,
} from '../../../../util/expiringMessages';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';

describe('Disappearing Messages', () => {
  stubWindowLog();

  beforeEach(() => {
    // TODO Stubbing
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

      // TODO Test with timestamp argument
      // Timestamp is bigger
      // Timestamp is smaller
      // Timestamp is the equal
      // Timestamp is invalid
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
