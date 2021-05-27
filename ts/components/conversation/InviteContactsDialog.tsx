import React from 'react';

import { SessionModal } from '../session/SessionModal';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { ContactType, SessionMemberListItem } from '../session/SessionMemberListItem';
import { DefaultTheme } from 'styled-components';
import { ConversationController } from '../../session/conversations';
import { ToastUtils, UserUtils } from '../../session/utils';
import { initiateGroupUpdate } from '../../session/group';
import { ConversationModel, ConversationTypeEnum } from '../../models/conversation';
import { getCompleteUrlForV2ConvoId } from '../../interactions/conversation';
import _ from 'lodash';
import autoBind from 'auto-bind';
import { VALIDATION } from '../../session/constants';
interface Props {
  contactList: Array<any>;
  chatName: string;
  onClose: any;
  theme: DefaultTheme;
  convo: ConversationModel;
}

interface State {
  contactList: Array<ContactType>;
}

class InviteContactsDialogInner extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    autoBind(this);

    let contacts = this.props.contactList;

    contacts = contacts.map(d => {
      const lokiProfile = d.getLokiProfile();
      const nickname = d.getNickname();
      const name = nickname
        ? nickname
        : lokiProfile
        ? lokiProfile.displayName
        : window.i18n('anonymous');

      // TODO: should take existing members into account
      const existingMember = false;

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        authorAvatarPath: d?.getAvatarPath(),
        selected: false,
        authorName: name,
        checkmarked: false,
        existingMember,
      };
    });

    this.state = {
      contactList: contacts,
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const titleText = `${window.i18n('addingContacts')} ${this.props.chatName}`;
    const cancelText = window.i18n('cancel');
    const okText = window.i18n('ok');

    const hasContacts = this.state.contactList.length !== 0;

    return (
      <SessionModal title={titleText} onClose={this.closeDialog} theme={this.props.theme}>
        <div className="spacer-lg" />

        <div className="contact-selection-list">{this.renderMemberList()}</div>
        {hasContacts ? null : (
          <>
            <div className="spacer-lg" />
            <p className="no-contacts">{window.i18n('noContactsToAdd')}</p>
            <div className="spacer-lg" />
          </>
        )}

        <div className="spacer-lg" />

        <div className="session-modal__button-group">
          <SessionButton text={cancelText} onClick={this.closeDialog} />
          <SessionButton
            text={okText}
            disabled={!hasContacts}
            onClick={this.onClickOK}
            buttonColor={SessionButtonColor.Green}
          />
        </div>
      </SessionModal>
    );
  }

  private async submitForOpenGroup(pubkeys: Array<string>) {
    const { convo } = this.props;
    if (convo.isOpenGroupV1()) {
      const v1 = convo.toOpenGroupV1();
      const groupInvitation = {
        serverAddress: v1.server,
        serverName: convo.getName(),
        channelId: 1, // always 1
      };
      pubkeys.forEach(async pubkeyStr => {
        const privateConvo = await ConversationController.getInstance().getOrCreateAndWait(
          pubkeyStr,
          ConversationTypeEnum.PRIVATE
        );

        if (privateConvo) {
          void privateConvo.sendMessage('', null, null, null, groupInvitation);
        }
      });
    } else if (convo.isOpenGroupV2()) {
      const v2 = convo.toOpenGroupV2();
      const completeUrl = await getCompleteUrlForV2ConvoId(convo.id);
      const groupInvitation = {
        serverAddress: completeUrl,
        serverName: convo.getName(),
      };
      pubkeys.forEach(async pubkeyStr => {
        const privateConvo = await ConversationController.getInstance().getOrCreateAndWait(
          pubkeyStr,
          ConversationTypeEnum.PRIVATE
        );

        if (privateConvo) {
          void privateConvo.sendMessage('', null, null, null, groupInvitation);
        }
      });
    }
  }

  private async submitForClosedGroup(pubkeys: Array<string>) {
    const { convo } = this.props;

    // closed group chats
    const ourPK = UserUtils.getOurPubKeyStrFromCache();
    // we only care about real members. If a member is currently a zombie we have to be able to add him back
    let existingMembers = convo.get('members') || [];
    // at least make sure it's an array
    if (!Array.isArray(existingMembers)) {
      existingMembers = [];
    }
    existingMembers = _.compact(existingMembers);
    const existingZombies = convo.get('zombies') || [];
    const newMembers = pubkeys.filter(d => !existingMembers.includes(d));

    if (newMembers.length > 0) {
      // Do not trigger an update if there is too many members
      // be sure to include current zombies in this count
      if (
        newMembers.length + existingMembers.length + existingZombies.length >
        VALIDATION.CLOSED_GROUP_SIZE_LIMIT
      ) {
        ToastUtils.pushTooManyMembers();
        return;
      }

      const allMembers = _.concat(existingMembers, newMembers, [ourPK]);
      const uniqMembers = _.uniq(allMembers);

      const groupId = convo.get('id');
      const groupName = convo.get('name');

      await initiateGroupUpdate(
        groupId,
        groupName || window.i18n('unknown'),
        uniqMembers,
        undefined
      );
    }
  }

  private onClickOK() {
    const selectedContacts = this.state.contactList.filter(d => d.checkmarked).map(d => d.id);

    if (selectedContacts.length > 0) {
      if (this.props.convo.isPublic()) {
        void this.submitForOpenGroup(selectedContacts);
      } else {
        void this.submitForClosedGroup(selectedContacts);
      }
    }

    this.closeDialog();
  }

  private renderMemberList() {
    const members = this.state.contactList;
    const selectedContacts = this.state.contactList.filter(d => d.checkmarked).map(d => d.id);

    return members.map((member: ContactType, index: number) => (
      <SessionMemberListItem
        member={member}
        key={index}
        index={index}
        isSelected={selectedContacts.some(m => m === member.id)}
        onSelect={(selectedMember: ContactType) => {
          this.onMemberClicked(selectedMember);
        }}
        onUnselect={(selectedMember: ContactType) => {
          this.onMemberClicked(selectedMember);
        }}
        theme={this.props.theme}
      />
    ));
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.onClickOK();
        break;
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private onMemberClicked(clickedMember: ContactType) {
    const updatedContacts = this.state.contactList.map(member => {
      if (member.id === clickedMember.id) {
        return { ...member, checkmarked: !member.checkmarked };
      } else {
        return member;
      }
    });

    this.setState(state => {
      return {
        ...state,
        contactList: updatedContacts,
      };
    });
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.props.onClose();
  }
}

export const InviteContactsDialog = InviteContactsDialogInner;
