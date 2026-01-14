// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent } from 'react';
import React, { memo, useCallback, useState } from 'react';
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

function isValidDurationOption(value: string): value is DurationOption {
  return Object.hasOwn(DURATION_OPTIONS, value);
}

export type PinMessageDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  hasMaxPinnedMessages: boolean;
  onPinnedMessageAdd: (
    messageId: string,
    duration: DurationInSeconds | null
  ) => void;
}>;

export const PinMessageDialog = memo(function PinMessageDialog(
  props: PinMessageDialogProps
) {
  const { i18n, messageId, onPinnedMessageAdd, onOpenChange } = props;
  const [duration, setDuration] = useState(DurationOption.TIME_7_DAYS);
  const [confirmedReplaceOldestPin, setConfirmedReplaceOldestPin] =
    useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      // reset state
      setConfirmedReplaceOldestPin(false);
      setDuration(DurationOption.TIME_7_DAYS);
    },
    [onOpenChange]
  );

  const handleConfirmReplaceOldestPin = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setConfirmedReplaceOldestPin(true);
  }, []);

  const handleValueChange = useCallback((value: string) => {
    strictAssert(isValidDurationOption(value), `Invalid option: ${value}`);
    setDuration(value);
  }, []);

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handlePinnedMessageAdd = useCallback(() => {
    const durationValue = DURATION_OPTIONS[duration];
    onPinnedMessageAdd(messageId, durationValue);
  }, [duration, onPinnedMessageAdd, messageId]);

  const showConfirmReplaceOldestPin =
    props.hasMaxPinnedMessages && !confirmedReplaceOldestPin;

  return (
    <>
      <AxoAlertDialog.Root
        open={props.open && showConfirmReplaceOldestPin}
        onOpenChange={handleOpenChange}
      >
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

      <AxoDialog.Root
        open={props.open && !showConfirmReplaceOldestPin}
        onOpenChange={handleOpenChange}
      >
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
              onValueChange={handleValueChange}
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
                  <AxoRadioGroup.Label>
                    10 seconds (Internal)
                  </AxoRadioGroup.Label>
                </AxoRadioGroup.Item>
              )}
            </AxoRadioGroup.Root>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action variant="secondary" onClick={handleCancel}>
                {i18n('icu:PinMessageDialog__Cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="primary"
                onClick={handlePinnedMessageAdd}
              >
                {i18n('icu:PinMessageDialog__Pin')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
    </>
  );
});
