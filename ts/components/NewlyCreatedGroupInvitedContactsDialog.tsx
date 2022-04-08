// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import { GroupDialog } from './GroupDialog';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';

type PropsType = {
  contacts: Array<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => void;
  theme: ThemeType;
};

export const NewlyCreatedGroupInvitedContactsDialog: FunctionComponent<
  PropsType
> = ({ contacts, getPreferredBadge, i18n, onClose, theme }) => {
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
            components={[<ContactName title={contact.title} />]}
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
        <GroupDialog.Contacts
          contacts={contacts}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          theme={theme}
        />
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
        openLinkInWebBrowser(
          'https://support.signal.org/hc/articles/360007319331-Group-chats'
        );
      }}
      onClose={onClose}
      title={title}
    >
      {body}
    </GroupDialog>
  );
};
