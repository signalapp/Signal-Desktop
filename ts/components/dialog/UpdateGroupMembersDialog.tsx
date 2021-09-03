import React from 'react';
import classNames from 'classnames';

import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { ContactType, SessionMemberListItem } from '../session/SessionMemberListItem';
import { ToastUtils, UserUtils } from '../../session/utils';
import autoBind from 'auto-bind';
import { getConversationController } from '../../session/conversations';

import _ from 'lodash';
import { SpacerLG, SpacerMD, Text } from '../basic/Text';
import { SessionWrapperModal } from '../session/SessionWrapperModal';
import { ConversationModel } from '../../models/conversation';
import { updateGroupMembersModal } from '../../state/ducks/modalDialog';
import { ClosedGroup } from '../../session';

type Props = {
  conversationId: string;
};

interface State {
  contactList: Array<ContactType>;
  zombies: Array<ContactType>;
  errorDisplayed: boolean;
  errorMessage: string;
  admins: Array<string>;
  isAdmin: boolean;
}

export class UpdateGroupMembersDialog extends React.Component<Props, State> {
  private readonly convo: ConversationModel;

  constructor(props: Props) {
    super(props);

    autoBind(this);
    this.convo = getConversationController().get(props.conversationId);
    const admins = this.convo.get('groupAdmins') || [];
    const ourPK = UserUtils.getOurPubKeyStrFromCache();

    const isAdmin = this.convo.get('groupAdmins')?.includes(ourPK) ? true : false;

    const convos = getConversationController()
      .getConversations()
      .filter(d => !!d);

    const existingMembers = this.convo.get('members') || [];

    let contactList = convos.filter(
      d => existingMembers.includes(d.id) && d.isPrivate() && !d.isMe()
    );

    contactList = _.uniqBy(contactList, 'id');

    const contacts = contactList.map(d => {
      const lokiProfile = d.getLokiProfile();
      const nickname = d.getNickname();
      const name = nickname
        ? nickname
        : lokiProfile
        ? lokiProfile.displayName
        : window.i18n('anonymous');

      const existingMember = existingMembers.includes(d.id);

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        authorAvatarPath: d?.getAvatarPath() as string,
        selected: false,
        authorName: name, // different from ProfileName?
        checkmarked: false,
        existingMember,
      };
    });

    const existingZombies = this.convo.get('zombies') || [];

    const zombies = _.compact(
      existingZombies.map(d => {
        const zombieConvo = getConversationController().get(d);
        if (!zombieConvo) {
          window?.log?.warn('Zombie convo not found');
          return null;
        }
        const lokiProfile = zombieConvo.getLokiProfile();
        const name = lokiProfile ? lokiProfile.displayName : window.i18n('anonymous');

        const existingZombie = existingZombies.includes(zombieConvo.id);
        return {
          id: zombieConvo.id,
          authorPhoneNumber: zombieConvo.id,
          authorProfileName: name,
          authorAvatarPath: zombieConvo?.getAvatarPath() as string,
          selected: false,
          authorName: name,
          checkmarked: false,
          existingMember: existingZombie,
        };
      })
    );

    this.state = {
      contactList: contacts,
      zombies,
      errorDisplayed: false,
      errorMessage: '',
      admins,
      isAdmin,
    };
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const members = this.getWouldBeMembers(this.state.contactList).map(d => d.id);

    // do not include zombies here, they are removed by force
    void this.onSubmit(members);

