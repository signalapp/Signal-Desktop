// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import { noop } from 'lodash';

import { Input } from '../../Input.dom.js';
import { FunEmojiPicker } from '../../fun/FunEmojiPicker.dom.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../../fun/data/emojis.std.js';
import { FunEmojiPickerButton } from '../../fun/FunButton.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';
import {
  STRING_BYTE_LIMIT,
  STRING_GRAPHEME_LIMIT,
} from '../../../types/GroupMemberLabels.std.js';
import {
  Message,
  MessageInteractivity,
  TextDirection,
} from '../Message.dom.js';
import { ConversationColors } from '../../../types/Colors.std.js';
import { WidthBreakpoint } from '../../_util.std.js';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.js';
import { SignalService as Proto } from '../../../protobuf/index.std.js';
import { Avatar, AvatarSize } from '../../Avatar.dom.js';
import { UserText } from '../../UserText.dom.js';
import { GroupMemberLabel } from '../ContactName.dom.js';
import { useConfirmDiscard } from '../../../hooks/useConfirmDiscard.dom.js';
import { NavTab } from '../../../types/Nav.std.js';
import { PanelType } from '../../../types/Panels.std.js';

import type { EmojiVariantKey } from '../../fun/data/emojis.std.js';
import type {
  ConversationType,
  UpdateGroupMemberLabelType,
} from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.js';
import type { Location } from '../../../types/Nav.std.js';
import { usePrevious } from '../../../hooks/usePrevious.std.js';

export type PropsDataType = {
  existingLabelEmoji: string | undefined;
  existingLabelString: string | undefined;
  group: ConversationType;
  i18n: LocalizerType;
  me: ConversationType;
  membersWithLabel: Array<{
    contactNameColor: string;
    isAdmin: boolean;
    labelEmoji: string | undefined;
    labelString: string;
    member: ConversationType;
  }>;
  ourColor: string | undefined;
  theme: ThemeType;
};

export type PropsType = PropsDataType & {
  getPreferredBadge: PreferredBadgeSelectorType;
  popPanelForConversation: () => void;
  updateGroupMemberLabel: UpdateGroupMemberLabelType;
};

// We don't want to render any panel behind it as we animate it in, if we weren't already
// showing the ConversationDetails pane.
export function getLeafPanelOnly(
  location: Location,
  conversationId: string | undefined
): boolean {
  return (
    !conversationId ||
    location.tab !== NavTab.Chats ||
    location.details.conversationId !== conversationId ||
    location.details.panels?.watermark === -1 ||
    location.details.panels?.stack[0]?.type !== PanelType.ConversationDetails
  );
}

function getEmojiVariantKey(value: string): EmojiVariantKey | undefined {
  if (isEmojiVariantValue(value)) {
    return getEmojiVariantKeyByValue(value);
  }

  return undefined;
}

