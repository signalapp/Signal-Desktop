// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent } from 'react';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { AxoDialog } from '../../../axo/AxoDialog.dom.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { AxoRadioGroup } from '../../../axo/AxoRadioGroup.dom.js';
import { DurationInSeconds } from '../../../util/durations/duration-in-seconds.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.js';
import { isInternalFeaturesEnabled } from '../../../util/isInternalFeaturesEnabled.dom.js';

enum DurationOption {
  TIME_24_HOURS = 'TIME_24_HOURS',
  TIME_7_DAYS = 'TIME_7_DAYS',
  TIME_30_DAYS = 'TIME_30_DAYS',
  FOREVER = 'FOREVER',
  DEBUG_10_SECONDS = 'DEBUG_10_SECONDS',
}

const DURATION_OPTIONS: Record<DurationOption, DurationInSeconds | null> = {
  [DurationOption.TIME_24_HOURS]: DurationInSeconds.fromHours(24),
  [DurationOption.TIME_7_DAYS]: DurationInSeconds.fromDays(7),
  [DurationOption.TIME_30_DAYS]: DurationInSeconds.fromDays(30),
  [DurationOption.FOREVER]: null,
  [DurationOption.DEBUG_10_SECONDS]: DurationInSeconds.fromSeconds(10),
};

enum Step {
  CLOSED,
  CONFIRM_REPLACE_OLDEST_PIN,
  SELECT_PIN_DURATION,
  DISAPPEARING_MESSAGES_WARNING,
}

function isValidDurationOption(value: string): value is DurationOption {
  return Object.hasOwn(DURATION_OPTIONS, value);
}

export type PinMessageDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  hasMaxPinnedMessages: boolean;
  isPinningDisappearingMessage: boolean;
  seenPinMessageDisappearingMessagesWarningCount: number;
  onSeenPinMessageDisappearingMessagesWarning: () => void;
  onPinnedMessageAdd: (
    messageId: string,
    duration: DurationInSeconds | null
  ) => void;
}>;

export const PinMessageDialog = memo(function PinMessageDialog(
  props: PinMessageDialogProps
) {
  const {
    i18n,
    onOpenChange,
    messageId,
    hasMaxPinnedMessages,
    isPinningDisappearingMessage,
    onPinnedMessageAdd,
    seenPinMessageDisappearingMessagesWarningCount,
    onSeenPinMessageDisappearingMessagesWarning,
  } = props;

  const needsConfirmReplaceOldestPin = useMemo(() => {
    return hasMaxPinnedMessages;
  }, [hasMaxPinnedMessages]);
  const needsConfirmDisappearingMessages = useMemo(() => {
    return (
      isPinningDisappearingMessage &&
      seenPinMessageDisappearingMessagesWarningCount <= 3
    );
  }, [
    isPinningDisappearingMessage,
    seenPinMessageDisappearingMessagesWarningCount,
  ]);

  const [duration, setDuration] = useState<DurationOption | null>(null);
  const [confirmedReplaceOldestPin, setConfirmedReplaceOldestPin] =
    useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      // reset state
      setDuration(null);
      setConfirmedReplaceOldestPin(false);
    },
    [onOpenChange]
  );

  const submit = useCallback(
    (selectedDuration: DurationOption) => {
      const durationValue = DURATION_OPTIONS[selectedDuration];
      onPinnedMessageAdd(messageId, durationValue);
      handleOpenChange(false);
    },
    [onPinnedMessageAdd, messageId, handleOpenChange]
  );

  const handleConfirmReplaceOldestPin = useCallback(() => {
    setConfirmedReplaceOldestPin(true);
  }, []);

  const handleSelectDuration = useCallback(
    (selectedDuration: DurationOption) => {
      setDuration(selectedDuration);
      if (!needsConfirmDisappearingMessages) {
        submit(selectedDuration);
      }
    },
    [needsConfirmDisappearingMessages, submit]
  );

  const handleConfirmDisappearingMessages = useCallback(() => {
    strictAssert(duration != null, 'Duration should not be null');
    onSeenPinMessageDisappearingMessagesWarning();
    submit(duration);
  }, [onSeenPinMessageDisappearingMessagesWarning, duration, submit]);

  let step: Step;
  if (!props.open) {
    step = Step.CLOSED;
  } else if (needsConfirmReplaceOldestPin && !confirmedReplaceOldestPin) {
    step = Step.CONFIRM_REPLACE_OLDEST_PIN;
  } else if (duration == null) {
    step = Step.SELECT_PIN_DURATION;
  } else if (needsConfirmDisappearingMessages) {
    step = Step.DISAPPEARING_MESSAGES_WARNING;
  } else {
    step = Step.CLOSED;
  }

  return (
    <>
      <PinMessageConfirmReplacePinDialog
        i18n={i18n}
        open={step === Step.CONFIRM_REPLACE_OLDEST_PIN}
        onOpenChange={handleOpenChange}
        onConfirmReplaceOldestPin={handleConfirmReplaceOldestPin}
      />
      <PinMessageSelectDurationDialog
        i18n={i18n}
        open={step === Step.SELECT_PIN_DURATION}
        onOpenChange={handleOpenChange}
        onSelectDuration={handleSelectDuration}
      />
      <PinMessageDisappearingMessagesWarningDialog
        i18n={i18n}
        open={step === Step.DISAPPEARING_MESSAGES_WARNING}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirmDisappearingMessages}
      />
    </>
  );
});

