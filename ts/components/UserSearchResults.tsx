import React from 'react';
import { PropsData as ConversationListItemPropsType } from './ConversationListItem';

import { LocalizerType } from '../types/Util';
import classNames from 'classnames';

export type PropsData = {
  contacts: Array<ConversationListItemPropsType>;
  regionCode: string;
  searchTerm: string;
  selectedContact: Number;
  onContactSelected: any;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

type Props = PropsData & PropsHousekeeping;

export class UserSearchResults extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public render() {
    const { contacts, i18n, searchTerm } = this.props;

    const haveContacts = contacts && contacts.length;
    const noResults = !haveContacts;

    return (
      <div className="module-search-results">
        {noResults ? (
          <div className="module-search-results__no-results">
            {i18n('noSearchResults', [searchTerm])}
          </div>
        ) : null}
        {haveContacts ? this.renderContacts(contacts) : null}
      </div>
    );
  }

  private renderContacts(items: Array<ConversationListItemPropsType>) {
    return (
      <div className="contacts-dropdown">
        {items.map((contact, index) => this.renderContact(contact, index))}
      </div>
    );
  }

  private renderContact(contact: ConversationListItemPropsType, index: Number) {
    const { profileName, phoneNumber } = contact;
    const { selectedContact } = this.props;

    const shortenedPubkey = window.shortenPubkey(phoneNumber);
    const rowContent = `${profileName} ${shortenedPubkey}`;

    return (
      <div
        className={classNames(
          'contacts-dropdown-row',
          selectedContact === index && 'contacts-dropdown-row-selected'
        )}
        key={contact.phoneNumber}
        onClick={() => this.props.onContactSelected(contact.phoneNumber)}
        role="button"
      >
        {rowContent}
      </div>
    );
  }
}
