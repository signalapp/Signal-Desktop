import React from 'react';
import classNames from 'classnames';
import { Contact, MemberList } from './MemberList';

import { SessionModal } from './../session/SessionModal';

declare global {
  interface Window {
    Lodash: any;
    doCreateGroup: any;
    SMALL_GROUP_SIZE_LIMIT: number;
  }
}

interface Props {
  titleText: string;
  okText: string;
  cancelText: string;
  friendList: Array<any>;
  i18n: any;
  onClose: any;
}

interface State {
  friendList: Array<Contact>;
  groupName: string;
  errorDisplayed: boolean;
  errorMessage: string;
}

export class CreateGroupDialog extends React.Component<Props, State> {
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

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        selected: false,
        authorName: name, // different from ProfileName?
        authorColor: d.getColor(),
        checkmarked: false,
      };
    });

    this.state = {
      friendList: friends,
      groupName: '',
      errorDisplayed: false,
      // if empty, the initial height is 0, which is not desirable
      errorMessage: 'placeholder',
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const members = this.state.friendList
      .filter(d => d.checkmarked)
      .map(d => d.id);

    if (!this.state.groupName.trim()) {
      this.onShowError(this.props.i18n('emptyGroupNameError'));

      return;
    }

    window.doCreateGroup(this.state.groupName, members);

    this.closeDialog();
  }

  public render() {
    const checkMarkedCount = this.getMemberCount();

    const titleText = `${this.props.titleText} (Members: ${checkMarkedCount})`;
    const okText = this.props.okText;
    const cancelText = this.props.cancelText;

    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <SessionModal
        title={titleText}
        onClose={this.closeDialog}
        onOk={() => null}
      >
        <div className="spacer-lg" />

        <p className={errorMessageClasses}>{this.state.errorMessage}</p>
        <input
          type="text"
          id="group-name"
          className="group-name"
          placeholder={this.props.i18n('groupNamePlaceholder')}
          value={this.state.groupName}
          onChange={this.onGroupNameChanged}
          tabIndex={0}
          required={true}
          autoFocus={true}
          aria-required={true}
        />
        <div className="friend-selection-list">
          <MemberList
            members={this.state.friendList}
            selected={{}}
            i18n={this.props.i18n}
            onMemberClicked={this.onMemberClicked}
          />
        </div>

        <div className="spacer-lg" />

        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.closeDialog}>
            {cancelText}
          </button>
          <button className="ok" tabIndex={0} onClick={this.onClickOK}>
            {okText}
          </button>
        </div>
      </SessionModal>
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

  private onGroupNameChanged(event: any) {
    event.persist();

    this.setState(state => {
      return {
        ...state,
        groupName: event.target.value,
      };
    });
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

  private getMemberCount() {
    // Add 1 to include yourself
    return this.state.friendList.filter(d => d.checkmarked).length + 1;
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }

  private onMemberClicked(selected: any) {
    const updatedFriends = this.state.friendList.map(member => {
      if (member.id === selected.id) {
        return { ...member, checkmarked: !member.checkmarked };
      } else {
        return member;
      }
    });

    if (
      updatedFriends.filter(d => d.checkmarked).length >
      window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT - 1
    ) {
      const msg = `${this.props.i18n('maxGroupMembersError')} ${
        window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
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
}
