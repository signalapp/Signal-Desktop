import React from 'react';
import { compact, flatten } from 'lodash';

import { Intl } from '../Intl';
import { missingCaseError } from '../../util/missingCaseError';
import {
  PropsForGroupUpdate,
  PropsForGroupUpdateAdd,
  PropsForGroupUpdateKicked,
  PropsForGroupUpdateRemove,
  PropsForGroupUpdateType,
} from '../../state/ducks/conversations';
import _ from 'underscore';

// This component is used to display group updates in the conversation view.
// This is a not a "notification" as the name suggests, but a message inside the conversation

type TypeWithContacts =
  | PropsForGroupUpdateAdd
  | PropsForGroupUpdateKicked
  | PropsForGroupUpdateRemove;

function isTypeWithContact(change: PropsForGroupUpdateType): change is TypeWithContacts {
  return (change as TypeWithContacts).contacts !== undefined;
}

function getPeople(change: TypeWithContacts) {
  return _.compact(
    flatten(
      (change.contacts || []).map((contact, index) => {
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
}

function renderChange(change: PropsForGroupUpdateType) {
  const people = isTypeWithContact(change) ? getPeople(change) : [];
  switch (change.type) {
    case 'name':
      return `${window.i18n('titleIsNow', [change.newName || ''])}.`;
    case 'add':
      if (!change.contacts || !change.contacts.length) {
        throw new Error('Group update add is missing contacts');
      }

      const joinKey = change.contacts.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup';

      return <Intl id={joinKey} components={[people]} />;
    case 'remove':
      if (change.isMe) {
        return window.i18n('youLeftTheGroup');
      }

      if (!change.contacts || !change.contacts.length) {
        throw new Error('Group update remove is missing contacts');
      }

      const leftKey = change.contacts.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup';

      return <Intl id={leftKey} components={[people]} />;
    case 'kicked':
      if (change.isMe) {
        return window.i18n('youGotKickedFromGroup');
      }

      if (!change.contacts || !change.contacts.length) {
        throw new Error('Group update kicked is missing contacts');
      }

      const kickedKey =
        change.contacts.length > 1 ? 'multipleKickedFromTheGroup' : 'kickedFromTheGroup';

      return <Intl id={kickedKey} components={[people]} />;
    case 'general':
      return window.i18n('updatedTheGroup');
    default:
      window.log.error('Missing case error');
  }
}

export const GroupNotification = (props: PropsForGroupUpdate) => {
  const { changes } = props;
  return (
    <div className="module-group-notification" id={`group-notif-${props.messageId}`}>
      {(changes || []).map((change, index) => (
        <div key={index} className="module-group-notification__change">
          {renderChange(change)}
        </div>
      ))}
    </div>
  );
};