function PinMessageConfirmReplacePinDialog(props: {
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmReplaceOldestPin: () => void;
}) {
  const { i18n, onConfirmReplaceOldestPin } = props;
  const handleConfirmReplaceOldestPin = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      onConfirmReplaceOldestPin();
    },
    [onConfirmReplaceOldestPin]
  );
  return (
    <AxoAlertDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:PinMessageDialog--HasMaxPinnedMessages__Title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n('icu:PinMessageDialog--HasMaxPinnedMessages__Description')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>
            {i18n('icu:PinMessageDialog--HasMaxPinnedMessages__Cancel')}
          </AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action
            variant="primary"
            onClick={handleConfirmReplaceOldestPin}
          >
            {i18n('icu:PinMessageDialog--HasMaxPinnedMessages__Continue')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function PinMessageSelectDurationDialog(props: {
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDuration: (duration: DurationOption) => void;
}) {
  const { i18n, onOpenChange, onSelectDuration } = props;
  const [duration, setDuration] = useState(DurationOption.TIME_7_DAYS);

  const handleDurationChange = useCallback((value: string) => {
    strictAssert(isValidDurationOption(value), `Invalid option: ${value}`);
    setDuration(value);
  }, []);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = useCallback(() => {
    onSelectDuration(duration);
  }, [duration, onSelectDuration]);

  return (
    <AxoDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:PinMessageDialog__Title')}
          </AxoDialog.Title>
          <AxoDialog.Close aria-label={i18n('icu:PinMessageDialog__Close')} />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoRadioGroup.Root
            value={duration}
            onValueChange={handleDurationChange}
          >
            <AxoRadioGroup.Item value={DurationOption.TIME_24_HOURS}>
              <AxoRadioGroup.Indicator />
              <AxoRadioGroup.Label>
                {i18n('icu:PinMessageDialog__Option--TIME_24_HOURS')}
              </AxoRadioGroup.Label>
            </AxoRadioGroup.Item>
            <AxoRadioGroup.Item value={DurationOption.TIME_7_DAYS}>
              <AxoRadioGroup.Indicator />
              <AxoRadioGroup.Label>
                {i18n('icu:PinMessageDialog__Option--TIME_7_DAYS')}
              </AxoRadioGroup.Label>
            </AxoRadioGroup.Item>
            <AxoRadioGroup.Item value={DurationOption.TIME_30_DAYS}>
              <AxoRadioGroup.Indicator />
              <AxoRadioGroup.Label>
                {i18n('icu:PinMessageDialog__Option--TIME_30_DAYS')}
              </AxoRadioGroup.Label>
            </AxoRadioGroup.Item>
            <AxoRadioGroup.Item value={DurationOption.FOREVER}>
              <AxoRadioGroup.Indicator />
              <AxoRadioGroup.Label>
                {i18n('icu:PinMessageDialog__Option--FOREVER')}
              </AxoRadioGroup.Label>
            </AxoRadioGroup.Item>
            {isInternalFeaturesEnabled() && (
              <AxoRadioGroup.Item value={DurationOption.DEBUG_10_SECONDS}>
                <AxoRadioGroup.Indicator />
                <AxoRadioGroup.Label>10 seconds (Internal)</AxoRadioGroup.Label>
              </AxoRadioGroup.Item>
            )}
          </AxoRadioGroup.Root>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={handleCancel}>
              {i18n('icu:PinMessageDialog__Cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={handleConfirm}>
              {i18n('icu:PinMessageDialog__Pin')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function PinMessageDisappearingMessagesWarningDialog(props: {
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { i18n } = props;
  return (
    <AxoAlertDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:PinMessageDisappearingMessagesWarningDialog__Title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:PinMessageDisappearingMessagesWarningDialog__Description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action variant="primary" onClick={props.onConfirm}>
            {i18n('icu:PinMessageDisappearingMessagesWarningDialog__Okay')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
