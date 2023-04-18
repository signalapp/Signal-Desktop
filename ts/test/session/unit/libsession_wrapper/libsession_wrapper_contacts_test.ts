import { expect } from 'chai';

import Sinon from 'sinon';
import { ConversationModel } from '../../../../models/conversation';
import {
  CONVERSATION_PRIORITIES,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';
import { UserUtils } from '../../../../session/utils';
import { SessionUtilContact } from '../../../../session/utils/libsession/libsession_utils_contacts';

// tslint:disable: chai-vague-errors no-unused-expression no-http-string no-octal-literal whitespace no-require-imports variable-name
// import * as SessionUtilWrapper from 'session_util_wrapper';

// tslint:disable-next-line: max-func-body-length
describe('libsession_contacts', () => {
  // Note: To run this test, you need to compile the libsession wrapper for node (and not for electron).
  // To do this, you can cd to the node_module/libsession_wrapper folder and do
  // yarn configure && yarn build
  // once that is done, you can rename this file and remove the _skip suffix so that test is run.

  // We have to disable it by filename as nodejs tries to load the module during the import step above, and fails as it is not compiled for nodejs but for electron.

  describe('filter contacts for wrapper', () => {
    const ourNumber = '051234567890acbdef';
    const validArgs = {
      id: '051111567890acbdef',
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