    this.closeDialog();
  }

  public render() {
    const showNoMembersMessage = this.state.contactList.length === 0;

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    const okText = window.i18n('ok');
    const cancelText = window.i18n('cancel');
    const titleText = window.i18n('updateGroupDialogTitle', this.convo.getName());

    return (
      <SessionWrapperModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
      >
        <SpacerMD />

        <p className={errorMessageClasses}>{errorMsg}</p>
        <SpacerMD />

        <div className="group-member-list__selection">{this.renderMemberList()}</div>
        {this.renderZombiesList()}
        {showNoMembersMessage && <p>{window.i18n('noMembersInThisGroup')}</p>}

        <SpacerLG />

        <div className="session-modal__button-group">
          <SessionButton text={cancelText} onClick={this.closeDialog} />
          {this.state.isAdmin && (
            <SessionButton
              text={okText}
              onClick={this.onClickOK}
              buttonColor={SessionButtonColor.Green}
            />
          )}
        </div>
      </SessionWrapperModal>
    );
  }

  private renderMemberList() {
    return this.state.contactList.map((member: ContactType, index: number) => {
      const isSelected = this.state.isAdmin && !member.checkmarked;

      return (
        <SessionMemberListItem
          member={member}
          index={index}
          isSelected={isSelected}
          onSelect={this.onMemberClicked}
          onUnselect={this.onMemberClicked}
          key={member.id}
        />
      );
    });
  }

  private renderZombiesList() {
    const { zombies } = this.state;

    if (!zombies.length) {
      return <></>;
    }

    const zombieElements = zombies.map((member: ContactType, index: number) => {
      const isSelected = this.state.isAdmin && !member.checkmarked;
      return (
        <SessionMemberListItem
          member={member}
          index={index}
          isSelected={isSelected}
          onSelect={this.onZombieClicked}
          onUnselect={this.onZombieClicked}
          isZombie={true}
          key={member.id}
        />
      );
    });
    return (
      <>
        <SpacerLG />
        {this.state.isAdmin && (
          <Text
            padding="20px"
            text={window.i18n('removeResidueMembers')}
            subtle={true}
            maxWidth="400px"
            textAlign="center"
          />
        )}
        {zombieElements}
      </>
    );
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

  // Return members that would comprise the group given the
  // current state in `users`
  private getWouldBeMembers(users: Array<ContactType>) {
    return users.filter(d => {
      return (d.existingMember && !d.checkmarked) || (!d.existingMember && d.checkmarked);
    });
  }

  private closeDialog() {
    window.inboxStore?.dispatch(updateGroupMembersModal(null));
  }

  private onMemberClicked(selected: ContactType) {
    const { contactList } = this.state;
    if (!this.state.isAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }

    if (selected.existingMember && !this.state.isAdmin) {
      window?.log?.warn('Only group admin can remove members!');
      return;
    }

    if (selected.existingMember && this.state.admins.includes(selected.id)) {
      window?.log?.warn(
        `User ${selected.id} cannot be removed as they are the creator of the closed group.`
      );
      ToastUtils.pushCannotRemoveCreatorFromGroup();
      return;
    }

    const updatedContacts = contactList.map(member => {
      if (member.id === selected.id) {
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

  private onZombieClicked(_selected: ContactType) {
    if (!this.state.isAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }
  }

  private async onSubmit(newMembers: Array<string>) {
    const ourPK = UserUtils.getOurPubKeyStrFromCache();

    const allMembersAfterUpdate = _.concat(newMembers, [ourPK]);

    if (!this.state.isAdmin) {
      window.log.warn('Skipping update of members, we are not the admin');
      return;
    }
    // new members won't include the zombies. We are the admin and we want to remove them not matter what

    // We need to NOT trigger an group update if the list of member is the same.
    // we need to merge all members, including zombies for this call.

    // we consider that the admin ALWAYS wants to remove zombies (actually they should be removed
    // automatically by him when the LEFT message is received)
    const existingMembers = this.convo.get('members') || [];
    const existingZombies = this.convo.get('zombies') || [];

    const allExistingMembersWithZombies = _.uniq(existingMembers.concat(existingZombies));

    const notPresentInOld = allMembersAfterUpdate.filter(
      (m: string) => !allExistingMembersWithZombies.includes(m)
    );

    // be sure to include zombies in here
    const membersToRemove = allExistingMembersWithZombies.filter(
      (m: string) => !allMembersAfterUpdate.includes(m)
    );

    const xor = _.xor(membersToRemove, notPresentInOld);
    if (xor.length === 0) {
      window.log.info('skipping group update: no detected changes in group member list');

      return;
    }

    // If any extra devices of removed exist in newMembers, ensure that you filter them
    // Note: I think this is useless
    const filteredMembers = allMembersAfterUpdate.filter(
      (member: string) => !_.includes(membersToRemove, member)
    );

    const avatarPath = this.convo.getAvatarPath();
    const groupId = this.convo.id;
    const groupName = this.convo.getName();

    void ClosedGroup.initiateGroupUpdate(groupId, groupName, filteredMembers, avatarPath);
  }
}
