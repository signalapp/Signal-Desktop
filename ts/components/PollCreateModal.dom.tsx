// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { v4 as generateUuid } from 'uuid';
import { tw } from '../axo/tw.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { AutoSizeTextArea } from './AutoSizeTextArea.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoSwitch } from '../axo/AxoSwitch.dom.js';
import { Toast } from './Toast.dom.js';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.js';
import { FunEmojiPickerButton } from './fun/FunButton.dom.js';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.js';
import { getEmojiVariantByKey } from './fun/data/emojis.std.js';
import { strictAssert } from '../util/assert.std.js';
import {
  type PollCreateType,
  POLL_QUESTION_MAX_LENGTH,
  POLL_OPTIONS_MIN_COUNT,
  POLL_OPTIONS_MAX_COUNT,
} from '../types/Polls.dom.js';
import { count as countGraphemes } from '../util/grapheme.std.js';
import { MAX_MESSAGE_BODY_BYTE_LENGTH } from '../util/longAttachment.std.js';

type PollOption = {
  id: string;
  value: string;
};

export type PollCreateModalProps = {
  i18n: LocalizerType;
  onClose: () => void;
  onSendPoll: (poll: PollCreateType) => void;
};

export function PollCreateModal({
  i18n,
  onClose,
  onSendPoll,
}: PollCreateModalProps): JSX.Element {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<Array<PollOption>>([
    { id: generateUuid(), value: '' },
    { id: generateUuid(), value: '' },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [emojiPickerOpenForOption, setEmojiPickerOpenForOption] = useState<
    string | null
  >(null);
  const [validationErrors, setValidationErrors] = useState<{
    question: boolean;
    options: boolean;
  }>({ question: false, options: false });
  const [validationErrorMessages, setValidationErrorMessages] =
    useState<Array<string> | null>(null);

  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefsMap = useRef<Map<string, HTMLTextAreaElement | null>>(
    new Map()
  );

  const computeOptionsAfterChange = useCallback(
    (
      updatedOptions: Array<PollOption>,
      changedOptionId: string
    ): { options: Array<PollOption>; removedIndex?: number } => {
      const resultOptions = [...updatedOptions];
      const changedIndex = resultOptions.findIndex(
        opt => opt.id === changedOptionId
      );
      const isLastOption = changedIndex === resultOptions.length - 1;
      const isSecondToLast = changedIndex === resultOptions.length - 2;
      const changedOption = resultOptions[changedIndex];
      const hasText = changedOption?.value.trim().length > 0;
      const canAddMore = resultOptions.length < POLL_OPTIONS_MAX_COUNT;
      const canRemove = resultOptions.length > POLL_OPTIONS_MIN_COUNT;
      let removedIndex: number | undefined;

      // Add new empty option when typing in the last option
      if (isLastOption && hasText && canAddMore) {
        resultOptions.push({ id: generateUuid(), value: '' });
      }

      // Remove the last option if second-to-last becomes empty and last is also empty
      if (isSecondToLast && !hasText && canRemove) {
        const lastOption = resultOptions[resultOptions.length - 1];
        const lastOptionEmpty = !lastOption?.value.trim();
        if (lastOptionEmpty) {
          resultOptions.pop();
          removedIndex = resultOptions.length;
        }
      }

      // Remove middle empty options
      if (!isLastOption && !hasText && canRemove) {
        resultOptions.splice(changedIndex, 1);
        removedIndex = changedIndex;

        // Ensure there's always an empty option at the end
        const lastOption = resultOptions[resultOptions.length - 1];
        const lastOptionEmpty = !lastOption || !lastOption.value.trim();
        if (!lastOptionEmpty && resultOptions.length < POLL_OPTIONS_MAX_COUNT) {
          resultOptions.push({ id: generateUuid(), value: '' });
        }
      }

      return { options: resultOptions, removedIndex };
    },
    []
  );

  const handleQuestionChange = useCallback(
    (value: string) => {
      setQuestion(value);
      if (validationErrors.question || validationErrors.options) {
        setValidationErrors({ question: false, options: false });
      }
    },
    [validationErrors]
  );

  const handleOptionChange = useCallback(
    (id: string, value: string) => {
      const updatedOptions = options.map(opt =>
        opt.id === id ? { ...opt, value } : opt
      );
      const result = computeOptionsAfterChange(updatedOptions, id);

      flushSync(() => {
        setOptions(result.options);
      });

      // Handle focus management if an option was removed
      if (result.removedIndex !== undefined) {
        const focusIndex = Math.min(
          result.removedIndex,
          result.options.length - 1
        );
        const targetOption = result.options[focusIndex];
        if (targetOption) {
          optionRefsMap.current.get(targetOption.id)?.focus();
        }
      }

      if (validationErrors.question || validationErrors.options) {
        setValidationErrors({ question: false, options: false });
      }
    },
    [computeOptionsAfterChange, validationErrors, options]
  );

  const handleEnterKey = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      event.preventDefault();

      const nextOption = options[currentIndex + 1];
      if (nextOption) {
        optionRefsMap.current.get(nextOption.id)?.focus();
      }
    },
    [options]
  );

  const handleSelectEmoji = useCallback(
    (optionId: string, emojiSelection: FunEmojiSelection) => {
      const inputEl = optionRefsMap.current.get(optionId);
      strictAssert(inputEl, 'Missing input ref for option');

      const { selectionStart, selectionEnd } = inputEl;
      const variant = getEmojiVariantByKey(emojiSelection.variantKey);
      const emoji = variant.value;

      const updatedOptions = options.map(opt => {
        if (opt.id !== optionId) {
          return opt;
        }

        let newValue: string;
        if (selectionStart == null || selectionEnd == null) {
          newValue = `${opt.value}${emoji}`;
        } else {
          const before = opt.value.slice(0, selectionStart);
          const after = opt.value.slice(selectionEnd);
          newValue = `${before}${emoji}${after}`;
        }

        // Don't insert if it would exceed the max grapheme length
        if (countGraphemes(newValue) > POLL_QUESTION_MAX_LENGTH) {
          return opt; // Return unchanged
        }

        return { ...opt, value: newValue };
      });

      const result = computeOptionsAfterChange(updatedOptions, optionId);
      setOptions(result.options);
    },
    [computeOptionsAfterChange, options]
  );

  const allowSend = useMemo(() => {
    if (question.trim()) {
      return true;
    }
    return options.some(opt => opt.value.trim());
  }, [question, options]);

  const validatePoll = useCallback((): {
    errors: Array<string>;
    hasQuestionError: boolean;
    hasOptionsError: boolean;
  } => {
    const questionErrors: Array<string> = [];
    const optionErrors: Array<string> = [];

    const questionValue = question.trim();
    if (!questionValue) {
      questionErrors.push(i18n('icu:PollCreateModal__Error--RequiresQuestion'));
    }
    if (Buffer.byteLength(questionValue) > MAX_MESSAGE_BODY_BYTE_LENGTH) {
      questionErrors.push(i18n('icu:PollCreateModal__Error--QuestionTooLong'));
    }

    const optionValues = options.map(opt => opt.value.trim());
    const nonEmptyOptions = optionValues.filter(value => value);
    if (nonEmptyOptions.length < POLL_OPTIONS_MIN_COUNT) {
      optionErrors.push(i18n('icu:PollCreateModal__Error--RequiresTwoOptions'));
    }
    const optionOverByteLength = optionValues.find(
      value => Buffer.byteLength(value) > MAX_MESSAGE_BODY_BYTE_LENGTH
    );
    if (optionOverByteLength) {
      optionErrors.push(i18n('icu:PollCreateModal__Error--OptionTooLong'));
    }

    return {
      errors: questionErrors.concat(optionErrors),
      hasQuestionError: questionErrors.length > 0,
      hasOptionsError: optionErrors.length > 0,
    };
  }, [question, options, i18n]);

  const handleSend = useCallback(() => {
    const validation = validatePoll();
    if (validation.errors.length > 0) {
      // Set validation error state for aria-invalid
      setValidationErrors({
        question: validation.hasQuestionError,
        options: validation.hasOptionsError,
      });

      // Show local toast with errors
      setValidationErrorMessages(validation.errors);

      // Focus the first invalid field
      if (validation.hasQuestionError) {
        questionInputRef.current?.focus();
      } else if (validation.hasOptionsError) {
        // Find first empty option or just focus the first option
        const firstEmptyOption = options.find(opt => !opt.value.trim());
        const targetOptionId = firstEmptyOption?.id ?? options[0]?.id;
        if (targetOptionId) {
          optionRefsMap.current.get(targetOptionId)?.focus();
        }
      }

      return;
    }

    const nonEmptyOptions = options
      .map(opt => opt.value.trim())
      .filter(value => value.length > 0);

    const poll: PollCreateType = {
      question: question.trim(),
      options: nonEmptyOptions,
      allowMultiple,
    };

    onSendPoll(poll);
  }, [validatePoll, question, options, allowMultiple, onSendPoll]);

  return (
    <Modal
      modalName="PollCreateModal"
      i18n={i18n}
      title={i18n('icu:PollCreateModal__title')}
      hasXButton
      onClose={onClose}
      noMouseClose
    >
      {/* Visually hidden error messages for screen readers */}
      <div id="poll-question-error" className={tw('sr-only')}>
        {i18n('icu:PollCreateModal__Error--RequiresQuestion')}
      </div>
      <div id="poll-options-error" className={tw('sr-only')}>
        {i18n('icu:PollCreateModal__Error--RequiresTwoOptions')}
      </div>

      <div className={tw('flex flex-col')}>
        <div className={tw('ms-2 mt-4')}>
          <div className={tw('type-body-medium font-semibold')}>
            {i18n('icu:PollCreateModal__questionLabel')}
          </div>

          <div className={tw('mt-5')}>
            <AutoSizeTextArea
              ref={questionInputRef}
              i18n={i18n}
              moduleClassName="PollCreateModalInput"
              value={question}
              onChange={handleQuestionChange}
              placeholder={i18n('icu:PollCreateModal__questionPlaceholder')}
              maxLengthCount={POLL_QUESTION_MAX_LENGTH}
              whenToShowRemainingCount={POLL_QUESTION_MAX_LENGTH - 30}
              aria-invalid={validationErrors.question || undefined}
              aria-errormessage={
                validationErrors.question ? 'poll-question-error' : undefined
              }
            />
          </div>

          <div className={tw('mt-5 type-body-medium font-semibold')}>
            {i18n('icu:PollCreateModal__optionsLabel')}
          </div>

          <div className={tw('mt-5 flex flex-col gap-4')}>
            {options.map((option, index) => (
              <div key={option.id}>
                <AutoSizeTextArea
                  ref={el => optionRefsMap.current.set(option.id, el)}
                  i18n={i18n}
                  moduleClassName="PollCreateModalInput"
                  value={option.value}
                  onChange={value => handleOptionChange(option.id, value)}
                  onEnter={e => handleEnterKey(e, index)}
                  placeholder={i18n('icu:PollCreateModal__optionPlaceholder', {
                    number: String(index + 1),
                  })}
                  maxLengthCount={POLL_QUESTION_MAX_LENGTH}
                  whenToShowRemainingCount={POLL_QUESTION_MAX_LENGTH - 30}
                  aria-invalid={validationErrors.options || undefined}
                  aria-errormessage={
                    validationErrors.options ? 'poll-options-error' : undefined
                  }
                >
                  <FunEmojiPicker
                    open={emojiPickerOpenForOption === option.id}
                    onOpenChange={open => {
                      setEmojiPickerOpenForOption(open ? option.id : null);
                    }}
                    onSelectEmoji={emojiSelection =>
                      handleSelectEmoji(option.id, emojiSelection)
                    }
                    closeOnSelect
                  >
                    <FunEmojiPickerButton i18n={i18n} />
                  </FunEmojiPicker>
                </AutoSizeTextArea>
              </div>
            ))}
          </div>
        </div>

        <div className={tw('mt-8 h-[0.5px] bg-border-primary')} />

        <label className={tw('mt-6 flex items-center gap-3')}>
          <span className={tw('grow type-body-large')}>
            {i18n('icu:PollCreateModal__allowMultipleVotes')}
          </span>
          <AxoSwitch.Root
            checked={allowMultiple}
            onCheckedChange={setAllowMultiple}
          />
        </label>

        <div
          className={tw('mt-3 flex min-h-[26px] items-center justify-center')}
        >
          {validationErrorMessages && (
            <div aria-hidden="true">
              <Toast onClose={() => setValidationErrorMessages(null)}>
                {validationErrorMessages[0]}
              </Toast>
            </div>
          )}
        </div>

        <div className={tw('mt-3 flex justify-end gap-3')}>
          <AxoButton.Root variant="secondary" size="lg" onClick={onClose}>
            {i18n('icu:cancel')}
          </AxoButton.Root>
          <AxoButton.Root
            variant="primary"
            size="lg"
            onClick={handleSend}
            disabled={!allowSend}
          >
            {i18n('icu:PollCreateModal__sendButton')}
          </AxoButton.Root>
        </div>
      </div>
    </Modal>
  );
}
