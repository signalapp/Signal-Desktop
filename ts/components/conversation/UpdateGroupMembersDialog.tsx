import React from 'react';
import classNames from 'classnames';
import { Contact } from './MemberList';

import { SessionModal } from '../session/SessionModal';
import { SessionButton } from '../session/SessionButton';
import {
  ContactType,
  SessionMemberListItem,
} from '../session/SessionMemberListItem';

interface Props {
  titleText: string;
  groupName: string;
  okText: string;
  isPublic: boolean;
  cancelText: string;
  // friends not in the group
  friendList: Array<any>;
  isAdmin: boolean;
  existingMembers: Array<String>;
  i18n: any;
  onSubmit: any;
  onClose: any;
}

interface State {
  friendList: Array<Contact>;
  errorDisplayed: boolean;
  errorMessage: string;
}

export class UpdateGroupMembersDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onMemberClicked = this.onMemberClicked.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.closeDialog = this.closeDialog.bind(this);

    let friends = this.props.friendList;
    friends = friends.map(d => {
      const lokiProfile = d.getLokiProfile();
      const name = lokiProfile ? lokiProfile.displayName : 'Anonymous';

      const existingMember = this.props.existingMembers.includes(d.id);

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        selected: false,
        authorName: name, // different from ProfileName?
        authorColor: d.getColor(),
        checkmarked: false,
        existingMember,
      };
    });

    this.state = {
      friendList: friends,
      errorDisplayed: false,
      errorMessage: 'placeholder',
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const members = this.getWouldBeMembers(this.state.friendList).map(
      d => d.id
    );

    this.props.onSubmit(this.props.groupName, members);

    this.closeDialog();
  }

  public render() {
    const checkMarkedCount = this.getMemberCount(this.state.friendList);

    const okText = this.props.okText;
    const cancelText = this.props.cancelText;

    let titleText;
    let noFriendsClasses;

    if (this.props.isPublic) {
      // no member count in title
      titleText = `${this.props.titleText}`;
      // hide the no-friend message
      noFriendsClasses = classNames('no-friends', 'hidden');
    } else {
      // private group
      titleText = `${this.props.titleText} (Members: ${checkMarkedCount})`;
      noFriendsClasses =
        this.state.friendList.length === 0
          ? 'no-friends'
          : classNames('no-friends', 'hidden');
    }

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <SessionModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
        onOk={() => null}
      >
        <div className="spacer-md" />
        <p className={errorMessageClasses}>{errorMsg}</p>
        <div className="spacer-md" />

        <div className="group-member-list__selection">
          {this.renderMemberList()}
        </div>
        <p className={noFriendsClasses}>{`(${this.props.i18n(
          'noMembersInThisGroup'
        )})`}</p>

        <div className="session-modal__button-group">
          <SessionButton text={okText} onClick={this.onClickOK} />

          <SessionButton text={cancelText} onClick={this.closeDialog} />
        </div>
      </SessionModal>
    );
  }

  private renderMemberList() {
    const members = this.state.friendList;

    return members.map((member: ContactType) => (
      <SessionMemberListItem
        member={member}
        isSelected={!member.checkmarked}
        onSelect={this.onMemberClicked}
        onUnselect={this.onMemberClicked}
        key={member.id}
      />
    ));
  }

  private onShowError(msg: string) {
    if (this.state.errorDisplayed) {
      return;
    }

    this.setState({
      errorDisplayed: true,
      errorMessage: msg,
    });

    setTimeout(() => {
      this.setState({
        errorDisplayed: false,
      });
    }, 3000);
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
  private getWouldBeMembers(users: Array<Contact>) {
    return users.filter(d => {
      return (
        (d.existingMember && !d.checkmarked) ||
        (!d.existingMember && d.checkmarked)
      );
    });
  }

  private getMemberCount(users: Array<Contact>) {
    // Adding one to include ourselves
    return this.getWouldBeMembers(users).length + 1;
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }

  private onMemberClicked(selected: any) {
    if (selected.existingMember && !this.props.isAdmin) {
      this.onShowError(this.props.i18n('nonAdminDeleteMember'));

      return;
    }

    const updatedFriends = this.state.friendList.map(member => {
      if (member.id === selected.id) {
        return { ...member, checkmarked: !member.checkmarked };
      } else {
        return member;
      }
    });

    this.setState(state => {
      return {
        ...state,
        friendList: updatedFriends,
      };
    });
  }
}
