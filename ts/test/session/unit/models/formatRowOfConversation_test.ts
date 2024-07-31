import { expect } from 'chai';
import { describe } from 'mocha';
import {
  ConversationAttributes,
  fillConvoAttributesWithDefaults,
} from '../../../../models/conversationAttributes';
import { formatRowOfConversation } from '../../../../node/database_utility';
import { ConversationTypeEnum } from '../../../../models/types';

describe('formatRowOfConversation', () => {
  describe('isTrustedForAttachmentDownload', () => {
    it('initialize isTrustedForAttachmentDownload if they are not given', () => {
      expect(formatRowOfConversation({}, 'test', 0, false)).to.have.deep.property(
        'isTrustedForAttachmentDownload',
        false
      );
    });

    it('do not override isTrustedForAttachmentDownload if they are set in the row as integer: true', () => {
      expect(
        formatRowOfConversation({ isTrustedForAttachmentDownload: 1 }, 'test', 0, false)
      ).to.have.deep.property('isTrustedForAttachmentDownload', true);
    });

    it('do not override isTrustedForAttachmentDownload if they are set in the row as integer: false', () => {
      expect(
        formatRowOfConversation({ isTrustedForAttachmentDownload: 0 }, 'test', 0, false)
      ).to.have.deep.property('isTrustedForAttachmentDownload', false);
    });
  });

  describe('isApproved', () => {
    it('initialize isApproved if they are not given', () => {
      expect(formatRowOfConversation({}, 'test', 0, false)).to.have.deep.property(
        'isApproved',
        false
      );
    });

    it('do not override isApproved if they are set in the row as integer: true', () => {
      expect(formatRowOfConversation({ isApproved: 1 }, 'test', 0, false)).to.have.deep.property(
        'isApproved',
        true
      );
    });

    it('do not override isApproved if they are set in the row as integer: false', () => {
      expect(formatRowOfConversation({ isApproved: 0 }, 'test', 0, false)).to.have.deep.property(
        'isApproved',
        false
      );
    });
  });

  describe('didApproveMe', () => {
    it('initialize didApproveMe if they are not given', () => {
      expect(formatRowOfConversation({}, 'test', 0, false)).to.have.deep.property(
        'didApproveMe',
        false
      );
    });

    it('do not override didApproveMe if they are set in the row as integer: true', () => {
      expect(formatRowOfConversation({ didApproveMe: 1 }, 'test', 0, false)).to.have.deep.property(
        'didApproveMe',
        true
      );
    });

    it('do not override didApproveMe if they are set in the row as integer: false', () => {
      expect(formatRowOfConversation({ didApproveMe: 0 }, 'test', 0, false)).to.have.deep.property(
        'didApproveMe',
        false
      );
    });
  });

  describe('isKickedFromGroup', () => {
    it('initialize isKickedFromGroup if they are not given', () => {
      expect(formatRowOfConversation({}, 'test', 0, false)).to.have.deep.property(
        'isKickedFromGroup',
        false
      );
    });

    it('do not override isKickedFromGroup if they are set in the row as integer: true', () => {
      expect(
        formatRowOfConversation({ isKickedFromGroup: 1 }, 'test', 0, false)
      ).to.have.deep.property('isKickedFromGroup', true);
    });

    it('do not override isKickedFromGroup if they are set in the row as integer: false', () => {
      expect(
        formatRowOfConversation({ isKickedFromGroup: 0 }, 'test', 0, false)
      ).to.have.deep.property('isKickedFromGroup', false);
    });
  });

  describe('left', () => {
    it('initialize left if they are not given', () => {
      expect(formatRowOfConversation({}, 'test', 0, false)).to.have.deep.property('left', false);
    });

    it('do not override left if they are set in the row as integer: true', () => {
      expect(formatRowOfConversation({ left: 1 }, 'test', 0, false)).to.have.deep.property(
        'left',
        true
      );
    });

    it('do not override left if they are set in the row as integer: false', () => {
      expect(formatRowOfConversation({ left: 0 }, 'test', 0, false)).to.have.deep.property(
        'left',
        false
      );
    });
  });

  describe('row', () => {
    it('row null returns null', () => {
      expect(formatRowOfConversation(null as any, 'test', 0, false)).to.be.equal(
        null,
        'formatRowOfConversation with null should return null'
      );
    });

    it('row undefined returns null', () => {
      expect(formatRowOfConversation(undefined as any, 'test', 0, false)).to.be.equal(
        null,
        'formatRowOfConversation with undefined should return null'
      );
    });
  });

  describe('groupAdmins', () => {
    it('groupAdmins undefined fills it with []', () => {
      expect(
        formatRowOfConversation({ groupAdmins: undefined }, 'test', 0, false)
      ).to.be.have.deep.property('groupAdmins', []);
    });

    it('groupAdmins null fills it with []', () => {
      expect(
        formatRowOfConversation({ groupAdmins: null }, 'test', 0, false)
      ).to.be.have.deep.property('groupAdmins', []);
    });

    it('groupAdmins [] fills it with []', () => {
      expect(
        formatRowOfConversation({ groupAdmins: '[]' }, 'test', 0, false)
      ).to.be.have.deep.property('groupAdmins', []);
    });

    it('groupAdmins ["12345"] from db as string', () => {
      expect(
        formatRowOfConversation({ groupAdmins: '["12345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('groupAdmins', ['12345']);
    });

    it('groupAdmins ["12345", "52345"] fills it with []', () => {
      expect(
        formatRowOfConversation({ groupAdmins: '["12345", "52345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('groupAdmins', ['12345', '52345']);
    });
  });

  describe('members', () => {
    it('members undefined fills it with []', () => {
      expect(
        formatRowOfConversation({ members: undefined }, 'test', 0, false)
      ).to.be.have.deep.property('members', []);
    });

    it('members null fills it with []', () => {
      expect(formatRowOfConversation({ members: null }, 'test', 0, false)).to.be.have.deep.property(
        'members',
        []
      );
    });

    it('members [] fills it with []', () => {
      expect(formatRowOfConversation({ members: '[]' }, 'test', 0, false)).to.be.have.deep.property(
        'members',
        []
      );
    });

    it('members ["12345"] from db as string', () => {
      expect(
        formatRowOfConversation({ members: '["12345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('members', ['12345']);
    });

    it('members ["12345", "52345"] fills it with []', () => {
      expect(
        formatRowOfConversation({ members: '["12345", "52345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('members', ['12345', '52345']);
    });
  });

  describe('zombies', () => {
    it('zombies undefined fills it with []', () => {
      expect(
        formatRowOfConversation({ zombies: undefined }, 'test', 0, false)
      ).to.be.have.deep.property('zombies', []);
    });

    it('zombies null fills it with []', () => {
      expect(formatRowOfConversation({ zombies: null }, 'test', 0, false)).to.be.have.deep.property(
        'zombies',
        []
      );
    });

    it('zombies [] fills it with []', () => {
      expect(formatRowOfConversation({ zombies: '[]' }, 'test', 0, false)).to.be.have.deep.property(
        'zombies',
        []
      );
    });

    it('zombies ["12345"] from db as string', () => {
      expect(
        formatRowOfConversation({ zombies: '["12345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('zombies', ['12345']);
    });

    it('zombies ["12345", "52345"] fills it with ["12345", "52345"]', () => {
      expect(
        formatRowOfConversation({ zombies: '["12345", "52345"]' }, 'test', 0, false)
      ).to.be.have.deep.property('zombies', ['12345', '52345']);
    });
  });

  it('throws an error if a key is not expected', () => {
    expect(() => formatRowOfConversation({ not_valid: undefined }, 'test', 0, false)).throws(
      'formatRowOfConversation: an invalid key was given in the record: not_valid'
    );
  });

  it('throws an error if a key is not expected but has other valid keys', () => {
    expect(() =>
      formatRowOfConversation(
        { triggerNotificationsFor: 'all', not_valid: undefined },
        'test',
        0,
        false
      )
    ).throws('formatRowOfConversation: an invalid key was given in the record: not_valid');
  });

  it('a field with default ConversationModel attributes does not throw', () => {
    expect(
      formatRowOfConversation(
        fillConvoAttributesWithDefaults({
          id: '123456',
          type: ConversationTypeEnum.GROUP,
          nickname: 'nickname',
          displayNameInProfile: 'displayNameInProfile',
          profileKey: '',
          avatarPointer: 'avatarPointer',
          avatarInProfile: 'avatarInProfile',
          avatarImageId: 1234,
        } as ConversationAttributes),
        'test',
        0,
        false
      )
    ).have.deep.property('displayNameInProfile', 'displayNameInProfile');

    expect(
      formatRowOfConversation(
        fillConvoAttributesWithDefaults({
          id: '1234565',
          type: ConversationTypeEnum.GROUPV3,
          nickname: 'nickname',
          displayNameInProfile: 'displayNameInProfile',
          profileKey: '',
          avatarPointer: 'avatarPointer',
          avatarInProfile: 'avatarInProfile',
          avatarImageId: 1234,
        } as ConversationAttributes),
        'test',
        0,
        false
      )
    ).have.deep.property('displayNameInProfile', 'displayNameInProfile');
  });
});
