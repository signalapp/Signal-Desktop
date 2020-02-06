import React from 'react';
import { Contact, MemberList } from './MemberList';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

interface Props {
  friendList: Array<any>;
  chatName: string;
  onSubmit: any;
  onClose: any;
}

declare global {
  interface Window {
    i18n: any;
  }
}

interface State {
  friendList: Array<Contact>;
  inputBoxValue: string;
}

export class AddModeratorsDialog extends React.Component<Props, State> {
  private readonly updateSearchBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);

    this.updateSearchBound = this.updateSearch.bind(this);
    this.onMemberClicked = this.onMemberClicked.bind(this);
    this.add = this.add.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.inputRef = React.createRef();

    let friends = this.props.friendList;
    friends = friends.map(d => {
      const lokiProfile = d.getLokiProfile();
      const name = lokiProfile ? lokiProfile.displayName : 'Anonymous';

      // TODO: should take existing members into account
      const existingMember = false;

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        selected: false,
        authorName: name,
        authorColor: d.getColor(),
        checkmarked: false,
        existingMember,
      };
    });
    this.state = {
      friendList: friends,
      inputBoxValue: '',
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public updateSearch(event: React.FormEvent<HTMLInputElement>) {
    const searchTerm = event.currentTarget.value;

    const cleanedTerm = cleanSearchTerm(searchTerm);
    if (!cleanedTerm) {
      return;
    }

    this.setState(state => {
      return {
        ...state,
        inputBoxValue: searchTerm,
      };
    });
  }
  public add() {
    // if we have valid data
    if (this.state.inputBoxValue.length > 64) {
      const weHave = this.state.friendList.some(
        user => user.authorPhoneNumber === this.state.inputBoxValue
      );
      if (!weHave) {
        // lookup to verify it's registered?

        // convert pubKey into local object...
        const friends = this.state.friendList;
        friends.push({
          id: this.state.inputBoxValue,
          authorPhoneNumber: this.state.inputBoxValue,
          authorProfileName: this.state.inputBoxValue,
          authorAvatarPath: '',
          selected: true,
          authorName: this.state.inputBoxValue,
          authorColor: '#000000',
          checkmarked: true,
          existingMember: false,
        });
        this.setState(state => {
          return {
            ...state,
            friendList: friends,
          };
        });
      }
      //
    }
    // clear
    if (this.inputRef.current) {
      this.inputRef.current.value = '';
    }
    this.setState(state => {
      return {
        ...state,
        inputBoxValue: '',
      };
    });
  }

  public render() {
    const i18n = window.i18n;

    const hasFriends = this.state.friendList.length !== 0;

    return (
      <div className="content">
        <p className="titleText">
          {i18n('addModerators')} <span>{this.props.chatName}</span>
        </p>
        <div className="addModeratorBox">
          <p>Add Moderator:</p>
          <input
            type="text"
            ref={this.inputRef}
            className="module-main-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            onChange={this.updateSearchBound}
          />
          <button className="add" tabIndex={0} onClick={this.add}>
            {i18n('add')}
          </button>
        </div>
        <div className="moderatorList">
          <p>From friends:</p>
          <div className="friend-selection-list">
            <MemberList
              members={this.state.friendList}
              selected={{}}
              i18n={i18n}
              onMemberClicked={this.onMemberClicked}
            />
          </div>
          {hasFriends ? null : (
            <p className="no-friends">{i18n('noFriendsToAdd')}</p>
          )}
        </div>
        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.closeDialog}>
            {i18n('cancel')}
          </button>
          <button className="ok" tabIndex={0} onClick={this.onClickOK}>
            {i18n('ok')}
          </button>
        </div>
      </div>
    );
  }

  private onClickOK() {
    this.add(); // process inputBox
    const selectedFriends = this.state.friendList
      .filter(d => d.checkmarked)
      .map(d => d.id);
    if (selectedFriends.length > 0) {
      this.props.onSubmit(selectedFriends);
    }

    this.closeDialog();
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

    this.setState(state => {
      return {
        ...state,
        friendList: updatedFriends,
      };
    });
  }
}
