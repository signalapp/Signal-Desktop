import React from 'react';
import { MemberList, Contact } from './MemberList';

declare global {
  interface Window {
    Lodash: any;
    doCreateGroup: any;
  }
}

interface Props {
  titleText: string;
  okText: string;
  cancelText: string;
  friendList: any[];
  i18n: any;
  onClose: any;
}

interface State {
  friendList: Contact[];
  groupName: string;
}

export class CreateGroupDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    // const _ = window.Lodash;

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
    };

    window.addEventListener('keyup', this.onKeyUp);
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
        break;
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }

  private onMemberClicked(selected: any) {
    this.setState(state => {
      const updatedFriends = this.state.friendList.map(member => {
        if (member.id === selected.id) {
          return { ...member, checkmarked: !member.checkmarked };
        } else {
          return member;
        }
      });

      return {
        ...state,
        friendList: updatedFriends,
      };
    });
  }

  public onClickOK() {
    const members = this.state.friendList
      .filter(d => d.checkmarked)
      .map(d => d.id);

    if (!this.state.groupName.trim()) {
      console.error('Group name cannot be empty!');
      return;
    }

    window.doCreateGroup(this.state.groupName, members);

    this.closeDialog();
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

  public render() {
    const titleText = this.props.titleText;
    const okText = this.props.okText;
    const cancelText = this.props.cancelText;

    return (
      <div className="content">
        <p className="titleText">{titleText}</p>
        <input
          type="text"
          id="group-name"
          className="group-name"
          placeholder="Group Name"
          value={this.state.groupName}
          onChange={this.onGroupNameChanged}
          tabIndex={0}
          required
          autoFocus
        />
        <div className="friend-selection-list">
          <MemberList
            members={this.state.friendList}
            selected={{}}
            i18n={this.props.i18n}
            onMemberClicked={this.onMemberClicked}
          />
        </div>
        <div className="buttons">
          <button className="cancel" tabIndex={2} onClick={this.closeDialog}>
            {cancelText}
          </button>
          <button className="ok" tabIndex={1} onClick={this.onClickOK}>
            {okText}
          </button>
        </div>
      </div>
    );
  }
}
