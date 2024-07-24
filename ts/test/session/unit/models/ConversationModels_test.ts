import { expect } from 'chai';
import { describe } from 'mocha';
import {
  ConversationAttributes,
  fillConvoAttributesWithDefaults,
} from '../../../../models/conversationAttributes';
import { CONVERSATION_PRIORITIES } from '../../../../models/types';

describe('fillConvoAttributesWithDefaults', () => {
  describe('members', () => {
    it('initialize members if they are not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'members',
        []
      );
    });

    it('do not override members if they are  given', () => {
      expect(
        fillConvoAttributesWithDefaults({ members: ['123'] } as ConversationAttributes)
      ).to.have.deep.property('members', ['123']);
    });
  });

  describe('zombies', () => {
    it('initialize zombies if they are not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'zombies',
        []
      );
    });

    it('do not override zombies if they are  given', () => {
      expect(
        fillConvoAttributesWithDefaults({ zombies: ['123'] } as ConversationAttributes)
      ).to.have.deep.property('zombies', ['123']);
    });
  });

  describe('groupAdmins', () => {
    it('initialize groupAdmins if they are not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'groupAdmins',
        []
      );
    });

    it('do not override groupAdmins if they are  given', () => {
      expect(
        fillConvoAttributesWithDefaults({ groupAdmins: ['123'] } as ConversationAttributes)
      ).to.have.deep.property('groupAdmins', ['123']);
    });
  });

  // describe('unreadCount', () => {
  //   it('initialize unreadCount if not given', () => {
  //     expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
  //       'unreadCount',
  //       0
  //     );
  //   });

  //   it('do not override unreadCount if given', () => {
  //     expect(
  //       fillConvoAttributesWithDefaults({ unreadCount: 123 } as ConversationAttributes)
  //     ).to.have.deep.property('unreadCount', 123);
  //   });
  // });

  describe('lastJoinedTimestamp', () => {
    it('initialize lastJoinedTimestamp if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'lastJoinedTimestamp',
        0
      );
    });

    it('do not override lastJoinedTimestamp if given', () => {
      expect(
        fillConvoAttributesWithDefaults({ lastJoinedTimestamp: 123 } as ConversationAttributes)
      ).to.have.deep.property('lastJoinedTimestamp', 123);
    });
  });

  describe('expireTimer', () => {
    it('initialize expireTimer if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'expireTimer',
        0
      );
    });

    it('do not override expireTimer if given', () => {
      expect(
        fillConvoAttributesWithDefaults({ expireTimer: 123 } as ConversationAttributes)
      ).to.have.deep.property('expireTimer', 123);
    });
  });

  describe('active_at', () => {
    it('initialize active_at if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'active_at',
        0
      );
    });

    it('do not override active_at if given', () => {
      expect(
        fillConvoAttributesWithDefaults({ active_at: 123 } as ConversationAttributes)
      ).to.have.deep.property('active_at', 123);
    });
  });

  describe('lastMessageStatus', () => {
    it('initialize lastMessageStatus if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'lastMessageStatus',
        undefined
      );
    });

    it('do not override lastMessageStatus if given', () => {
      expect(
        fillConvoAttributesWithDefaults({ lastMessageStatus: 'read' } as ConversationAttributes)
      ).to.have.deep.property('lastMessageStatus', 'read');
    });
  });

  describe('lastMessage', () => {
    it('initialize lastMessage if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'lastMessage',
        null
      );
    });

    it('do not override lastMessage if given', () => {
      expect(
        fillConvoAttributesWithDefaults({ lastMessage: 'whatever' } as ConversationAttributes)
      ).to.have.deep.property('lastMessage', 'whatever');
    });
  });

  describe('triggerNotificationsFor', () => {
    it('initialize triggerNotificationsFor if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'triggerNotificationsFor',
        'all'
      );
    });

    it('do not override triggerNotificationsFor if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          triggerNotificationsFor: 'disabled',
        } as ConversationAttributes)
      ).to.have.deep.property('triggerNotificationsFor', 'disabled');
    });
  });

  describe('isTrustedForAttachmentDownload', () => {
    it('initialize isTrustedForAttachmentDownload if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'isTrustedForAttachmentDownload',
        false
      );
    });

    it('do not override isTrustedForAttachmentDownload if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          isTrustedForAttachmentDownload: true,
        } as ConversationAttributes)
      ).to.have.deep.property('isTrustedForAttachmentDownload', true);
    });
  });

  describe('priority', () => {
    it('initialize priority if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'priority',
        0
      );
    });

    it('do not override priority if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          priority: CONVERSATION_PRIORITIES.pinned,
        } as ConversationAttributes)
      ).to.have.deep.property('priority', 1);
    });
  });

  describe('isApproved', () => {
    it('initialize isApproved if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'isApproved',
        false
      );
    });

    it('do not override isApproved if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          isApproved: true,
        } as ConversationAttributes)
      ).to.have.deep.property('isApproved', true);
    });
  });

  describe('didApproveMe', () => {
    it('initialize didApproveMe if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'didApproveMe',
        false
      );
    });

    it('do not override didApproveMe if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          didApproveMe: true,
        } as ConversationAttributes)
      ).to.have.deep.property('didApproveMe', true);
    });
  });

  describe('isKickedFromGroup', () => {
    it('initialize isKickedFromGroup if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'isKickedFromGroup',
        false
      );
    });

    it('do not override isKickedFromGroup if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          isKickedFromGroup: true,
        } as ConversationAttributes)
      ).to.have.deep.property('isKickedFromGroup', true);
    });
  });

  describe('left', () => {
    it('initialize left if not given', () => {
      expect(fillConvoAttributesWithDefaults({} as ConversationAttributes)).to.have.deep.property(
        'left',
        false
      );
    });

    it('do not override left if given', () => {
      expect(
        fillConvoAttributesWithDefaults({
          left: true,
        } as ConversationAttributes)
      ).to.have.deep.property('left', true);
    });
  });
});
