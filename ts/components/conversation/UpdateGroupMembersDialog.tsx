import React from 'react';
import classNames from 'classnames';

import { SessionModal } from '../session/SessionModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';
import { ContactType, SessionMemberListItem } from '../session/SessionMemberListItem';
import { DefaultTheme } from 'styled-components';
import { ToastUtils } from '../../session/utils';
import { LocalizerType } from '../../types/Util';
import autoBind from 'auto-bind';
import { ConversationController } from '../../session/conversations';

import _ from 'lodash';
import { Text } from '../basic/Text';

interface Props {
  titleText: string;
  okText: string;
  isPublic: boolean;
  cancelText: string;
  // contacts not in the group
  contactList: Array<any>;
  isAdmin: boolean;
  existingMembers: Array<string>;
  existingZombies: Array<string>;
  admins: Array<string>; // used for closed group

  i18n: LocalizerType;
  onSubmit: (membersLeft: Array<string>) => void;
  onClose: () => void;
  theme: DefaultTheme;
}

interface State {
  contactList: Array<ContactType>;
  zombies: Array<ContactType>;
  errorDisplayed: boolean;
  errorMessage: string;
}

export class UpdateGroupMembersDialog extends React.Component<Props, State> {
  constructor(props: Props) {
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

      const existingMember = this.props.existingMembers.includes(d.id);

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        authorAvatarPath: d?.getAvatarPath(),
        selected: false,
        authorName: name, // different from ProfileName?
        checkmarked: false,
        existingMember,
      };
    });

    const zombies = _.compact(
      this.props.existingZombies.map(d => {
        const convo = ConversationController.getInstance().get(d);
        if (!convo) {
          window?.log?.warn('Zombie convo not found');
          return null;
        }
        const lokiProfile = convo.getLokiProfile();
        const name = lokiProfile ? lokiProfile.displayName : window.i18n('anonymous');

        const existingZombie = this.props.existingZombies.includes(convo.id);
        return {
          id: convo.id,
          authorPhoneNumber: convo.id,
          authorProfileName: name,
          authorAvatarPath: convo?.getAvatarPath() as string,
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
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const members = this.getWouldBeMembers(this.state.contactList).map(d => d.id);

    // do not include zombies here, they are removed by force
    this.props.onSubmit(members);

    this.closeDialog();
  }

  public render() {
    const { okText, cancelText, isAdmin, contactList, titleText, existingZombies } = this.props;

    const showNoMembersMessage = contactList.length === 0;

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    const hasZombies = Boolean(existingZombies.length);

    return (
      <SessionModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
        theme={this.props.theme}
      >
        <div className="spacer-md" />

        <p className={errorMessageClasses}>{errorMsg}</p>
        <div className="spacer-md" />

        <div className="group-member-list__selection">{this.renderMemberList()}</div>
        {this.renderZombiesList()}
        {showNoMembersMessage && <p>{window.i18n('noMembersInThisGroup')}</p>}

        <div className="spacer-lg" />

        <div className="session-modal__button-group">
          <SessionButton text={cancelText} onClick={this.closeDialog} />
          {isAdmin && (
            <SessionButton
              text={okText}
              onClick={this.onClickOK}
              buttonColor={SessionButtonColor.Green}
            />
          )}
        </div>
      </SessionModal>
    );
  }

  private renderMemberList() {
    const members = this.state.contactList;

    return members.map((member: ContactType, index: number) => {
      const isSelected = this.props.isAdmin && !member.checkmarked;

      return (
        <SessionMemberListItem
          member={member}
          index={index}
          isSelected={isSelected}
          onSelect={this.onMemberClicked}
          onUnselect={this.onMemberClicked}
          key={member.id}
          theme={this.props.theme}
        />
      );
    });
  }

  private renderZombiesList() {
    const { isAdmin } = this.props;
    const { zombies } = this.state;

    if (!zombies.length) {
      return <></>;
    }

    const zombieElements = zombies.map((member: ContactType, index: number) => {
      const isSelected = isAdmin && !member.checkmarked;
      return (
        <SessionMemberListItem
          member={member}
          index={index}
          isSelected={isSelected}
          onSelect={this.onZombieClicked}
          onUnselect={this.onZombieClicked}
          isZombie={true}
          key={member.id}
          theme={this.props.theme}
        />
      );
    });
    return (
      <>
        <div className="spacer-lg" />
        {isAdmin && (
          <Text
            padding="20px"
            theme={this.props.theme}
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
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }

  private onMemberClicked(selected: ContactType) {
    const { isAdmin, admins } = this.props;
    const { contactList } = this.state;

    if (!isAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }

    if (selected.existingMember && !isAdmin) {
      window?.log?.warn('Only group admin can remove members!');
      return;
    }

    if (selected.existingMember && admins.includes(selected.id)) {
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

  private onZombieClicked(selected: ContactType) {
    const { isAdmin } = this.props;

    if (!isAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }
  }
}
