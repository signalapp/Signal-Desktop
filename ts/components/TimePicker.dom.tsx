// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DateInput,
  DateSegment,
  Popover,
  TimeField,
} from 'react-aria-components';
import { Dialog as RadixDialog } from 'radix-ui';
import { Time } from '@internationalized/date';
import { range } from 'lodash';
import classNames from 'classnames';

import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import {
  getMidnight,
  scheduleToTime,
} from '../types/NotificationProfile.std.ts';
import { formatTimestamp } from '../util/formatTimestamp.dom.ts';
import { addLeadingZero } from '../util/timestamp.std.ts';
import { themeClassName2 } from '../util/theme.std.ts';

const FIVE_PM = 1700;
const HOURS_24 = range(0, 24);
const HOURS_12 = range(1, 13);
const MINUTES = range(0, 60);

export function formatTimeForDisplay(time: number): string {
  const midnight = getMidnight(Date.now());
  const ms = scheduleToTime(midnight, time);
  return formatTimestamp(ms, { timeStyle: 'short' });
}

function need24HourTime(): boolean {
  const formatted = formatTimeForDisplay(FIVE_PM);
  return formatted.includes('17');
}

function formatTimeForInput(time: number): Time {
  const { hours, minutes } = getTimeDetails(time, true);
  return new Time(hours, minutes);
}

function parseTimeFromInput(time: Time): number {
  return time.hour * 100 + time.minute;
}

type PERIOD = 'AM' | 'PM';
function hourTo24HourTime(hours: number, period: PERIOD) {
  if (period === 'AM' && hours === 12) {
    return 0;
  }
  if (period === 'AM') {
    return hours;
  }
  if (period === 'PM' && hours < 12) {
    return hours + 12;
  }

  return hours;
}
function hourFrom24HourTime(hours: number): { hours: number; period: PERIOD } {
  if (hours === 0) {
    return {
      hours: 12,
      period: 'AM',
    };
  }
  if (hours === 12) {
    return {
      hours: 12,
      period: 'PM',
    };
  }
  if (hours > 12) {
    return {
      hours: hours - 12,
      period: 'PM',
    };
  }
  return {
    hours,
    period: 'AM',
  };
}
function makeTime(
  rawHours: number,
  minutes: number,
  period: PERIOD | undefined
): number {
  if (!period) {
    return rawHours * 100 + minutes;
  }

  const hours = hourTo24HourTime(rawHours, period);
  return hours * 100 + minutes;
}

export function getTimeDetails(
  time: number,
  use24HourTime: boolean
): { hours: number; minutes: number; period: PERIOD | undefined } {
  const rawHours = Math.floor(time / 100);
  const minutes = time % 100;

  if (use24HourTime) {
    return { hours: rawHours, minutes, period: undefined };
  }

  const { hours, period } = hourFrom24HourTime(rawHours);
  return {
    hours,
    minutes,
    period,
  };
}

type AriaLabelPropsType =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-label'?: never; 'aria-labelledby': string };

export type PropsType = Readonly<{
  i18n: LocalizerType;
  isDisabled: boolean;
  theme?: ThemeType;
  time: number;
  onUpdateTime: (value: number) => void;
}> &
  AriaLabelPropsType;

