// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import type { PendingUserActionPayloadType } from '../state/ducks/calling.preload.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { isInSystemContacts } from '../util/isInSystemContacts.std.ts';
import { ThemeType } from '../types/Util.std.ts';
import { UserText } from './UserText.dom.tsx';
import { SharedGroupNames } from './SharedGroupNames.dom.tsx';
import type { ContactModalStateType } from '../types/globalModals.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { AxoContactName } from '../axo/AxoContactName.dom.tsx';

export type CallLinkPendingParticipantModalProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  approveUser: (payload: PendingUserActionPayloadType) => void;
  denyUser: (payload: PendingUserActionPayloadType) => void;
  onClose: () => void;
  sharedGroupNames: ReadonlyArray<string>;
  toggleAboutContactModal: (options: ContactModalStateType) => void;
}>;

export function CallLinkPendingParticipantModal({
  i18n,
  conversation,
  approveUser,
  denyUser,
  onClose,
  sharedGroupNames,
  toggleAboutContactModal,
}: CallLinkPendingParticipantModalProps): JSX.Element {
  const { serviceId } = conversation;

  const handleApprove = useCallback(() => {
    approveUser({ serviceId });
    onClose();
  }, [approveUser, onClose, serviceId]);

  const handleDeny = useCallback(() => {
    denyUser({ serviceId });
    onClose();
  }, [denyUser, onClose, serviceId]);

  return (
    <AxoTheme.Override theme="force-dark">
      <AxoDialog.Root open onOpenChange={onClose}>
        <AxoDialog.Content size="sm" escape="cancel-is-noop">
          <AxoDialog.Header>
            <AxoDialog.Title screenReaderOnly>
              {conversation.title}
            </AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <div className={tw('flex flex-col items-center text-center')}>
              <Avatar
                avatarUrl={conversation.avatarUrl}
                avatarPlaceholderGradient={
                  conversation.avatarPlaceholderGradient
                }
                badge={undefined}
                color={conversation.color}
                conversationType="direct"
                hasAvatar={conversation.hasAvatar}
                i18n={i18n}
                profileName={conversation.profileName}
                size={AvatarSize.EIGHTY}
                title={conversation.title}
                theme={ThemeType.dark}
              />

              <button
                type="button"
                className={tw('mt-3')}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleAboutContactModal({ contactId: conversation.id });
                }}
              >
                <div className={tw('type-title-large text-primary')}>
                  <UserText text={conversation.title} />
                  {isInSystemContacts(conversation) && (
                    <>
                      &nbsp;
                      <AxoContactName.SystemContactEmblem />
                    </>
                  )}
                  &nbsp;
                  <span className={tw('text-[20px] text-secondary')}>
                    <AxoSymbol.InlineGlyph
                      symbol="chevron-[end]"
                      label={null}
                    />
                  </span>
                </div>
              </button>

              <p className={tw('mt-2.5 text-secondary')}>
                {sharedGroupNames.length > 0 ? (
                  <SharedGroupNames
                    i18n={i18n}
                    sharedGroupNames={sharedGroupNames}
                  />
                ) : (
                  i18n('icu:no-groups-in-common-warning')
                )}
              </p>
            </div>

            <hr className={tw('my-6 border-primary')} />

            <div className={tw('flex flex-col gap-2')}>
              <AxoButton.Root
                size="md"
                width="full"
                variant="subtle-affirmative"
                symbol="check"
                onClick={handleApprove}
              >
                {i18n(
                  'icu:CallLinkPendingParticipantModal__ApproveButtonLabel'
                )}
              </AxoButton.Root>

              <AxoButton.Root
                size="md"
                width="full"
                variant="subtle-destructive"
                symbol="x"
                onClick={handleDeny}
              >
                {i18n('icu:CallLinkPendingParticipantModal__DenyButtonLabel')}
              </AxoButton.Root>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer />
        </AxoDialog.Content>
      </AxoDialog.Root>
    </AxoTheme.Override>
  );
}
