// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState } from 'react';
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

import type { EmojiVariantKey } from '../../fun/data/emojis.std.js';
import type {
  ConversationType,
  UpdateGroupMemberLabelType,
} from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.js';

export type PropsDataType = {
  existingLabelEmoji: string | undefined;
  existingLabelString: string | undefined;
  group: ConversationType;
  i18n: LocalizerType;
  me: ConversationType;
  ourColor: string | undefined;
  theme: ThemeType;
};

export type PropsType = PropsDataType & {
  getPreferredBadge: PreferredBadgeSelectorType;
  popPanelForConversation: () => void;
  updateGroupMemberLabel: UpdateGroupMemberLabelType;
};

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
  ourColor,
  popPanelForConversation,
  theme,
  updateGroupMemberLabel,
}: PropsType): React.JSX.Element {
  const messageContainer = useRef<HTMLDivElement | null>(null);

  const [labelEmoji, setLabelEmoji] = useState(existingLabelEmoji);
  const [labelString, setLabelString] = useState(existingLabelString);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const emojiKey = labelEmoji ? getEmojiVariantKey(labelEmoji) : null;
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    labelEmoji !== existingLabelEmoji || labelString !== existingLabelString;
  const canSave = Boolean(isDirty && labelString);
  const spinner = isSaving
    ? {
        'aria-label': i18n('icu:ConversationDetails--member-label--saving'),
      }
    : undefined;

  const contactLabelForMessage = labelString?.trim()
    ? { labelEmoji, labelString: labelString.trim() }
    : undefined;

  return (
    <div className={tw('mx-auto flex h-full max-w-[640px] flex-col')}>
      <div>
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

            // Remove trailing/leading whitespace, replace all whitespace with basic space
            setLabelString(value.replace(/\s/g, ' '));
          }}
          ref={undefined}
          placeholder={i18n(
            'icu:ConversationDetails--member-label--placeholder'
          )}
          value={labelString}
          whenToShowRemainingCount={20}
        />
      </div>
      <div className={tw('type-body-small text-label-secondary')}>
        {i18n('icu:ConversationDetails--member-label--description')}
      </div>
      <div className={tw('mt-[30px] type-body-medium font-semibold')}>
        {i18n('icu:ConversationDetails--member-label--preview')}
      </div>
      <div
        className={tw(
          'mt-5 rounded-[27px] bg-fill-primary-pressed px-2 pt-[47px] pb-6'
        )}
        ref={messageContainer}
      >
        <Message
          text={i18n('icu:ConversationDetails--member-label--hello')}
          author={{ ...me }}
          contactLabel={contactLabelForMessage}
          contactNameColor={ourColor}
          renderingContext="ConversationDetails/GroupMemberLabelEditor"
          theme={theme}
          id="fake-id"
          conversationColor={group.conversationColor ?? ConversationColors[0]}
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

      <div className={tw('mt-14 mb-3 flex w-full justify-end gap-2')}>
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
                labelString: labelString?.trim(),
              },
              {
                onSuccess() {
                  setIsSaving(false);
                  popPanelForConversation();
                },
                onFailure() {
                  // TODO: DESKTOP-9710
                },
              }
            );
          }}
        >
          {i18n('icu:save')}
        </AxoButton.Root>
      </div>
    </div>
  );
}
