import { expect } from 'chai';

import Sinon from 'sinon';
import { ConversationModel } from '../../../../models/conversation';
import {
  CONVERSATION_PRIORITIES,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';
import { UserUtils } from '../../../../session/utils';
import { SessionUtilContact } from '../../../../session/utils/libsession/libsession_utils_contacts';

describe('libsession_contacts', () => {
  describe('filter contacts for wrapper', () => {
    const ourNumber = '051234567890acbdef';
    const validArgs = {
      id: '050123456789abcdef050123456789abcdef0123456789abcdef050123456789ab',
      type: ConversationTypeEnum.PRIVATE,
      isApproved: true,
      active_at: 123,
      didApproveMe: true,
    };
    beforeEach(() => {
      Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    });
    afterEach(() => {
      Sinon.restore();
    });

    it('excludes ourselves', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, id: ourNumber } as any)
        )
      ).to.be.eq(false);
    });

    it('excludes non private', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, type: ConversationTypeEnum.GROUP } as any)
        )
      ).to.be.eq(false);
    });

    it('includes private', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({ ...validArgs, type: ConversationTypeEnum.PRIVATE } as any)
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
          } as any)
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
          } as any)
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
          } as any)
        )
      ).to.be.eq(false);
    });

    it('excludes non approved by us nor did approveme and not active', () => {
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

    it('includes non approved by us nor did approveme but active', () => {
      expect(
        SessionUtilContact.isContactToStoreInWrapper(
          new ConversationModel({
            ...validArgs,
            didApproveMe: false,
            isApproved: false,
          } as any)
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
          } as any)
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
          } as any)
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
          } as any)
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
          } as any)
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
          } as any)
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
          } as any)
        )
      ).to.be.eq(true);
    });
  });
});
