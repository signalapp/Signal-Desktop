// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import { compact, flatten } from 'lodash';

import { ContactName } from './ContactName';
import { SystemMessage } from './SystemMessage';
import { I18n } from '../I18n';
import type { LocalizerType } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';
import type { ConversationType } from '../../state/ducks/conversations';

export type ChangeType = 'add' | 'remove' | 'name' | 'avatar' | 'general';

type Change = {
  type: ChangeType;
  newName?: string;
  contacts?: Array<ConversationType>;
};

export type PropsData = {
  from: ConversationType;
  changes: Array<Change>;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

function GroupNotificationChange({
  change,
  from,
  i18n,
}: {
  change: Change;
  from: ConversationType;
  i18n: LocalizerType;
}): JSX.Element | null {
  const { contacts, type, newName } = change;

  const otherPeople: Array<JSX.Element> = compact(
    (contacts || []).map(contact => {
      if (contact.isMe) {
        return null;
      }

      return (
        <span
          key={`external-${contact.id}`}
          className="module-group-notification__contact"
        >
          <ContactName title={contact.title} />
        </span>
      );
    })
  );
  const otherPeopleWithCommas: Array<JSX.Element | string> = compact(
    flatten(
      otherPeople.map((person, index) => [index > 0 ? ', ' : null, person])
    )
  );
  const contactsIncludesMe = (contacts || []).length !== otherPeople.length;

  switch (type) {
    case 'name':
      return (
        <I18n
          i18n={i18n}
          id="icu:titleIsNow"
          components={{ name: newName || '' }}
        />
      );
    case 'avatar':
      return <I18n i18n={i18n} id="icu:updatedGroupAvatar" />;
    case 'add':
      if (!contacts || !contacts.length) {
        throw new Error('Group update is missing contacts');
      }

      return (
        <>
          {otherPeople.length > 0 && (
            <>
              {otherPeople.length === 1 ? (
                <I18n
                  i18n={i18n}
                  id="icu:joinedTheGroup"
                  components={{ name: otherPeople[0] }}
                />
              ) : (
                <I18n
                  i18n={i18n}
                  id="icu:multipleJoinedTheGroup"
                  components={{ names: otherPeopleWithCommas }}
                />
              )}
            </>
          )}
          {contactsIncludesMe && (
            <div className="module-group-notification__change">
              <I18n i18n={i18n} id="icu:youJoinedTheGroup" />
            </div>
          )}
        </>
      );
    case 'remove':
      if (from && from.isMe) {
        return <>{i18n('icu:youLeftTheGroup')}</>;
      }

      if (!contacts || !contacts.length) {
        throw new Error('Group update is missing contacts');
      }

      return contacts.length > 1 ? (
        <I18n
          id="icu:multipleLeftTheGroup"
          i18n={i18n}
          components={{ name: otherPeople[0] }}
        />
      ) : (
        <I18n
          id="icu:leftTheGroup"
          i18n={i18n}
          components={{ name: otherPeopleWithCommas }}
        />
      );
    case 'general':
      return null;
    default:
      throw missingCaseError(type);
  }
}

export function GroupNotification({
  changes: rawChanges,
  i18n,
  from,
}: Props): JSX.Element {
  // This check is just to be extra careful, and can probably be removed.
  const changes: Array<Change> = Array.isArray(rawChanges) ? rawChanges : [];

  // Leave messages are always from the person leaving, so we omit the fromLabel if
  //   the change is a 'leave.'
  const firstChange: undefined | Change = changes[0];
  const isLeftOnly = changes.length === 1 && firstChange?.type === 'remove';

  const fromLabel = from.isMe ? (
    <I18n i18n={i18n} id="icu:youUpdatedTheGroup" />
  ) : (
    <I18n
      i18n={i18n}
      id="icu:updatedTheGroup"
      components={{ name: <ContactName title={from.title} /> }}
    />
  );

  let contents: ReactNode;
  if (isLeftOnly) {
    contents = (
      <GroupNotificationChange change={firstChange} from={from} i18n={i18n} />
    );
  } else {
    contents = (
      <>
        <p>{fromLabel}</p>
        {changes.map((change, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i} className="module-group-notification__change">
            <GroupNotificationChange change={change} from={from} i18n={i18n} />
          </p>
        ))}
      </>
    );
  }

  return <SystemMessage contents={contents} icon="group" />;
}
