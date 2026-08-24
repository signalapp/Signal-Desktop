// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState, type JSX } from 'react';
import type { CalendarDate } from '@internationalized/date';
import {
  getLocalTimeZone,
  Time,
  toCalendarDateTime,
  today,
} from '@internationalized/date';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { getDateTimeFormatter } from '../util/formatTimestamp.dom.ts';
import { DatePicker } from './DatePicker.dom.tsx';
import { getTimeDetails, TimePicker } from './TimePicker.dom.tsx';

const DEFAULT_DAYS_IN_FUTURE = 1;
const DEFAULT_TIME = 800;

export type PropsType = Readonly<{
  open: boolean;
  i18n: LocalizerType;
  onSubmit: (durationMs: number) => void;
  onClose: () => void;
}>;

export function MuteUntilDialog({
  open,
  i18n,
  onSubmit,
  onClose,
}: PropsType): JSX.Element {
  const [date, setDate] = useState<CalendarDate | null>(() => {
    return today(getLocalTimeZone()).add({ days: DEFAULT_DAYS_IN_FUTURE });
  });
  const [time, setTime] = useState(DEFAULT_TIME);

  const earliestDate = useMemo(() => {
    return today(getLocalTimeZone());
  }, []);

  const muteExpiresAt = useMemo(() => {
    return getTimestamp(date, time);
  }, [date, time]);

  const isValid = muteExpiresAt && muteExpiresAt > Date.now();

  const timeZoneNote = useMemo(() => {
    return i18n('icu:MuteUntilDialog__timeZoneNote', {
      timeZone: getTimeZoneDisplayName(),
    });
  }, [i18n]);

  const handleSubmit = useCallback(() => {
    if (muteExpiresAt == null) {
      return;
    }
    onSubmit(Math.max(0, muteExpiresAt - Date.now()));
  }, [muteExpiresAt, onSubmit]);

  return (
    <AxoDialog.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:MuteUntilDialog__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex items-center gap-2')}>
            <DatePicker
              i18n={i18n}
              aria-label={i18n('icu:MuteUntilDialog__dateLabel')}
              minValue={earliestDate}
              value={date}
              onUpdateDate={setDate}
            />
            <TimePicker
              i18n={i18n}
              aria-label={i18n('icu:MuteUntilDialog__timeLabel')}
              time={time}
              isDisabled={false}
              onUpdateTime={setTime}
            />
          </div>
          <div className={tw('mt-4 type-body-medium text-secondary')}>
            {timeZoneNote}
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="strong-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              disabled={!isValid}
              onClick={handleSubmit}
            >
              {i18n('icu:mute')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function getTimestamp(date: CalendarDate | null, time: number): number | null {
  if (date == null) {
    return null;
  }

  const { hours, minutes } = getTimeDetails(time, true);
  return toCalendarDateTime(date, new Time(hours, minutes))
    .toDate(getLocalTimeZone())
    .valueOf();
}

function getTimeZoneDisplayName(): string {
  const formatter = getDateTimeFormatter({ timeZoneName: 'longGeneric' });
  const timeZoneName = formatter
    .formatToParts(Date.now())
    .find(part => part.type === 'timeZoneName');

  return timeZoneName?.value ?? formatter.resolvedOptions().timeZone;
}
