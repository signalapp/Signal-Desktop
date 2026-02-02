// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';

import { Input } from '../../Input.dom.js';
import { FunEmojiPicker } from '../../fun/FunEmojiPicker.dom.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../../fun/data/emojis.std.js';
import { FunEmojiPickerButton } from '../../fun/FunButton.dom.js';

import type { EmojiVariantKey } from '../../fun/data/emojis.std.js';
import type {
  ConversationType,
  UpdateGroupMemberLabelType,
} from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';

export type PropsDataType = {
  conversation: ConversationType;
  existingLabelEmoji: string | undefined;
  existingLabelString: string | undefined;
  i18n: LocalizerType;
  theme: ThemeType;
};

export type PropsType = PropsDataType & {
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
  conversation,
  existingLabelEmoji,
  existingLabelString,
  i18n,
  popPanelForConversation,
  theme,
  updateGroupMemberLabel,
}: PropsType): React.JSX.Element {
  const [labelEmoji, setLabelEmoji] = useState(existingLabelEmoji);
  const [labelString, setLabelString] = useState(existingLabelString);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const emojiKey = labelEmoji ? getEmojiVariantKey(labelEmoji) : null;
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    labelEmoji !== existingLabelEmoji || labelString !== existingLabelString;
  const spinner = isSaving
    ? {
        'aria-label': i18n('icu:ConversationDetails--member-label--saving'),
      }
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
          maxLengthCount={24}
          maxByteCount={96}
          moduleClassName="GroupMemberLabelEditor"
          onChange={value => {
            if (!value) {
              setLabelEmoji(undefined);
            }
            setLabelString(value);
          }}
          ref={undefined}
          placeholder={i18n(
            'icu:ConversationDetails--member-label--placeholder'
          )}
          value={labelString}
          whenToShowRemainingCount={20}
        />
      </div>
      <div className={tw('text-label-secondary')}>
        {i18n('icu:ConversationDetails--member-label--description')}
      </div>

      <div className={tw('flex-grow')} />
      <div className={tw('mb-3 flex w-full justify-end gap-2')}>
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
          disabled={!isDirty || isSaving}
          onClick={() => {
            setIsSaving(true);
            updateGroupMemberLabel(
              {
                conversationId: conversation.id,
                labelEmoji,
                labelString,
              },
              {
                onSuccess() {
                  setIsSaving(false);
                  popPanelForConversation();
                },
                onFailure() {
                  // TODO: DESKTOP-9698
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
