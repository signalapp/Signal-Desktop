import React from 'react';
import classNames from 'classnames';
import { Contact, MemberList } from './MemberList';

declare global {
  interface Window {
    SMALL_GROUP_SIZE_LIMIT: number;
    Lodash: any;
  }
}

interface Props {
  titleText: string;
  groupName: string;
  okText: string;
  cancelText: string;
  // friends not in the group
  friendList: Array<any>;
  isAdmin: boolean;
  existingMembers: Array<any>;
  i18n: any;
  onSubmit: any;
  onClose: any;
}

interface State {
  friendList: Array<Contact>;
  groupName: string;
  errorDisplayed: boolean;
  errorMessage: string;
}

export class UpdateGroupDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onMemberClicked = this.onMemberClicked.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onGroupNameChanged = this.onGroupNameChanged.bind(this);

    let friends = this.props.friendList;
    friends = friends.map(d => {
      const lokiProfile = d.getLokiProfile();
      const name = lokiProfile ? lokiProfile.displayName : 'Anonymous';

      const existingMember = this.props.existingMembers.indexOf(d.id) !== -1;

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
      groupName: this.props.groupName,
      errorDisplayed: false,
      errorMessage: 'placeholder',
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const members = this.getWouldBeMembers(this.state.friendList).map(
      d => d.id
    );

    if (!this.state.groupName.trim()) {
      this.onShowError(this.props.i18n('emptyGroupNameError'));

      return;
    }

    this.props.onSubmit(this.state.groupName, members);

    this.closeDialog();
  }

  public render() {
    const checkMarkedCount = this.getMemberCount(this.state.friendList);

    const titleText = `${this.props.titleText} (Members: ${checkMarkedCount})`;

    const okText = this.props.okText;
    const cancelText = this.props.cancelText;

    const noFriendsClasses =
      this.state.friendList.length === 0
        ? 'no-friends'
        : classNames('no-friends', 'hidden');

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <div className="content">
        <p className="titleText">{titleText}</p>
        <p className={errorMessageClasses}>{errorMsg}</p>
        <input
          type="text"
          id="group-name"
          className="group-name"
          placeholder="Group Name"
          value={this.state.groupName}
          disabled={!this.props.isAdmin}
          onChange={this.onGroupNameChanged}
          tabIndex={0}
          required={true}
          aria-required={true}
          autoFocus={true}
        />
        <div className="friend-selection-list">
          <MemberList
            members={this.state.friendList}
            selected={{}}
            i18n={this.props.i18n}
            onMemberClicked={this.onMemberClicked}
          />
        </div>
        <p className={noFriendsClasses}>(no friends to add)</p>
        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.closeDialog}>
            {cancelText}
          </button>
          <button className="ok" tabIndex={0} onClick={this.onClickOK}>
            {okText}
          </button>
        </div>
      </div>
    );
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

    const newMemberCount = this.getMemberCount(updatedFriends);

    if (newMemberCount > window.SMALL_GROUP_SIZE_LIMIT) {
      const msg = `${this.props.i18n('maxGroupMembersError')} ${
        window.SMALL_GROUP_SIZE_LIMIT
      }`;
      this.onShowError(msg);

      return;
    }

    this.setState(state => {
      return {
        ...state,
        friendList: updatedFriends,
      };
    });
  }

  private onGroupNameChanged(event: any) {
    event.persist();

    this.setState(state => {
      return {
        ...state,
        groupName: event.target.value,
      };
    });
  }
}
