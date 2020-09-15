import React from 'react';

import { SessionModal } from '../session/SessionModal';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import {
  ContactType,
  SessionMemberListItem,
} from '../session/SessionMemberListItem';

interface Props {
  contactList: Array<any>;
  chatName: string;
  onSubmit: any;
  onClose: any;
}

interface State {
  contactList: Array<ContactType>;
}

export class InviteContactsDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onMemberClicked = this.onMemberClicked.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    let contacts = this.props.contactList;

    contacts = contacts.map(d => {
      const lokiProfile = d.getLokiProfile();
      const name = lokiProfile
        ? lokiProfile.displayName
        : window.i18n('anonymous');

      // TODO: should take existing members into account
      const existingMember = false;

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        authorAvatarPath: d?.cachedProps?.avatarPath,
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
      <SessionModal
        title={titleText}
        onOk={() => null}
        onClose={this.closeDialog}
      >
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

  private onClickOK() {
    const selectedContacts = this.state.contactList
      .filter(d => d.checkmarked)
      .map(d => d.id);

    if (selectedContacts.length > 0) {
      this.props.onSubmit(selectedContacts);
    }

    this.closeDialog();
  }

  private renderMemberList() {
    const members = this.state.contactList;

    return members.map((member: ContactType, index: number) => (
      <SessionMemberListItem
        member={member}
        key={index}
        index={index}
        isSelected={false}
        onSelect={(selectedMember: ContactType) => {
          this.onMemberClicked(selectedMember);
        }}
        onUnselect={(selectedMember: ContactType) => {
          this.onMemberClicked(selectedMember);
        }}
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