export function GroupMemberLabelEditor({
  group,
  me,
  existingLabelEmoji,
  existingLabelString,
  getPreferredBadge,
  i18n,
  membersWithLabel,
  ourColor,
  popPanelForConversation,
  theme,
  updateGroupMemberLabel,
}: PropsType): React.JSX.Element {
  const [isShowingGeneralError, setIsShowingGeneralError] =
    React.useState(false);
  const [isShowingPermissionsError, setIsShowingPermissionsError] =
    React.useState(false);

  const messageContainer = useRef<HTMLDivElement | null>(null);

  const [labelEmoji, setLabelEmoji] = useState(existingLabelEmoji);
  const [labelString, setLabelString] = useState(existingLabelString);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const emojiKey = labelEmoji ? getEmojiVariantKey(labelEmoji) : null;
  const [isSaving, setIsSaving] = useState(false);

  const labelStringForSave = labelString ? labelString.trim() : labelString;
  const isDirty =
    (labelEmoji || undefined) !== (existingLabelEmoji || undefined) ||
    (labelStringForSave || undefined) !== (existingLabelString || undefined);
  const canSave =
    isDirty && ((!labelEmoji && !labelStringForSave) || labelStringForSave);
  const spinner = isSaving
    ? {
        'aria-label': i18n('icu:ConversationDetails--member-label--saving'),
      }
    : undefined;

  const contactLabelForMessage = labelStringForSave
    ? { labelEmoji, labelString: labelStringForSave }
    : undefined;

  useEffect(() => {
    if (
      !group.areWeAdmin &&
      group.accessControlAttributes ===
        Proto.AccessControl.AccessRequired.ADMINISTRATOR &&
      !isShowingPermissionsError
    ) {
      setIsShowingPermissionsError(true);
    }
  }, [group, isShowingPermissionsError, setIsShowingPermissionsError]);

  const tryClose = React.useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'GroupMemberLabelEditor',
    tryClose,
  });

  const onTryClose = React.useCallback(() => {
    const discardChanges = noop;
    confirmDiscardIf(isDirty, discardChanges);
  }, [confirmDiscardIf, isDirty]);
  tryClose.current = onTryClose;

  // Popping the panel here after a save is far safer; we may not have re-rendered with
  // the new existing values yet when the onSuccess callback down-file is called.
  const previousIsSaving = usePrevious(isSaving, isSaving);
  useEffect(() => {
    if (isSaving === false && previousIsSaving !== isSaving && !isDirty) {
      popPanelForConversation();
    }
  }, [isDirty, isSaving, popPanelForConversation, previousIsSaving]);

  return (
    <div className={tw('flex size-full flex-col')}>
      <div className={tw('grow flex-col overflow-y-scroll')}>
        <div className={tw('mx-auto max-w-[680px] px-5')}>
          <Input
            autoFocus
            hasClearButton
            i18n={i18n}
            icon={
              <FunEmojiPicker
                open={emojiPickerOpen}
                onOpenChange={(open: boolean) => setEmojiPickerOpen(open)}
                placement="bottom"
                onSelectEmoji={data => {
                  const newEmoji = getEmojiVariantByKey(data.variantKey)?.value;

                  setLabelEmoji(newEmoji);
                }}
                closeOnSelect
                theme={theme}
              >
                <FunEmojiPickerButton i18n={i18n} selectedEmoji={emojiKey} />
              </FunEmojiPicker>
            }
            maxLengthCount={STRING_GRAPHEME_LIMIT}
            maxByteCount={STRING_BYTE_LIMIT}
            moduleClassName="GroupMemberLabelEditor"
            onChange={value => {
              if (!value) {
                setLabelEmoji(undefined);
              }

              // Replace all whitespace with basic space
              setLabelString(value.replace(/\s/g, ' '));
            }}
            ref={undefined}
            placeholder={i18n(
              'icu:ConversationDetails--member-label--placeholder'
            )}
            value={labelString}
            whenToShowRemainingCount={20}
          />
          <div className={tw('type-body-small text-label-secondary')}>
            {i18n('icu:ConversationDetails--member-label--description')}
          </div>
          <div className={tw('mt-[30px] type-body-medium font-semibold')}>
            {i18n('icu:ConversationDetails--member-label--preview')}
          </div>
          <div
            className={tw(
              'mt-2.5 rounded-[27px] bg-fill-primary-pressed px-2 py-6'
            )}
            ref={messageContainer}
          >
            <Message
              text={i18n('icu:ConversationDetails--member-label--hello')}
              author={{ ...me, isMe: false }}
              contactLabel={contactLabelForMessage}
              contactNameColor={ourColor}
              renderingContext="ConversationDetails/GroupMemberLabelEditor"
              theme={theme}
              id="fake-id"
              conversationColor={
                group.conversationColor ?? ConversationColors[0]
              }
              conversationTitle={group.title}
              conversationId={group.id}
              textDirection={TextDirection.LeftToRight}
              isSelected={false}
              isSelectMode={false}
              isSMS={false}
              isVoiceMessagePlayed={false}
              direction="incoming"
              timestamp={Date.now()}
              conversationType="group"
              previews={[]}
              isPinned={false}
              canDeleteForEveryone={false}
              isBlocked={false}
              isMessageRequestAccepted={false}
              containerElementRef={messageContainer}
              containerWidthBreakpoint={WidthBreakpoint.Wide}
              i18n={i18n}
              interactivity={MessageInteractivity.Static}
              interactionMode="mouse"
              platform="unused"
              shouldCollapseAbove={false}
              shouldCollapseBelow={false}
              shouldHideMetadata={false}
              clearTargetedMessage={noop}
              getPreferredBadge={getPreferredBadge}
              renderAudioAttachment={() => <div />}
              doubleCheckMissingQuoteReference={noop}
              messageExpanded={noop}
              checkForAccount={noop}
              startConversation={noop}
              showConversation={noop}
              openGiftBadge={noop}
              pushPanelForConversation={noop}
              retryMessageSend={noop}
              sendPollVote={noop}
              endPoll={noop}
              showContactModal={noop}
              showSpoiler={noop}
              cancelAttachmentDownload={noop}
              kickOffAttachmentDownload={noop}
              markAttachmentAsCorrupted={noop}
              saveAttachment={noop}
              saveAttachments={noop}
              showLightbox={noop}
              showLightboxForViewOnceMedia={noop}
              scrollToQuotedMessage={noop}
              showAttachmentDownloadStillInProgressToast={noop}
              showExpiredIncomingTapToViewToast={noop}
              showExpiredOutgoingTapToViewToast={noop}
              showMediaNoLongerAvailableToast={noop}
              showTapToViewNotAvailableModal={noop}
              viewStory={noop}
              onToggleSelect={noop}
              onReplyToMessage={noop}
            />
          </div>
          <div
            className={tw('mt-[30px] mb-2.5 type-body-medium font-semibold')}
          >
            {i18n('icu:ConversationDetails--member-label--list-header')}
          </div>
          <div>
            {membersWithLabel.length === 0 && (
              <div className={tw('type-body-medium text-label-secondary')}>
                {i18n('icu:ConversationDetails--member-label--no-members')}
              </div>
            )}
            {membersWithLabel.map(membership => {
              const {
                contactNameColor,
                isAdmin,
                labelEmoji: memberLabelEmoji,
                labelString: memberLabelString,
                member,
              } = membership;

              return (
                <div
                  className={tw(
                    'flex w-full flex-row items-center overflow-hidden py-2'
                  )}
                  key={member.serviceId}
                >
                  <div className={tw('pe-3')}>
                    <Avatar
                      conversationType="direct"
                      badge={getPreferredBadge(member.badges)}
                      i18n={i18n}
                      size={AvatarSize.THIRTY_SIX}
                      theme={theme}
                      {...member}
                    />
                  </div>
                  <div
                    className={tw(
                      'flex grow flex-col items-start overflow-hidden'
                    )}
                  >
                    <div>
                      <UserText
                        text={member.isMe ? i18n('icu:you') : member.title}
                      />
                    </div>
                    {memberLabelString && contactNameColor && (
                      <div
                        className={tw(
                          'max-w-full min-w-0 overflow-hidden type-body-small'
                        )}
                      >
                        <GroupMemberLabel
                          contactNameColor={contactNameColor}
                          contactLabel={{
                            labelEmoji: memberLabelEmoji,
                            labelString: memberLabelString,
                          }}
                          context="list"
                        />
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className={tw('ms-2 text-label-secondary')}>
                      {i18n('icu:GroupV2--admin')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className={tw(
          'mx-auto flex w-full max-w-[680px] shrink-0 grow-0 justify-end gap-2 px-5 py-3 pe-6.5'
        )}
      >
        <AxoButton.Root
          variant="secondary"
          size="md"
          onClick={() => {
            popPanelForConversation();
          }}
        >
          {i18n('icu:cancel')}
        </AxoButton.Root>

        <AxoButton.Root
          variant="primary"
          size="md"
          experimentalSpinner={spinner}
          disabled={!canSave || isSaving}
          onClick={() => {
            setIsSaving(true);
            updateGroupMemberLabel(
              {
                conversationId: group.id,
                labelEmoji,
                labelString: labelStringForSave,
              },
              {
                onSuccess() {
                  setIsSaving(false);
                },
                onFailure() {
                  setIsSaving(false);
                  setIsShowingGeneralError(true);
                },
              }
            );
          }}
        >
          {i18n('icu:save')}
        </AxoButton.Root>
      </div>
      {confirmDiscardModal}
      <AxoAlertDialog.Root
        open={isShowingGeneralError}
        onOpenChange={value => {
          if (!value) {
            setIsShowingGeneralError(false);
          }
        }}
      >
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>
              {i18n('icu:ConversationDetails--member-label--error-title')}
            </AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              {i18n('icu:ConversationDetails--member-label--error-generic')}
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action
              variant="primary"
              arrow={false}
              onClick={() => {
                setIsShowingGeneralError(false);
              }}
            >
              {i18n('icu:ok')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
      <AxoAlertDialog.Root
        open={isShowingPermissionsError}
        onOpenChange={value => {
          if (!value) {
            setIsShowingPermissionsError(false);
            popPanelForConversation();
          }
        }}
      >
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>
              {i18n('icu:ConversationDetails--member-label--error-title')}
            </AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              {i18n('icu:ConversationDetails--member-label--error-permissions')}
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action
              variant="primary"
              arrow={false}
              onClick={() => {
                popPanelForConversation();
                setIsShowingPermissionsError(false);
              }}
            >
              {i18n('icu:ok')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    </div>
  );
}
