// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useState } from 'react';
import { AxoDialog } from '../../../axo/AxoDialog.dom.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { AxoRadioGroup } from '../../../axo/AxoRadioGroup.dom.js';
import { DurationInSeconds } from '../../../util/durations/duration-in-seconds.std.js';
import { strictAssert } from '../../../util/assert.std.js';

export enum DurationOption {
  TIME_24_HOURS = 'TIME_24_HOURS',
  TIME_7_DAYS = 'TIME_7_DAYS',
  TIME_30_DAYS = 'TIME_30_DAYS',
  FOREVER = 'FOREVER',
}
export type DurationValue =
  | { seconds: number; forever?: never }
  | { seconds?: never; forever: true };

const DURATION_OPTIONS: Record<DurationOption, DurationValue> = {
  [DurationOption.TIME_24_HOURS]: { seconds: DurationInSeconds.fromHours(24) },
  [DurationOption.TIME_7_DAYS]: { seconds: DurationInSeconds.fromDays(7) },
  [DurationOption.TIME_30_DAYS]: { seconds: DurationInSeconds.fromDays(30) },
  [DurationOption.FOREVER]: { forever: true },
};

function isValidDurationOption(value: string): value is DurationOption {
  return Object.hasOwn(DURATION_OPTIONS, value);
}

export type PinMessageDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  onPinMessage: (messageId: string, duration: DurationValue) => void;
}>;

export const PinMessageDialog = memo(function PinMessageDialog(
  props: PinMessageDialogProps
) {
  const { i18n, messageId, onPinMessage, onOpenChange } = props;
  const [duration, setDuration] = useState(DurationOption.TIME_7_DAYS);

  const handleValueChange = useCallback((value: string) => {
    strictAssert(isValidDurationOption(value), `Invalid option: ${value}`);
    setDuration(value);
  }, []);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePinMessage = useCallback(() => {
    const durationValue = DURATION_OPTIONS[duration];
    onPinMessage(messageId, durationValue);
  }, [duration, onPinMessage, messageId]);

  return (
    <AxoDialog.Root open={props.open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
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
          </AxoRadioGroup.Root>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={handleCancel}>
              {i18n('icu:PinMessageDialog__Cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={handlePinMessage}>
              {i18n('icu:PinMessageDialog__Pin')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
});
