/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';

import { SessionUtilUserProfile } from '../../../../session/utils/libsession/libsession_utils_user_profile';
import { UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

describe('libsession_wrapper', () => {
  afterEach(() => {
    Sinon.restore();
  });

  it('isUserProfileToStoreInWrapper returns true if thats our convo', () => {
    const us = TestUtils.generateFakePubKeyStr();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(us);
    expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(us)).to.be.true;
  });

  it('isUserProfileToStoreInWrapper returns false if thats NOT our convo', () => {
    const us = TestUtils.generateFakePubKeyStr();
    const notUs = TestUtils.generateFakePubKeyStr();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(us);
    expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(notUs)).to.be.false;
  });
});
