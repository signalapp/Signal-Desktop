import React from 'react';
import { Contact, MemberList } from './MemberList';

interface Props {
  modList: Array<any>;
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
  modList: Array<Contact>;
}

export class RemoveModeratorsDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onModClicked = this.onModClicked.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    let mods = this.props.modList;
    mods = mods.map(d => {
      let name = '';
      if (d.getLokiProfile) {
        const lokiProfile = d.getLokiProfile();
        name = lokiProfile ? lokiProfile.displayName : 'Anonymous';
      }
      const authorColor = d.getColor ? d.getColor() : '#000000';
      // TODO: should take existing members into account
      const existingMember = false;

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        selected: false,
        authorName: name,
        authorColor,
        checkmarked: true,
        existingMember,
      };
    });
    this.state = {
      modList: mods,
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = window.i18n;
    const hasMods = this.state.modList.length !== 0;

    return (
      <div className="content">
        <p className="titleText">
          {i18n('removeModerators')} <span>{this.props.chatName}</span>
        </p>
        <div className="moderatorList">
          <p>Existing moderators:</p>
          <div className="friend-selection-list">
            <MemberList
              members={this.state.modList}
              selected={{}}
              i18n={i18n}
              onMemberClicked={this.onModClicked}
            />
          </div>
          {hasMods ? null : (
            <p className="no-friends">{i18n('noModeratorsToRemove')}</p>
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
    const removedMods = this.state.modList
      .filter(d => !d.checkmarked)
      .map(d => d.id);

    if (removedMods.length > 0) {
      this.props.onSubmit(removedMods);
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

  private onModClicked(selected: any) {
    const updatedFriends = this.state.modList.map(member => {
      if (member.id === selected.id) {
        return { ...member, checkmarked: !member.checkmarked };
      } else {
        return member;
      }
    });

    this.setState(state => {
      return {
        ...state,
        modList: updatedFriends,
      };
    });
  }
}
