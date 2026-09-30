// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ReactNode, useCallback, useMemo, type JSX } from 'react';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.ts';
import { Avatar, AvatarBlur, AvatarSize } from '../Avatar.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { SharedGroupNames } from '../SharedGroupNames.dom.tsx';
import { About } from './About.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import { canHaveNicknameAndNote } from '../../util/nicknames.dom.ts';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.tsx';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.tsx';
import { missingEmojiPlaceholder } from '../../types/GroupMemberLabels.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';
import { AxoTextItem } from '../../axo/items/AxoTextItem.dom.tsx';
import { AxoClickableItem } from '../../axo/items/AxoClickableItem.dom.tsx';

function muted(parts: Array<string | JSX.Element>) {
  return (
    <span className="AboutContactModal__TitleWithoutNickname">{parts}</span>
  );
}

export type PropsType = Readonly<{
  i18n: LocalizerType;
  canAddLabel: boolean;
  contact: ConversationType;
  contactLabelEmoji: Emoji.Variant | undefined;
  contactLabelString: string | undefined;
  contactNameColor: string | undefined;
  fromOrAddedByTrustedContact?: boolean;
  isEditMemberLabelEnabled: boolean;
  isSignalConnection: boolean;
  onClose: () => void;
  onOpenNotePreviewModal: () => void;
  pendingAvatarDownload?: boolean;
  sharedGroupNames: ReadonlyArray<string>;
  showEditMemberLabelScreen: () => unknown;
  showProfileEditor: () => unknown;
  showQRCodeScreen: () => unknown;
  startAvatarDownload?: (id: string) => unknown;
  toggleSignalConnectionsModal: () => void;
  toggleSafetyNumberModal: (id: string) => void;
  toggleProfileNameWarningModal: () => void;
}>;

