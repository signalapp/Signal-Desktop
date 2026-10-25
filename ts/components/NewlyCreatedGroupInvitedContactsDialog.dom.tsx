// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, type ReactNode } from 'react';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import { I18n } from './I18n.dom.tsx';
import { ContactName } from './conversation/ContactName.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { UserText } from './UserText.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoContactList } from '../axo/items/AxoContactList.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.ts';

export type NewlyCreatedGroupInvitedContactsDialogProps = Readonly<{
  i18n: LocalizerType;
  contacts: ReadonlyArray<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  theme: ThemeType;
  onClose: () => void;
}>;

export function NewlyCreatedGroupInvitedContactsDialog(
  props: NewlyCreatedGroupInvitedContactsDialogProps
): ReactNode {
  const { i18n, contacts, onClose } = props;

  const handleOpenChange = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleLearnMore = useCallback(() => {
    openLinkInWebBrowser(
      'https://support.signal.org/hc/articles/360007319331-Group-chats'
    );
  }, []);

  let userParagraph: ReactNode;
  if (contacts.length === 1) {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const contact = contacts[0]!;
    userParagraph = (
      <I18n
        i18n={i18n}
        id="icu:NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--one"
        components={{ name: <ContactName title={contact.title} /> }}
      />
    );
  } else {
    userParagraph = i18n(
      'icu:NewlyCreatedGroupInvitedContactsDialog--body--user-paragraph--many'
    );
  }

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:NewlyCreatedGroupInvitedContactsDialog--title', {
              count: contacts.length,
            })}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <AxoDialog.Description>
            <p className={tw('mb-2.5 px-2')}>{userParagraph}</p>
            <p className={tw('mb-2.5 px-2')}>
              {i18n(
                'icu:NewlyCreatedGroupInvitedContactsDialog--body--info-paragraph'
              )}
            </p>
          </AxoDialog.Description>
          {contacts.length > 1 && (
            <AxoContactList.Root>
              {contacts.map(contact => {
                return (
                  <InvitedContactItem
                    key={contact.id}
                    i18n={i18n}
                    contact={contact}
                    getPreferredBadge={props.getPreferredBadge}
                    theme={props.theme}
                  />
                );
              })}
            </AxoContactList.Root>
          )}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              arrow="external-link"
              onClick={handleLearnMore}
            >
              {i18n(
                'icu:NewlyCreatedGroupInvitedContactsDialog--body--learn-more'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={onClose}
              autoFocus
            >
              {i18n('icu:ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type InvitedContactItemProps = Readonly<{
  i18n: LocalizerType;
  contact: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  theme: ThemeType;
}>;

function InvitedContactItem(props: InvitedContactItemProps): ReactNode {
  const { i18n, contact } = props;
  return (
    <AxoContactList.Item
      avatar={
        <Avatar
          i18n={i18n}
          avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
          avatarUrl={contact.avatarUrl}
          badge={props.getPreferredBadge(contact.badges)}
          color={contact.color}
          conversationType={contact.type}
          hasAvatar={contact.hasAvatar}
          noteToSelf={contact.isMe}
          size={AvatarSize.THIRTY_TWO}
          theme={props.theme}
          title={contact.title}
        />
      }
      title={<UserText text={contact.title} />}
    />
  );
}
