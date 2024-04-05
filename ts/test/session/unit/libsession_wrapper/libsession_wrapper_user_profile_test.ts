/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';

import { ConversationModel } from '../../../../models/conversation';
import {
  ConversationAttributes,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { getConversationController } from '../../../../session/conversations';
import { UserUtils } from '../../../../session/utils';
import { SessionUtilUserProfile } from '../../../../session/utils/libsession/libsession_utils_user_profile';
import { TestUtils } from '../../../test-utils';
import { stubWindowLog } from '../../../test-utils/utils';

describe('libsession_user_profile', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = TestUtils.generateFakePubKeyStr();
  const validArgs = {
    id: ourNumber,
    type: ConversationTypeEnum.PRIVATE,
    isApproved: true,
    active_at: 123,
    didApproveMe: true,
  } as ConversationAttributes;

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    TestUtils.stubLibSessionWorker(undefined);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('isUserProfileToStoreInWrapper', () => {
    it('returns true if thats our convo', () => {
      expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(ourNumber)).to.be.true;
    });

    it('returns false if thats NOT our convo', () => {
      const notUs = TestUtils.generateFakePubKeyStr();
      expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(notUs)).to.be.false;
    });
  });

  describe('insertUserProfileIntoWrapper', () => {
    const contactArgs = {
      displayNameInProfile: 'Tester',
      nickname: 'Testie',
      avatarPointer: 'http://filev2.abcdef.com/file/abcdefghijklmnop',
      profileKey: 'profileKey',
      isBlocked: () => false,
      expirationMode: 'off',
      expireTimer: 0,
    };

    it('returns wrapper values that match with the inputted user profile', async () => {
      const contact = new ConversationModel({
        ...validArgs,
        ...contactArgs,
      } as ConversationAttributes);
      Sinon.stub(getConversationController(), 'get').returns(contact);
      Sinon.stub(SessionUtilUserProfile, 'isUserProfileToStoreInWrapper').returns(true);

      const wrapperUserProfile =
        await SessionUtilUserProfile.insertUserProfileIntoWrapper(ourNumber);

      expect(wrapperUserProfile, 'something should be returned from the wrapper').to.not.be.null;
      if (!wrapperUserProfile) {
        throw Error('something should be returned from the wrapper');
      }

      expect(
        wrapperUserProfile.id,
        'id in the wrapper should match the inputted user profile'
      ).to.equal(contact.id);
      expect(
        wrapperUserProfile.name,
        'name in the wrapper should match the inputted user profile'
      ).to.equal(contact.get('displayNameInProfile'));
      expect(
        wrapperUserProfile.priority,
        'priority in the wrapper should match the inputted user profile'
      ).to.equal(contact.get('priority'));
      expect(
        wrapperUserProfile.avatarPointer,
        'avatarPointer in the wrapper should match the inputted user profile'
      ).to.equal(contact.get('avatarPointer'));
      expect(
        wrapperUserProfile.expirySeconds,
        'expirySeconds in the wrapper should match the inputted user profile'
      ).to.equal(contact.getExpireTimer());
    });
    it("returns an error if the inputted user profile isn't our conversation", async () => {
      const contact = new ConversationModel({
        ...validArgs,
        ...contactArgs,
        id: TestUtils.generateFakePubKeyStr(),
      } as ConversationAttributes);
      Sinon.stub(getConversationController(), 'get').returns(contact);
      Sinon.stub(SessionUtilUserProfile, 'isUserProfileToStoreInWrapper').returns(true);

      try {
        await SessionUtilUserProfile.insertUserProfileIntoWrapper(ourNumber);
      } catch (err) {
        expect(err.message).to.equal('insertUserProfileIntoWrapper needs a ourConvo to exist');
      }
    });
    it('if disappearing messages is on then the wrapper returned values should match the inputted user profile', async () => {
      const contact = new ConversationModel({
        ...validArgs,
        ...contactArgs,
        expirationMode: 'deleteAfterSend',
        expireTimer: 300,
        id: ourNumber,
      });
      Sinon.stub(getConversationController(), 'get').returns(contact);
      Sinon.stub(SessionUtilUserProfile, 'isUserProfileToStoreInWrapper').returns(true);

      const wrapperUserProfile =
        await SessionUtilUserProfile.insertUserProfileIntoWrapper(ourNumber);

      expect(wrapperUserProfile, 'something should be returned from the wrapper').to.not.be.null;
      if (!wrapperUserProfile) {
        throw Error('something should be returned from the wrapper');
      }

      expect(
        wrapperUserProfile.expirySeconds,
        'expirySeconds in the wrapper should match the inputted user profile expireTimer'
      ).to.equal(contact.getExpireTimer());
    });
  });
});