export function AboutContactModal({
  i18n,
  canAddLabel,
  contact,
  contactLabelEmoji,
  contactLabelString,
  contactNameColor,
  fromOrAddedByTrustedContact,
  isEditMemberLabelEnabled,
  isSignalConnection,
  pendingAvatarDownload,
  sharedGroupNames,
  showEditMemberLabelScreen,
  showProfileEditor,
  showQRCodeScreen,
  startAvatarDownload,
  toggleSignalConnectionsModal,
  toggleSafetyNumberModal,
  toggleProfileNameWarningModal,
  onClose,
  onOpenNotePreviewModal,
}: PropsType): JSX.Element {
  const { avatarUrl, hasAvatar, isMe } = contact;

  // If hasAvatar is true, we show the download button instead of blur
  const enableClickToLoad = !avatarUrl && !isMe && hasAvatar;

  const avatarBlur = enableClickToLoad
    ? AvatarBlur.BlurPictureWithClickToView
    : AvatarBlur.NoBlur;

  const avatarOnClick = useMemo(() => {
    if (!enableClickToLoad) {
      return undefined;
    }
    return () => {
      if (!pendingAvatarDownload && startAvatarDownload) {
        startAvatarDownload(contact.id);
      }
    };
  }, [
    contact.id,
    startAvatarDownload,
    enableClickToLoad,
    pendingAvatarDownload,
  ]);

  const onVerifiedClick = useCallback(() => {
    toggleSafetyNumberModal(contact.id);
  }, [toggleSafetyNumberModal, contact.id]);

  const onProfileNameWarningClick = useCallback(() => {
    toggleProfileNameWarningModal();
  }, [toggleProfileNameWarningModal]);

  let statusRow: JSX.Element | undefined;
  const hasLabel = contactNameColor && contactLabelString;
  const shouldShowLabel = isMe && hasLabel;
  const shouldShowAddLabel =
    isMe && !hasLabel && canAddLabel && isEditMemberLabelEnabled;

  if (isMe) {
    // No status for ourselves
  } else if (contact.isBlocked) {
    statusRow = (
      <AxoTextItem.Root
        symbol="block"
        label={i18n('icu:AboutContactModal__blocked', {
          name: contact.title,
        })}
      />
    );
  } else if (!contact.acceptedMessageRequest) {
    statusRow = (
      <AxoTextItem.Root
        symbol="message-badge"
        label={i18n('icu:AboutContactModal__message-request')}
      />
    );
  } else if (!contact.hasMessages && !contact.profileSharing) {
    statusRow = (
      <AxoTextItem.Root
        symbol="message-x"
        label={i18n('icu:AboutContactModal__no-dms', {
          name: contact.title,
        })}
      />
    );
  }

  const nameElement =
    canHaveNicknameAndNote(contact) &&
    contact.titleNoNickname !== contact.title &&
    contact.titleNoNickname ? (
      <span>
        <I18n
          i18n={i18n}
          id="icu:AboutContactModal__TitleAndTitleWithoutNickname"
          components={{
            nickname: <UserText text={contact.title} />,
            titleNoNickname: (
              <Tooltip
                className="AboutContactModal__TitleWithoutNickname__Tooltip"
                direction={TooltipPlacement.Top}
                content={
                  <I18n
                    i18n={i18n}
                    id="icu:AboutContactModal__TitleWithoutNickname__Tooltip"
                    components={{
                      title: <UserText text={contact.titleNoNickname} />,
                    }}
                  />
                }
                delay={0}
              >
                <UserText text={contact.titleNoNickname} />
              </Tooltip>
            ),
            muted,
          }}
        />
      </span>
    ) : (
      <UserText text={contact.title} />
    );

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title screenReaderOnly>
            {isMe
              ? i18n('icu:AboutContactModal__title--myself')
              : i18n('icu:AboutContactModal__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <div className={tw('mb-3.5 flex flex-col items-center')}>
            <Avatar
              avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
              avatarUrl={contact.avatarUrl}
              blur={avatarBlur}
              onClick={avatarOnClick}
              badge={undefined}
              color={contact.color}
              conversationType="direct"
              hasAvatar={contact.hasAvatar}
              i18n={i18n}
              loading={pendingAvatarDownload && !contact.avatarUrl}
              profileName={contact.profileName}
              size={AvatarSize.TWO_HUNDRED_SIXTEEN}
              title={contact.title}
            />
          </div>

          <AxoList.Group>
            <AxoList.Root>
              <AxoList.Body>
                <AxoItem.Group spacing="sm">
                  {isMe ? (
                    <AxoClickableItem.Root
                      symbol="person"
                      label={nameElement}
                      onClick={showProfileEditor}
                      arrow="next"
                    />
                  ) : (
                    <AxoTextItem.Root symbol="person" label={nameElement} />
                  )}
                  {!isMe && contact.about && (
                    <AxoTextItem.Root
                      symbol="pencil"
                      label={
                        <About
                          className="AboutContactModal__about"
                          text={contact.about}
                        />
                      }
                    />
                  )}
                  {!isMe && contact.isVerified && (
                    <AxoClickableItem.Root
                      symbol="shield-check"
                      label={i18n('icu:AboutContactModal__verified')}
                      onClick={onVerifiedClick}
                    />
                  )}
                  {!isMe && isSignalConnection && (
                    <AxoClickableItem.Root
                      symbol="connections"
                      label={i18n('icu:AboutContactModal__signal-connection')}
                      onClick={toggleSignalConnectionsModal}
                      arrow="next"
                    />
                  )}

                  {!isMe && isInSystemContacts(contact) && (
                    <AxoTextItem.Root
                      symbol="person-circle"
                      label={i18n('icu:AboutContactModal__system-contact', {
                        name:
                          contact.systemGivenName ||
                          contact.firstName ||
                          contact.title,
                      })}
                    />
                  )}

                  {!isMe && !fromOrAddedByTrustedContact && (
                    <AxoClickableItem.Root
                      symbol={
                        contact.type === 'group'
                          ? 'group-question'
                          : 'person-question'
                      }
                      label={
                        <I18n
                          components={{
                            clickable: (parts: ReactNode) => <>{parts}</>,
                          }}
                          i18n={i18n}
                          id={
                            contact.type === 'group'
                              ? 'icu:ConversationHero--group-names'
                              : 'icu:ConversationHero--profile-names'
                          }
                        />
                      }
                      onClick={onProfileNameWarningClick}
                      arrow="next"
                    />
                  )}

                  {shouldShowLabel && (
                    <AxoClickableItem.Root
                      symbol="label"
                      label={
                        <div className={tw('truncate')}>
                          {contactLabelEmoji != null && (
                            <>
                              <MemberLabelEmoji emoji={contactLabelEmoji} />
                              &nbsp;
                            </>
                          )}
                          <UserText
                            fontSizeOverride={14}
                            style={{
                              verticalAlign: 'top',
                              marginTop: '3px',
                            }}
                            text={contactLabelString}
                          />
                        </div>
                      }
                      disabled={!canAddLabel}
                      onClick={showEditMemberLabelScreen}
                    />
                  )}

                  {shouldShowAddLabel && (
                    <AxoClickableItem.Root
                      symbol="label"
                      label={i18n('icu:AboutContactModal__add-member-label')}
                      onClick={showEditMemberLabelScreen}
                      arrow="next"
                    />
                  )}

                  {isMe && contact.username && (
                    <AxoClickableItem.Root
                      symbol="qrcode"
                      label={i18n('icu:AboutContactModal__your-qr-code')}
                      onClick={showQRCodeScreen}
                    />
                  )}

                  {!isMe && contact.phoneNumber && (
                    <AxoTextItem.Root
                      symbol="phone"
                      label={<UserText text={contact.phoneNumber} />}
                    />
                  )}

                  {!isMe && (
                    <AxoTextItem.Root
                      symbol="group"
                      label={
                        <SharedGroupNames
                          i18n={i18n}
                          sharedGroupNames={sharedGroupNames}
                        />
                      }
                    />
                  )}

                  {contact.note && (
                    <AxoClickableItem.Root
                      symbol="note"
                      label={<UserText text={contact.note} />}
                      onClick={onOpenNotePreviewModal}
                    />
                  )}

                  {statusRow}
                </AxoItem.Group>
              </AxoList.Body>
            </AxoList.Root>
          </AxoList.Group>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function MemberLabelEmoji(props: { emoji: Emoji.Variant }): ReactNode {
  if (!Emoji.isEmoji(props.emoji)) {
    return missingEmojiPlaceholder;
  }
  return (
    <FunStaticEmoji
      role="img"
      aria-label={props.emoji}
      size={14}
      emoji={props.emoji}
    />
  );
}
