import React from 'react';
import { compact, flatten } from 'lodash';

import { Intl } from '../Intl';
import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Change {
  type: 'add' | 'remove' | 'name' | 'general' | 'kicked';
  isMe: boolean;
  newName?: string;
  contacts?: Array<Contact>;
}

type Props = {
  changes: Array<Change>;
};

// This component is used to display group updates in the conversation view.
// This is a not a "notification" as the name suggests, but a message inside the conversation
export const GroupNotification = (props: Props) => {
  function renderChange(change: Change) {
    const { isMe, contacts, type, newName } = change;

    const people = compact(
      flatten(
        (contacts || []).map((contact, index) => {
          const element = (
            <span
              key={`external-${contact.phoneNumber}`}
              className="module-group-notification__contact"
            >
              {contact.profileName || contact.phoneNumber}
            </span>
          );

          return [index > 0 ? ', ' : null, element];
        })
      )
    );

    switch (type) {
      case 'name':
        return `${window.i18n('titleIsNow', [newName || ''])}.`;
      case 'add':
        if (!contacts || !contacts.length) {
          throw new Error('Group update add is missing contacts');
        }

        const joinKey = contacts.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup';

        return <Intl id={joinKey} components={[people]} />;
      case 'remove':
        if (isMe) {
          return window.i18n('youLeftTheGroup');
        }

        if (!contacts || !contacts.length) {
          throw new Error('Group update remove is missing contacts');
        }

        const leftKey = contacts.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup';

        return <Intl id={leftKey} components={[people]} />;
      case 'kicked':
        if (isMe) {
          return window.i18n('youGotKickedFromGroup');
        }

        if (!contacts || !contacts.length) {
          throw new Error('Group update kicked is missing contacts');
        }

        const kickedKey = contacts.length > 1 ? 'multipleKickedFromTheGroup' : 'kickedFromTheGroup';

        return <Intl id={kickedKey} components={[people]} />;
      case 'general':
        return window.i18n('updatedTheGroup');
      default:
        throw missingCaseError(type);
    }
  }

  const { changes } = props;
  return (
    <div className="module-group-notification">
      {(changes || []).map((change, index) => (
        <div key={index} className="module-group-notification__change">
          {renderChange(change)}
        </div>
      ))}
    </div>
  );
};
