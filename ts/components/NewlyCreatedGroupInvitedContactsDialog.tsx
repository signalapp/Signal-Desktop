// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, ReactNode } from 'react';

import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import { GroupDialog } from './GroupDialog';

type PropsType = {
  contacts: Array<ConversationType>;
  i18n: LocalizerType;
  onClose: () => void;
};

export const NewlyCreatedGroupInvitedContactsDialog: FunctionComponent<PropsType> = ({
  contacts,
  i18n,
  onClose,
}) => {
  let title: string;
  let body: ReactNode;
  if (contacts.length === 1) {
    const contact = contacts[0];

    title = i18n('NewlyCreatedGroupInvitedContactsDialog--title--one');
    body = (
      <>
        <GroupDialog.Paragraph>
          <Intl
            i18n={i18n}
            id="NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--one"
            components={[<ContactName i18n={i18n} title={contact.title} />]}
          />
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>
          {i18n('NewlyCreatedGroupInvitedContactsDialog--body--info-paragraph')}
        </GroupDialog.Paragraph>
      </>
    );
  } else {
    title = i18n('NewlyCreatedGroupInvitedContactsDialog--title--many', [
      contacts.length.toString(),
    ]);
    body = (
      <>
        <GroupDialog.Paragraph>
          {i18n(
            'NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--many'
          )}
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>
          {i18n('NewlyCreatedGroupInvitedContactsDialog--body--info-paragraph')}
        </GroupDialog.Paragraph>
        <GroupDialog.Contacts contacts={contacts} i18n={i18n} />
      </>
    );
  }

  return (
    <GroupDialog
      i18n={i18n}
      onClickPrimaryButton={onClose}
      primaryButtonText={i18n('Confirmation--confirm')}
      secondaryButtonText={i18n(
        'NewlyCreatedGroupInvitedContactsDialog--body--learn-more'
      )}
      onClickSecondaryButton={() => {
        window.location.href =
          'https://support.signal.org/hc/articles/360007319331-Group-chats';
      }}
      onClose={onClose}
      title={title}
    >
      {body}
    </GroupDialog>
  );
};
