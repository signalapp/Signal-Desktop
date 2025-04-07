// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePopper } from 'react-popper';
import { isEqual, noop } from 'lodash';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';
import {
  ReactionPickerPicker,
  ReactionPickerPickerEmojiButton,
  ReactionPickerPickerStyle,
} from './ReactionPickerPicker';
import { EmojiPicker } from './emoji/EmojiPicker';
import { DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES } from '../reactions/constants';
import { convertShortName } from './emoji/lib';
import { offsetDistanceModifier } from '../util/popperUtil';
import { handleOutsideClick } from '../util/handleOutsideClick';
import { EmojiSkinTone, getEmojiVariantByKey } from './fun/data/emojis';
import { FunEmojiPicker } from './fun/FunEmojiPicker';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis';
import { isFunPickerEnabled } from './fun/isFunPickerEnabled';

export type PropsType = {
  draftPreferredReactions: ReadonlyArray<string>;
  hadSaveError: boolean;
  i18n: LocalizerType;
  isSaving: boolean;
  originalPreferredReactions: ReadonlyArray<string>;
  recentEmojis: ReadonlyArray<string>;
  selectedDraftEmojiIndex: undefined | number;
  emojiSkinToneDefault: EmojiSkinTone | null;

  cancelCustomizePreferredReactionsModal(): unknown;
  deselectDraftEmoji(): unknown;
  onEmojiSkinToneDefaultChange: (emojiSkinToneDefault: EmojiSkinTone) => void;
  replaceSelectedDraftEmoji(newEmoji: string): unknown;
  resetDraftEmoji(): unknown;
  savePreferredReactions(): unknown;
  selectDraftEmojiToBeReplaced(index: number): unknown;
};

export function CustomizingPreferredReactionsModal({
  cancelCustomizePreferredReactionsModal,
  deselectDraftEmoji,
  draftPreferredReactions,
  emojiSkinToneDefault,
  hadSaveError,
  i18n,
  isSaving,
  onEmojiSkinToneDefaultChange,
  originalPreferredReactions,
  recentEmojis,
  replaceSelectedDraftEmoji,
  resetDraftEmoji,
  savePreferredReactions,
  selectDraftEmojiToBeReplaced,
  selectedDraftEmojiIndex,
}: Readonly<PropsType>): JSX.Element {
  const [referenceElement, setReferenceElement] =
    useState<null | HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [popperElement, setPopperElement] = useState<null | HTMLDivElement>(
    null
  );
  const emojiPickerPopper = usePopper(referenceElement, popperElement, {
    placement: 'bottom',
    modifiers: [
      offsetDistanceModifier(8),
      {
        name: 'preventOverflow',
        options: { altAxis: true },
      },
    ],
  });

  const isSomethingSelected = selectedDraftEmojiIndex !== undefined;

  useEffect(() => {
    if (!isSomethingSelected) {
      return noop;
    }

    return handleOutsideClick(
      target => {
        if (
          target instanceof Element &&
          target.closest('.FunPopover') != null
        ) {
          return true;
        }
        deselectDraftEmoji();
        return true;
      },
      {
        containerElements: [popperElement, pickerRef],
        name: 'CustomizingPreferredReactionsModal.draftEmoji',
      }
    );
  }, [isSomethingSelected, popperElement, deselectDraftEmoji]);

  const hasChanged = !isEqual(
    originalPreferredReactions,
    draftPreferredReactions
  );
  const canReset =
    !isSaving &&
    !isEqual(
      DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.map(shortName =>
        convertShortName(shortName, emojiSkinToneDefault ?? EmojiSkinTone.None)
      ),
      draftPreferredReactions
    );
  const canSave = !isSaving && hasChanged;

  const footer = (
    <>
      <Button
        disabled={!canReset}
        onClick={() => {
          resetDraftEmoji();
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === 'Space') {
            resetDraftEmoji();
          }
        }}
        variant={ButtonVariant.SecondaryAffirmative}
      >
        {i18n('icu:reset')}
      </Button>
      <Button
        disabled={!canSave}
        onClick={() => {
          savePreferredReactions();
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === 'Space') {
            savePreferredReactions();
          }
        }}
      >
        {i18n('icu:save')}
      </Button>
    </>
  );

  return (
    <Modal
      modalName="CustomizingPreferredReactionsModal"
      moduleClassName="module-CustomizingPreferredReactionsModal"
      hasXButton
      i18n={i18n}
      onClose={() => {
        cancelCustomizePreferredReactionsModal();
      }}
      title={i18n('icu:CustomizingPreferredReactions__title')}
      modalFooter={footer}
    >
      <div
        ref={pickerRef}
        className="module-CustomizingPreferredReactionsModal__small-emoji-picker-wrapper"
      >
        <ReactionPickerPicker
          isSomethingSelected={isSomethingSelected}
          pickerStyle={ReactionPickerPickerStyle.Menu}
          ref={setReferenceElement}
        >
          {draftPreferredReactions.map((emoji, index) => {
            return (
              <CustomizingPreferredReactionsModalItem
                // The index is the only thing that uniquely identifies the emoji, because
                //   there can be duplicates in the list.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                emoji={emoji}
                isSelected={index === selectedDraftEmojiIndex}
                onSelect={() => {
                  selectDraftEmojiToBeReplaced(index);
                }}
                onDeselect={() => {
                  deselectDraftEmoji();
                }}
                onSelectEmoji={emojiSelection => {
                  const emojiVariant = getEmojiVariantByKey(
                    emojiSelection.variantKey
                  );
                  replaceSelectedDraftEmoji(emojiVariant.value);
                }}
              />
            );
          })}
        </ReactionPickerPicker>
        {hadSaveError
          ? i18n('icu:CustomizingPreferredReactions__had-save-error')
          : i18n('icu:CustomizingPreferredReactions__subtitle')}
      </div>
      {!isFunPickerEnabled() && isSomethingSelected && (
        <div
          ref={setPopperElement}
          style={emojiPickerPopper.styles.popper}
          {...emojiPickerPopper.attributes.popper}
        >
          <EmojiPicker
            i18n={i18n}
            onPickEmoji={pickedEmoji => {
              const emoji = convertShortName(
                pickedEmoji.shortName,
                pickedEmoji.skinTone
              );
              replaceSelectedDraftEmoji(emoji);
            }}
            recentEmojis={recentEmojis}
            emojiSkinToneDefault={emojiSkinToneDefault}
            onEmojiSkinToneDefaultChange={onEmojiSkinToneDefaultChange}
            onClose={() => {
              deselectDraftEmoji();
            }}
            wasInvokedFromKeyboard={false}
          />
        </div>
      )}
    </Modal>
  );
}

function CustomizingPreferredReactionsModalItem(props: {
  emoji: string;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
}) {
  const { onDeselect } = props;

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleEmojiPickerOpenChange = useCallback(
    (open: boolean) => {
      setEmojiPickerOpen(open);
      if (!open) {
        onDeselect();
      }
    },
    [onDeselect]
  );

  const button = (
    <ReactionPickerPickerEmojiButton
      emoji={props.emoji}
      onClick={props.onSelect}
      isSelected={props.isSelected}
    />
  );

  if (isFunPickerEnabled()) {
    return (
      <FunEmojiPicker
        open={emojiPickerOpen}
        onOpenChange={handleEmojiPickerOpenChange}
        placement="bottom"
        onSelectEmoji={props.onSelectEmoji}
      >
        {button}
      </FunEmojiPicker>
    );
  }
  return button;
}