export function TimePicker(props: PropsType): JSX.Element {
  const { i18n, isDisabled, theme, time, onUpdateTime } = props;
  const [isShowingPopup, setIsShowingPopup] = useState(false);
  const use24HourTime = need24HourTime();
  const AM_PM: Array<PERIOD> = ['AM', 'PM'];
  const periodLookup = useMemo(() => {
    return {
      AM: i18n('icu:NotificationProfile--am'),
      PM: i18n('icu:NotificationProfile--pm'),
    };
  }, [i18n]);
  const timeFieldRef = useRef<HTMLDivElement | null>(null);
  const { minutes, hours, period } = getTimeDetails(time, use24HourTime);
  const selectedHour = useRef<HTMLButtonElement | null>(null);
  const selectedMinute = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isShowingPopup) {
      return;
    }
    if (selectedHour.current) {
      selectedHour.current.focus();
    }
    if (selectedMinute.current) {
      selectedMinute.current.scrollIntoView();
    }
  }, [isShowingPopup]);

  return (
    <>
      {/* We wrap React Aria's Popover with a "dummy" RadixDialog to help them play nicely together. 
      See DatePicker for more info. */}
      <RadixDialog.Root open={isShowingPopup} modal>
        <RadixDialog.Overlay asChild>{null}</RadixDialog.Overlay>
        <RadixDialog.Content
          asChild
          aria-labelledby={undefined}
          data-state={undefined}
        >
          <Popover
            triggerRef={timeFieldRef}
            isOpen={isShowingPopup}
            onOpenChange={setIsShowingPopup}
            placement="bottom end"
            offset={6}
            className={classNames(
              'TimePickerPopup',
              tw(
                'flex h-[244px] rounded-[10px] bg-surface-secondary p-1 shadow-elevation-1'
              ),
              use24HourTime ? tw('w-[102px]') : tw('w-[150px]'),
              theme ? themeClassName2(theme) : undefined
            )}
          >
            {/* Radix warns without a title, and labels the popup with it */}
            <RadixDialog.Title className={tw('sr-only')}>
              {i18n('icu:TimePicker__popupTitle')}
            </RadixDialog.Title>
            <div
              className={tw('w-[46px] scrollbar-width-none overflow-y-scroll')}
            >
              {(use24HourTime ? HOURS_24 : HOURS_12).map(hour => {
                const isSelected = hour === hours;

                return (
                  <button
                    key={hour.toString()}
                    ref={isSelected ? selectedHour : null}
                    className={classNames(
                      tw(
                        'w-[46px] rounded-sm border-[2.5px] border-transparent py-[7px] type-body-medium outline-none keyboard-mode:focus:axo-focus-ring'
                      ),
                      isSelected ? tw('bg-primary') : null
                    )}
                    type="button"
                    onClick={() => {
                      const newTime = makeTime(hour, minutes, period);
                      onUpdateTime(newTime);
                    }}
                  >
                    {hour}
                  </button>
                );
              })}
            </div>
            <div
              className={tw(
                'ms-0.5 w-[46px] scrollbar-width-none overflow-y-scroll'
              )}
            >
              {MINUTES.map(minute => {
                const isSelected = minute === minutes;

                return (
                  <button
                    key={minute.toString()}
                    ref={isSelected ? selectedMinute : null}
                    className={classNames(
                      tw(
                        'w-[46px] rounded-sm border-[2.5px] border-transparent py-[7px] type-body-medium outline-none keyboard-mode:focus:axo-focus-ring'
                      ),
                      isSelected ? tw('bg-primary') : null
                    )}
                    type="button"
                    onClick={() => {
                      const newTime = makeTime(hours, minute, period);
                      onUpdateTime(newTime);
                    }}
                  >
                    {addLeadingZero(minute)}
                  </button>
                );
              })}
            </div>
            {!use24HourTime ? (
              <div
                className={tw(
                  'ms-0.5 w-[46px] scrollbar-width-none overflow-y-scroll'
                )}
              >
                {AM_PM.map(item => {
                  const isSelected = item === period;

                  return (
                    <button
                      key={item}
                      className={classNames(
                        tw(
                          'w-[46px] rounded-sm border-[2.5px] border-transparent py-[7px] type-body-medium outline-none keyboard-mode:focus:axo-focus-ring'
                        ),
                        isSelected ? tw('bg-primary') : null
                      )}
                      type="button"
                      onClick={() => {
                        const newTime = makeTime(hours, minutes, item);
                        onUpdateTime(newTime);
                      }}
                    >
                      {periodLookup[item]}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </Popover>
        </RadixDialog.Content>
      </RadixDialog.Root>

      <TimeField
        ref={timeFieldRef}
        className={tw(
          'flex items-center rounded-lg border-[2.5px] border-transparent bg-primary px-2 py-0.5 keyboard-mode:focus-within:axo-focus-ring'
        )}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        hourCycle={use24HourTime ? 24 : 12}
        isDisabled={isDisabled}
        minValue={new Time(0, 0)}
        maxValue={new Time(23, 59)}
        onChange={value => {
          if (!value) {
            return;
          }
          onUpdateTime(parseTimeFromInput(value));
        }}
        value={formatTimeForInput(time)}
      >
        <DateInput className={tw('inline-flex min-w-[5em] items-center')}>
          {segment => {
            if (segment.type === 'literal') {
              // We don't need the space between the time and the am/pm
              // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts#using_formattoparts
              if (segment.text === ' ') {
                return <span />;
              }
              // https://github.com/adobe/react-spectrum/blob/36fdd8bca2df281fa955117d946e6dd9718241e4/packages/react-stately/src/datepicker/useDateFieldState.ts#L443-L470
              if (segment.text === '\u2066' || segment.text === '\u2069') {
                return <span>{segment.text}</span>;
              }
              // oxlint-disable-next-line no-param-reassign
              segment.text = i18n('icu:NotificationProfile--time-separator');
            }
            return (
              <DateSegment
                className={classNames(
                  tw(
                    'inline-block px-px type-body-medium outline-none focus:bg-secondary'
                  ),
                  segment.type === 'literal' ? tw('px-[3px]') : null,
                  segment.type === 'dayPeriod' ? tw('ps-[2px]') : null,
                  segment.type === 'hour' ? tw('grow text-end') : null,
                  isDisabled ? tw('text-placeholder') : null
                )}
                segment={segment}
              />
            );
          }}
        </DateInput>
        <button
          className={classNames(
            tw('ms-3 p-0.5 outline-none focus-visible:bg-secondary'),
            isDisabled ? tw('text-placeholder') : null
          )}
          type="button"
          onClick={() => {
            if (isDisabled) {
              return;
            }
            setIsShowingPopup(!isShowingPopup);
          }}
        >
          <AxoSymbol.Icon
            size={14}
            symbol="chevron-down"
            label={i18n('icu:NotificationProfiles--open-time-picker')}
          />
        </button>
      </TimeField>
    </>
  );
}
