import { expect } from 'chai';

import Sinon from 'sinon';
import { ConversationModel } from '../../../../models/conversation';
import { ConversationAttributes } from '../../../../models/conversationAttributes';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { getConversationController } from '../../../../session/conversations';
import { UserUtils } from '../../../../session/utils';
import { SessionUtilContact } from '../../../../session/utils/libsession/libsession_utils_contacts';
import { TestUtils } from '../../../test-utils';
import { stubWindowLog } from '../../../test-utils/utils/stubbing';
import { ConversationTypeEnum, CONVERSATION_PRIORITIES } from '../../../../models/types';

describe('libsession_contacts', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = '051234567890acbdef';
  const validArgs = {
    // NOTE we hardcode this key to make testing easier for bad whitespaces
    id: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
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

  describe('isContactToStoreInWrapper', () => {
    it('excludes ourselves', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, id: ourNumber })
        )
      ).to.be.eq(false);
    });

    it('excludes non private', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, type: ConversationTypeEnum.GROUP })
        )
      ).to.be.eq(false);
    });

    it('includes private', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, type: ConversationTypeEnum.PRIVATE })
        )
      ).to.be.eq(true);
    });

    it('includes hidden private', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            type: ConversationTypeEnum.PRIVATE,
            priority: CONVERSATION_PRIORITIES.hidden,
          })
        )
      ).to.be.eq(true);
    });

    it('excludes blinded', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            type: ConversationTypeEnum.PRIVATE,
            id: '1511111111111',
          })
        )
      ).to.be.eq(false);
    });

    it('excludes hidden but not active', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            type: ConversationTypeEnum.PRIVATE,
            priority: CONVERSATION_PRIORITIES.hidden,
            active_at: 0,
          })
        )
      ).to.be.eq(false);
    });

    it('excludes non approved by us nor did approveMe and not active', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: false,
            isApproved: false,
            active_at: undefined,
          } as any)
        )
      ).to.be.eq(false);
    });

    it('includes non approved by us nor did approveMe but active', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: false,
            isApproved: false,
          })
        )
      ).to.be.eq(true);
    });

    it('includes approved only by us ', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: false,
            isApproved: true,
          })
        )
      ).to.be.eq(true);
    });

    it('excludes not active ', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: false,
            isApproved: true,
            active_at: undefined,
          } as any)
        )
      ).to.be.eq(false);
    });

    it('excludes contacts not matching a pubkey syntax (space in middle)', () => {
      const validIdWithSpaceInIt =
        '050123456789abcdef050123456789 bcdef0123456789abcdef050123456789ab'; // len 66 but has a ' ' in the middle
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            id: validIdWithSpaceInIt,
          })
        )
      ).to.be.eq(false);
    });

    it('excludes contacts not matching a pubkey syntax (space at the end)', () => {
      const validIdWithSpaceInIt =
        '050123456789abcdef050123456789abcdef0123456789abcdef050123456789a '; // len 66 but has a ' ' at the end
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            id: validIdWithSpaceInIt,
          })
        )
      ).to.be.eq(false);
    });

    it('excludes contacts not matching a pubkey syntax (space at the start)', () => {
      const validIdWithSpaceInIt =
        ' 050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab'; // len 66 but has a ' ' at the start
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            id: validIdWithSpaceInIt,
          })
        )
      ).to.be.eq(false);
    });

    it('excludes contacts not matching a pubkey syntax (non hex char)', () => {
      const validIdWithSpaceInIt =
        '050123456789abcdef050123456789abcdef0123456789abcdef050123456789aU'; // len 66 but has 'U' at the end
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            id: validIdWithSpaceInIt,
          })
        )
      ).to.be.eq(false);
    });

    it('includes approved only by them ', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: true,
            isApproved: false,
          })
        )
      ).to.be.eq(true);
    });
  });

  describe('insertContactFromDBIntoWrapperAndRefresh', () => {
    const contactArgs = {
      displayNameInProfile: 'Tester',
      nickname: 'Testie',
      avatarPointer: 'http://filev2.abcdef.com/file/abcdefghijklmnop',
      profileKey: 'profileKey',
      isBlocked: () => false,
      expirationMode: 'off',
      expireTimer: 0,
    };

    it('returns wrapper values that match with the inputted contact', async () => {
      const contact = new ConversationModel({
        ...validArgs,
        ...contactArgs,
      } as ConversationAttributes);
      Sinon.stub(getConversationController(), 'get').returns(contact);
      Sinon.stub(SessionUtilContact, 'isContactToStoreInWrapper').returns(true);

      const wrapperContact = await SessionUtilContact.insertContactFromDBIntoWrapperAndRefresh(
        contact.get('id')
      );

      expect(wrapperContact, 'something should be returned from the wrapper').to.not.be.null;
      if (!wrapperContact) {
        throw Error('something should be returned from the wrapper');
      }

      expect(wrapperContact.id, 'id in the wrapper should match the inputted contact').to.equal(
        contact.id
      );
      expect(
        wrapperContact.approved,
        'approved in the wrapper should match the inputted contact'
      ).to.equal(contact.isApproved());
      expect(
        wrapperContact.approvedMe,
        'approvedMe in the wrapper should match the inputted contact'
      ).to.equal(contact.didApproveMe());
      expect(
        wrapperContact.blocked,
        'blocked in the wrapper should match the inputted contact'
      ).to.equal(contact.isBlocked());
      expect(
        wrapperContact.priority,
        'priority in the wrapper should match the inputted contact'
      ).to.equal(contact.get('priority'));
      expect(
        wrapperContact.nickname,
        'nickname in the wrapper should match the inputted contact'
      ).to.equal(contact.get('nickname'));
      expect(wrapperContact.name, 'name in the wrapper should match the inputted contact').to.equal(
        contact.get('displayNameInProfile')
      );
      expect(
        wrapperContact.expirationMode,
        'expirationMode in the wrapper should match the inputted contact'
      ).to.equal(contact.getExpirationMode());
      expect(
        wrapperContact.expirationTimerSeconds,
        'expirationTimerSeconds in the wrapper should match the inputted contact'
      ).to.equal(contact.getExpireTimer());
    });
    it('if disappearing messages is on then the wrapper returned values should match the inputted contact', async () => {
      const contact = new ConversationModel({
        ...validArgs,
        ...contactArgs,
        expirationMode: 'deleteAfterSend',
        expireTimer: 300,
      });
      Sinon.stub(getConversationController(), 'get').returns(contact);
      Sinon.stub(SessionUtilContact, 'isContactToStoreInWrapper').returns(true);

      const wrapperContact = await SessionUtilContact.insertContactFromDBIntoWrapperAndRefresh(
        contact.get('id')
      );

      expect(wrapperContact, 'something should be returned from the wrapper').to.not.be.null;
      if (!wrapperContact) {
        throw Error('something should be returned from the wrapper');
      }

      expect(
        wrapperContact.expirationMode,
        'expirationMode in the wrapper should match the inputted contact'
      ).to.equal(contact.getExpirationMode());
      expect(
        wrapperContact.expirationTimerSeconds,
        'expirationTimerSeconds in the wrapper should match the inputted contact expireTimer'
      ).to.equal(contact.getExpireTimer());
    });
  });
});
