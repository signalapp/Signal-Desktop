import React from 'react';
import { Contact, MemberList } from './MemberList';

import { SessionModal } from '../session/SessionModal';
import { SessionButton } from '../session/SessionButton';

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
}

export class InviteFriendsDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onMemberClicked = this.onMemberClicked.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

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
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const titleText = `${window.i18n('addingFriends')} ${this.props.chatName}`;
    const cancelText = window.i18n('cancel');
    const okText = window.i18n('ok');

    const hasFriends = this.state.friendList.length !== 0;

    return (
      <SessionModal
        title={titleText}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        <div className="friend-selection-list">
          <MemberList
            members={this.state.friendList}
            selected={{}}
            i18n={window.i18n}
            onMemberClicked={this.onMemberClicked}
          />
        </div>
        {hasFriends ? null : (
          <>
            <div className="spacer-lg" />
            <p className="no-friends">{window.i18n('noFriendsToAdd')}</p>
            <div className="spacer-lg" />
          </>
        )}

        <div className="session-modal__button-group">
          <SessionButton text={cancelText} onClick={this.closeDialog} />
          <SessionButton
            text={okText}
            disabled={!hasFriends}
            onClick={this.onClickOK}
          />
        </div>
      </SessionModal>
    );
  }

  private onClickOK() {
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
