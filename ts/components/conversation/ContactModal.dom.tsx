// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { ReactNode } from 'react';

import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations.preload.js';
import type { BadgeType } from '../../badges/types.std.js';
import type { HasStories } from '../../types/Stories.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { ViewUserStoriesActionCreatorType } from '../../state/ducks/stories.preload.js';
import { StoryViewModeType } from '../../types/Stories.std.js';
import { createLogger } from '../../logging/log.std.js';
import { Avatar, AvatarBlur, AvatarSize } from '../Avatar.dom.js';
import { AvatarLightbox } from '../AvatarLightbox.dom.js';
import { BadgeDialog } from '../BadgeDialog.dom.js';
import { ConfirmationDialog } from '../ConfirmationDialog.dom.js';
import { Modal } from '../Modal.dom.js';
import { RemoveGroupMemberConfirmationDialog } from './RemoveGroupMemberConfirmationDialog.dom.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { UserText } from '../UserText.dom.js';
import { Button, ButtonIconType, ButtonVariant } from '../Button.dom.js';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';
import { InContactsIcon } from '../InContactsIcon.dom.js';
import { canHaveNicknameAndNote } from '../../util/nicknames.dom.js';
import { getThemeByThemeType } from '../../util/theme.std.js';
import {
  InAnotherCallTooltip,
  getTooltipContent,
} from './InAnotherCallTooltip.dom.js';
import type { ToggleGroupMemberLabelInfoModalType } from '../../state/ducks/globalModals.preload.js';
import type { ContactModalStateType } from '../../types/globalModals.std.js';
import { GroupMemberLabel } from './ContactName.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.js';
import { tw } from '../../axo/tw.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import type { RemoveClientType } from '../../types/Calling.std.js';
import type { ContactNameColorType } from '../../types/Colors.std.js';

const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

const log = createLogger('ContactModal');

export type PropsDataType = {
  activeCallDemuxId?: number;
  areWeASubscriber: boolean;
  areWeAdmin: boolean;
  badges: ReadonlyArray<BadgeType>;
  contact?: ConversationType;
  contactLabelEmoji: string | undefined;
  contactLabelString: string | undefined;
  contactNameColor: ContactNameColorType | undefined;
  conversation?: ConversationType;
  hasStories?: HasStories;
  readonly i18n: LocalizerType;
  isAdmin: boolean;
  isMember: boolean;
  isMuted: boolean;
  isRemoteMuteVisible: boolean;
  isRemoveFromCallVisible: boolean;
  theme: ThemeType;
  hasActiveCall: boolean;
  isInFullScreenCall: boolean;
};

type PropsActionType = {
  blockClientFromCall: (payload: RemoveClientType) => void;
  blockConversation: (id: string) => void;
  hideContactModal: () => void;
  onOpenEditNicknameAndNoteModal: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => unknown;
  onOutgoingVideoCallInConversation: (conversationId: string) => unknown;
  removeClientFromCall: (payload: RemoveClientType) => void;
  removeMemberFromGroup: (conversationId: string, contactId: string) => void;
  sendRemoteMute: (demuxId: number) => void;
  showConversation: ShowConversationType;
  startAvatarDownload: () => void;
  toggleAboutContactModal: (options: ContactModalStateType) => unknown;
  toggleAdmin: (conversationId: string, contactId: string) => void;
  toggleAddUserToAnotherGroupModal: (conversationId: string) => void;
  toggleGroupMemberLabelInfoModal: ToggleGroupMemberLabelInfoModalType;
  togglePip: () => void;
  toggleSafetyNumberModal: (conversationId: string) => unknown;
  viewUserStories: ViewUserStoriesActionCreatorType;
};

export type PropsType = PropsDataType & PropsActionType;

enum ContactModalView {
  Default,
  ShowingAvatar,
  ShowingBadges,
}

enum SubModalState {
  None = 'None',
  ToggleAdmin = 'ToggleAdmin',
  MemberRemove = 'MemberRemove',
  ConfirmingBlock = 'ConfirmingBlock',
  ConfirmingMute = 'ConfirmingMute',
  RemoveFromCall = 'RemoveFromCall',
}

