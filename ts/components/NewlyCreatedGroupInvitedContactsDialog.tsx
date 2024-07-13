// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { I18n } from './I18n';
import { ContactName } from './conversation/ContactName';
import { GroupDialog } from './GroupDialog';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';

export type PropsType = {
  contacts: Array<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => void;
  theme: ThemeType;
};

export function NewlyCreatedGroupInvitedContactsDialog({
  contacts,
  getPreferredBadge,
  i18n,
  onClose,
  theme,
}: PropsType): JSX.Element {
  let body: ReactNode;
  if (contacts.length === 1) {
    const contact = contacts[0];

    body = (
      <>
        <GroupDialog.Paragraph>
          <I18n
            i18n={i18n}
            id="icu:NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--one"
            components={{ name: <ContactName title={contact.title} /> }}
          />
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>
          {i18n(
            'icu:NewlyCreatedGroupInvitedContactsDialog--body--info-paragraph'
          )}
        </GroupDialog.Paragraph>
      </>
    );
  } else {
    body = (
      <>
        <GroupDialog.Paragraph>
          {i18n(
            'icu:NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--many'
          )}
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>
          {i18n(
            'icu:NewlyCreatedGroupInvitedContactsDialog--body--info-paragraph'
          )}
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
      primaryButtonText={i18n('icu:Confirmation--confirm')}
      secondaryButtonText={i18n(
        'icu:NewlyCreatedGroupInvitedContactsDialog--body--learn-more'
      )}
      onClickSecondaryButton={() => {
        openLinkInWebBrowser(
          'https://support.signal.org/hc/articles/360007319331-Group-chats'
        );
      }}
      onClose={onClose}
      title={i18n('icu:NewlyCreatedGroupInvitedContactsDialog--title', {
        count: contacts.length,
      })}
    >
      {body}
    </GroupDialog>
  );
}
