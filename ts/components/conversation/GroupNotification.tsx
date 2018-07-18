import React from 'react';
// import classNames from 'classnames';
import { compact, flatten } from 'lodash';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { Localizer } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Change {
  type: 'add' | 'remove' | 'name' | 'general';
  isMe: boolean;
  newName?: string;
  contacts?: Array<Contact>;
}

interface Props {
  changes: Array<Change>;
  i18n: Localizer;
}

export class GroupNotification extends React.Component<Props> {
  public renderChange(change: Change) {
    const { isMe, contacts, type, newName } = change;
    const { i18n } = this.props;

    const people = compact(
      flatten(
        (contacts || []).map((contact, index) => {
          const element = (
            <span
              key={`external-${contact.phoneNumber}`}
              className="module-group-notification__contact"
            >
              <ContactName
                i18n={i18n}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                name={contact.name}
              />
            </span>
          );

          return [index > 0 ? ', ' : null, element];
        })
      )
    );

    switch (type) {
      case 'name':
        return i18n('titleIsNow', [newName || '']);
      case 'add':
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }

        return (
          <Intl
            i18n={i18n}
            id={
              contacts.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup'
            }
            components={[people]}
          />
        );
      case 'remove':
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }

        if (isMe) {
          return i18n('youLeftTheGroup');
        }

        return (
          <Intl
            i18n={i18n}
            id={contacts.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup'}
            components={[people]}
          />
        );
      case 'general':
        return i18n('updatedTheGroup');
      default:
        throw missingCaseError(type);
    }
  }

  public render() {
    const { changes } = this.props;

    return (
      <div className="module-group-notification">
        {(changes || []).map((change, index) => (
          <div key={index} className="module-group-notification__change">
            {this.renderChange(change)}
          </div>
        ))}
      </div>
    );
  }
}