export function ContactModal({
  activeCallDemuxId,
  areWeAdmin,
  areWeASubscriber,
  badges,
  blockClientFromCall,
  blockConversation,
  contact,
  contactLabelEmoji,
  contactLabelString,
  contactNameColor,
  conversation,
  hasActiveCall,
  hasStories,
  hideContactModal,
  isInFullScreenCall,
  i18n,
  isAdmin,
  isMember,
  isMuted,
  isRemoteMuteVisible,
  isRemoveFromCallVisible,
  onOpenEditNicknameAndNoteModal,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  removeClientFromCall,
  removeMemberFromGroup,
  sendRemoteMute,
  showConversation,
  startAvatarDownload,
  theme,
  toggleAboutContactModal,
  toggleAddUserToAnotherGroupModal,
  toggleAdmin,
  toggleGroupMemberLabelInfoModal,
  togglePip,
  toggleSafetyNumberModal,
  viewUserStories,
}: PropsType): React.JSX.Element {
  if (!contact) {
    throw new Error('Contact modal opened without a matching contact');
  }

  const [view, setView] = useState(ContactModalView.Default);
  const [subModalState, setSubModalState] = useState<SubModalState>(
    SubModalState.None
  );
  const modalTheme = getThemeByThemeType(theme);

  const renderQuickActions = React.useCallback(
    (conversationId: string) => {
      const inAnotherCallTooltipContent = hasActiveCall
        ? getTooltipContent(i18n)
        : undefined;
      const discouraged = hasActiveCall;

      const videoCallButton = (
        <Button
          icon={ButtonIconType.video}
          variant={ButtonVariant.Details}
          discouraged={discouraged}
          aria-label={inAnotherCallTooltipContent}
          onClick={() => {
            hideContactModal();
            onOutgoingVideoCallInConversation(conversationId);
          }}
        >
          {i18n('icu:video')}
        </Button>
      );
      const audioCallButton = (
        <Button
          icon={ButtonIconType.audio}
          variant={ButtonVariant.Details}
          discouraged={discouraged}
          aria-label={inAnotherCallTooltipContent}
          onClick={() => {
            hideContactModal();
            onOutgoingAudioCallInConversation(conversationId);
          }}
        >
          {i18n('icu:ContactModal--voice')}
        </Button>
      );

      return (
        <div className="ContactModal__quick-actions">
          <Button
            icon={ButtonIconType.message}
            variant={ButtonVariant.Details}
            onClick={() => {
              hideContactModal();
              showConversation({
                conversationId,
                switchToAssociatedView: true,
              });
              if (isInFullScreenCall) {
                togglePip();
              }
            }}
          >
            {i18n('icu:ConversationDetails__HeaderButton--Message')}
          </Button>
          {hasActiveCall ? (
            <InAnotherCallTooltip i18n={i18n}>
              {videoCallButton}
            </InAnotherCallTooltip>
          ) : (
            videoCallButton
          )}
          {hasActiveCall ? (
            <InAnotherCallTooltip i18n={i18n}>
              {audioCallButton}
            </InAnotherCallTooltip>
          ) : (
            audioCallButton
          )}
        </div>
      );
    },
    [
      hasActiveCall,
      hideContactModal,
      i18n,
      isInFullScreenCall,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      showConversation,
      togglePip,
    ]
  );

  let modalNode: ReactNode;
  switch (subModalState) {
    case SubModalState.None:
      modalNode = undefined;
      break;
    case SubModalState.ToggleAdmin:
      if (!conversation?.id) {
        log.warn('ToggleAdmin state - missing conversationId');
        modalNode = undefined;
        break;
      }

      if (
        isAdmin &&
        contactLabelString &&
        conversation.accessControlAttributes === ACCESS_ENUM.ADMINISTRATOR
      ) {
        modalNode = (
          <ConfirmationDialog
            dialogName="ContactModal.toggleAdmin"
            actions={[
              {
                action: () => toggleAdmin(conversation.id, contact.id),
                text: isAdmin
                  ? i18n('icu:ContactModal--rm-admin')
                  : i18n('icu:ContactModal--make-admin'),
                style: 'affirmative',
              },
            ]}
            i18n={i18n}
            onClose={() => setSubModalState(SubModalState.None)}
            title={i18n('icu:ContactModal--rm-admin-info', {
              contact: contact.title,
            })}
          >
            {i18n('icu:ContactModal--rm-admin--clear-label')}
          </ConfirmationDialog>
        );
        break;
      }

      modalNode = (
        <ConfirmationDialog
          dialogName="ContactModal.toggleAdmin"
          actions={[
            {
              action: () => toggleAdmin(conversation.id, contact.id),
              text: isAdmin
                ? i18n('icu:ContactModal--rm-admin')
                : i18n('icu:ContactModal--make-admin'),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setSubModalState(SubModalState.None)}
        >
          {isAdmin
            ? i18n('icu:ContactModal--rm-admin-info', {
                contact: contact.title,
              })
            : i18n('icu:ContactModal--make-admin-info', {
                contact: contact.title,
              })}
        </ConfirmationDialog>
      );
      break;
    case SubModalState.MemberRemove:
      if (!contact || !conversation?.id) {
        log.warn('MemberRemove state - missing contact or conversationId');
        modalNode = undefined;
        break;
      }

      modalNode = (
        <RemoveGroupMemberConfirmationDialog
          conversation={contact}
          group={conversation}
          i18n={i18n}
          onClose={() => {
            setSubModalState(SubModalState.None);
          }}
          onRemove={() => {
            removeMemberFromGroup(conversation?.id, contact.id);
          }}
        />
      );
      break;
    case SubModalState.ConfirmingBlock:
      modalNode = (
        <ConfirmationDialog
          dialogName="ContactModal.confirmBlock"
          actions={[
            {
              text: i18n('icu:MessageRequests--block'),
              action: () => blockConversation(contact.id),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setSubModalState(SubModalState.None)}
          title={i18n('icu:MessageRequests--block-direct-confirm-title', {
            title: contact.title,
          })}
        >
          {i18n('icu:MessageRequests--block-direct-confirm-body')}
        </ConfirmationDialog>
      );
      break;
    case SubModalState.ConfirmingMute:
      modalNode = (
        <ConfirmationDialog
          dialogName="ContactModal.confirmMute"
          actions={[
            {
              text: i18n('icu:ContactModal--confirm-mute-primary-button'),
              action: () => {
                strictAssert(
                  activeCallDemuxId != null,
                  'activeCallDemuxId must exist'
                );
                hideContactModal();
                sendRemoteMute(activeCallDemuxId);
              },
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setSubModalState(SubModalState.None)}
        >
          {i18n('icu:ContactModal--confirm-mute-body', {
            contact: contact.title,
          })}
        </ConfirmationDialog>
      );
      break;
    case SubModalState.RemoveFromCall:
      modalNode = (
        <ConfirmationDialog
          dialogName="CallingAdhocCallInfo.removeClientDialog"
          moduleClassName="CallingAdhocCallInfo__RemoveClientDialog"
          actions={[
            {
              action: () => {
                strictAssert(
                  activeCallDemuxId != null,
                  'activeCallDemuxId must exist'
                );
                hideContactModal();
                blockClientFromCall({ demuxId: activeCallDemuxId });
              },
              style: 'negative',
              text: i18n(
                'icu:CallingAdhocCallInfo__RemoveClientDialogButton--block'
              ),
            },
            {
              action: () => {
                strictAssert(
                  activeCallDemuxId != null,
                  'activeCallDemuxId must exist'
                );
                hideContactModal();
                removeClientFromCall({ demuxId: activeCallDemuxId });
              },
              style: 'negative',
              text: i18n(
                'icu:CallingAdhocCallInfo__RemoveClientDialogButton--remove'
              ),
            },
          ]}
          cancelText={i18n('icu:cancel')}
          i18n={i18n}
          onClose={() => setSubModalState(SubModalState.None)}
        >
          {i18n('icu:CallingAdhocCallInfo__RemoveClientDialogBody', {
            name: contact.title,
          })}
        </ConfirmationDialog>
      );
      break;
    default: {
      const state: never = subModalState;
      log.warn(`unexpected ${state}!`);
      modalNode = undefined;
      break;
    }
  }

  switch (view) {
    case ContactModalView.Default: {
      const preferredBadge: undefined | BadgeType = badges[0];
      return (
        <Modal
          modalName="ContactModal"
          moduleClassName="ContactModal__modal"
          hasXButton
          i18n={i18n}
          onClose={hideContactModal}
          padded={false}
          theme={modalTheme}
        >
          <div className="ContactModal">
            <Avatar
              avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
              avatarUrl={contact.avatarUrl}
              badge={preferredBadge}
              blur={
                !contact.avatarUrl && !contact.isMe && contact.hasAvatar
                  ? AvatarBlur.BlurPictureWithClickToView
                  : AvatarBlur.NoBlur
              }
              color={contact.color}
              conversationType="direct"
              hasAvatar={contact.hasAvatar}
              i18n={i18n}
              onClick={() => {
                if (conversation && hasStories) {
                  viewUserStories({
                    conversationId: contact.id,
                    storyViewMode: StoryViewModeType.User,
                  });
                  hideContactModal();
                } else if (
                  !contact.avatarUrl &&
                  !contact.isMe &&
                  contact.hasAvatar
                ) {
                  startAvatarDownload();
                } else {
                  setView(ContactModalView.ShowingAvatar);
                }
              }}
              onClickBadge={() => setView(ContactModalView.ShowingBadges)}
              profileName={contact.profileName}
              size={AvatarSize.EIGHTY}
              storyRing={hasStories}
              theme={theme}
              title={contact.title}
            />
            <button
              type="button"
              className="ContactModal__name"
              onClick={ev => {
                ev.preventDefault();
                toggleAboutContactModal({ contactId: contact.id });
              }}
            >
              <div className="ContactModal__name__text">
                <UserText text={contact.title} />
                {isInSystemContacts(contact) && (
                  <span>
                    {' '}
                    <InContactsIcon
                      className="ContactModal__name__contact-icon"
                      i18n={i18n}
                    />
                  </span>
                )}
              </div>
              <i className="ContactModal__name__chevron" />
            </button>
            {contactLabelString && contactNameColor && (
              <button
                type="button"
                className="ContactModal__member-label"
                onClick={() => {
                  if (conversation) {
                    toggleGroupMemberLabelInfoModal({
                      conversationId: conversation.id,
                    });
                  }
                }}
              >
                <GroupMemberLabel
                  emojiSize={14}
                  contactLabel={{
                    labelEmoji: contactLabelEmoji,
                    labelString: contactLabelString,
                  }}
                  contactNameColor={contactNameColor}
                  context="contact-modal"
                />
              </button>
            )}
            {!contact.isMe && renderQuickActions(contact.id)}
            <div className="ContactModal__divider" />
            <div className="ContactModal__button-container">
              {canHaveNicknameAndNote(contact) && (
                <button
                  type="button"
                  className="ContactModal__button ContactModal__block"
                  onClick={onOpenEditNicknameAndNoteModal}
                >
                  <div className="ContactModal__bubble-icon">
                    <div className="ContactModal__nickname__bubble-icon" />
                  </div>
                  <span>{i18n('icu:ContactModal--nickname')}</span>
                </button>
              )}

              {!contact.isMe &&
                (contact.isBlocked ? (
                  <div className="ContactModal__button ContactModal__block">
                    <div className="ContactModal__bubble-icon">
                      <div className="ContactModal__block__bubble-icon" />
                    </div>
                    <span>
                      {i18n('icu:AboutContactModal__blocked', {
                        name: contact.title,
                      })}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ContactModal__button ContactModal__block"
                    onClick={() =>
                      setSubModalState(SubModalState.ConfirmingBlock)
                    }
                  >
                    <div className="ContactModal__bubble-icon">
                      <div className="ContactModal__block__bubble-icon" />
                    </div>
                    <span>{i18n('icu:MessageRequests--block')}</span>
                  </button>
                ))}
              {!contact.isMe && (
                <button
                  type="button"
                  className="ContactModal__button ContactModal__safety-number"
                  onClick={() => {
                    hideContactModal();
                    toggleSafetyNumberModal(contact.id);
                  }}
                >
                  <div className="ContactModal__bubble-icon">
                    <div className="ContactModal__safety-number__bubble-icon" />
                  </div>
                  <span>{i18n('icu:showSafetyNumber')}</span>
                </button>
              )}
              {!contact.isMe && isMember && conversation?.id && (
                <button
                  type="button"
                  className="ContactModal__button"
                  onClick={() => {
                    hideContactModal();
                    toggleAddUserToAnotherGroupModal(contact.id);
                  }}
                >
                  <div className="ContactModal__bubble-icon">
                    <div className="ContactModal__add-to-another-group__bubble-icon" />
                  </div>
                  {i18n('icu:ContactModal--add-to-group')}
                </button>
              )}
              {!contact.isMe && areWeAdmin && isMember && conversation?.id && (
                <>
                  <button
                    type="button"
                    className="ContactModal__button ContactModal__make-admin"
                    onClick={() => setSubModalState(SubModalState.ToggleAdmin)}
                  >
                    <div className="ContactModal__bubble-icon">
                      <div className="ContactModal__make-admin__bubble-icon" />
                    </div>
                    {isAdmin ? (
                      <span>{i18n('icu:ContactModal--rm-admin')}</span>
                    ) : (
                      <span>{i18n('icu:ContactModal--make-admin')}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="ContactModal__button ContactModal__remove-from-group"
                    onClick={() => setSubModalState(SubModalState.MemberRemove)}
                  >
                    <div className="ContactModal__bubble-icon">
                      <div className="ContactModal__remove-from-group__bubble-icon" />
                    </div>
                    <span>{i18n('icu:ContactModal--remove-from-group')}</span>
                  </button>
                </>
              )}
              {isRemoteMuteVisible && (
                <button
                  type="button"
                  className="ContactModal__button"
                  onClick={() => setSubModalState(SubModalState.ConfirmingMute)}
                  disabled={isMuted}
                >
                  <AxoSymbol.Icon symbol="mic-slash" size={20} label={null} />
                  <span className={tw('ms-[12px]')}>
                    {i18n('icu:ContactModal--mute-audio')}
                  </span>
                </button>
              )}
              {isRemoveFromCallVisible && (
                <button
                  type="button"
                  className="ContactModal__button"
                  onClick={() => setSubModalState(SubModalState.RemoveFromCall)}
                >
                  <AxoSymbol.Icon
                    symbol="minus-circle"
                    size={20}
                    label={null}
                  />
                  <span className={tw('ms-[12px]')}>
                    {i18n('icu:ContactModal--remove-from-call')}
                  </span>
                </button>
              )}
            </div>
            {modalNode}
          </div>
        </Modal>
      );
    }
    case ContactModalView.ShowingAvatar:
      return (
        <AvatarLightbox
          avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
          avatarColor={contact.color}
          avatarUrl={contact.avatarUrl}
          conversationTitle={contact.title}
          hasAvatar={contact.hasAvatar}
          i18n={i18n}
          onClose={() => setView(ContactModalView.Default)}
        />
      );
    case ContactModalView.ShowingBadges:
      return (
        <BadgeDialog
          areWeASubscriber={areWeASubscriber}
          badges={badges}
          firstName={contact.firstName}
          i18n={i18n}
          onClose={() => setView(ContactModalView.Default)}
          title={contact.title}
        />
      );
    default:
      throw missingCaseError(view);
  }
}
