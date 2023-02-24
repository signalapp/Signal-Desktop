import { expect } from 'chai';

import Sinon from 'sinon';
import { ConversationModel } from '../../../../models/conversation';
import { ConversationTypeEnum } from '../../../../models/conversationAttributes';
import { UserUtils } from '../../../../session/utils';
import { SessionUtilUserGroups } from '../../../../session/utils/libsession/libsession_utils_user_groups';

// tslint:disable: chai-vague-errors no-unused-expression no-http-string no-octal-literal whitespace no-require-imports variable-name
// import * as SessionUtilWrapper from 'session_util_wrapper';

// tslint:disable-next-line: max-func-body-length
describe('libsession_groups', () => {
  describe('filter user groups for wrapper', () => {
    const ourNumber = '051234567890acbdef';
    const validArgs = {
      id: 'http://example.org/roomId1234',
      type: ConversationTypeEnum.GROUP,
      active_at: 1234,
    };
    beforeEach(() => {
      Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    });
    afterEach(() => {
      Sinon.restore();
    });

    it('includes public group/community', () => {
      expect(
        SessionUtilUserGroups.filterUserGroupsToStoreInWrapper(
          new ConversationModel({ ...validArgs } as any)
        )
      ).to.be.eq(true);
    });

    it('excludes public group/community inactive', () => {
      expect(
        SessionUtilUserGroups.filterUserGroupsToStoreInWrapper(
          new ConversationModel({ ...validArgs, active_at: undefined } as any)
        )
      ).to.be.eq(false);
    });

    it('includes closed group', () => {
      expect(
        SessionUtilUserGroups.filterUserGroupsToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            type: ConversationTypeEnum.GROUP,
            id: '05123456564',
          } as any)
        )
      ).to.be.eq(true);
    });

    it('includes closed group v3', () => {
      expect(
        SessionUtilUserGroups.filterUserGroupsToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            type: ConversationTypeEnum.GROUPV3,
            id: '03123456564',
          } as any)
        )
      ).to.be.eq(true);
    });

    it('excludes private', () => {
      expect(
        SessionUtilUserGroups.filterUserGroupsToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            id: '0511111',
            type: ConversationTypeEnum.PRIVATE,
          } as any)
        )
      ).to.be.eq(false);
    });
  });
});
