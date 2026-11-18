// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useId, useRef, useState, type JSX } from 'react';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Group,
  Heading,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
} from 'react-aria-components';
import { Popover } from 'radix-ui';
import type { CalendarDate } from '@internationalized/date';
import classNames from 'classnames';

import type { LocalizerType } from '../types/Util.std.ts';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

type AriaLabelPropsType =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-label'?: never; 'aria-labelledby': string };

export type PropsType = Readonly<{
  i18n: LocalizerType;
  isDisabled?: boolean;
  minValue?: CalendarDate;
  value: CalendarDate | null;
  onUpdateDate: (value: CalendarDate | null) => void;
}> &
  AriaLabelPropsType;

export function DatePicker(props: PropsType): JSX.Element {
  const { i18n, isDisabled = false, minValue, value, onUpdateDate } = props;
  const [open, setOpen] = useState(false);
  const popupTitleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleCloseAutoFocus = useCallback((event: Event) => {
    // The calendar button isn't a `Popover.Trigger` for Radix to focus
    event.preventDefault();
    buttonRef.current?.focus();
  }, []);

  return (
    <AriaDatePicker
      className={tw('flex min-w-0 flex-1')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      isDisabled={isDisabled}
      minValue={minValue}
      shouldForceLeadingZeros
      value={value}
      onChange={onUpdateDate}
      isOpen={open}
      onOpenChange={setOpen}
    >
      <Popover.Root open={open} onOpenChange={setOpen} modal>
        <Popover.Anchor asChild>
          <Group
            className={tw(
              'flex min-w-0 flex-1 items-center rounded-lg border-[2.5px] border-transparent bg-primary px-2 py-0.5 text-primary focus-visible-within:axo-focus-ring'
            )}
          >
            <DateInput className={tw('inline-flex items-center')}>
              {segment => (
                <DateSegment
                  className={classNames(
                    tw(
                      'inline-block px-px type-body-medium focus:bg-secondary focus-visible:outline-none'
                    ),
                    isDisabled ? tw('text-placeholder') : null
                  )}
                  segment={segment}
                />
              )}
            </DateInput>
            <Button
              ref={buttonRef}
              className={classNames(
                tw(
                  'ms-auto p-0.5 focus-visible:bg-secondary focus-visible:outline-none'
                ),
                isDisabled ? tw('text-placeholder') : null
              )}
            >
              <AxoSymbol.Icon size={14} symbol="calendar" label={null} />
            </Button>
          </Group>
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-labelledby={popupTitleId}
            onCloseAutoFocus={handleCloseAutoFocus}
            className={tw(
              'overflow-auto',
              'max-h-(--radix-popover-content-available-height)',
              'rounded-[10px] bg-surface-secondary shadow-elevation-1',
              'legacy-z-index-above-popup',
              'focus-visible:axo-focus-ring'
            )}
          >
            <h2 id={popupTitleId} className={tw('sr-only')}>
              {i18n('icu:DatePicker__popupTitle')}
            </h2>
            <Calendar className={tw('flex flex-col gap-2')}>
              <header
                className={tw(
                  'flex items-center justify-between gap-2 border-b border-primary p-2'
                )}
              >
                <ArrowButton slot="previous" />
                <Heading
                  className={tw('type-body-medium font-medium text-primary')}
                />
                <ArrowButton slot="next" />
              </header>
              <div className={tw('p-1.5')}>
                <CalendarGrid className={tw('w-full')} weekdayStyle="short">
                  <CalendarGridHeader>
                    {day => (
                      <CalendarHeaderCell
                        className={tw(
                          'type-body-small font-medium text-secondary'
                        )}
                      >
                        {day}
                      </CalendarHeaderCell>
                    )}
                  </CalendarGridHeader>
                  <CalendarGridBody>
                    {date => (
                      <CalendarCell
                        className={tw(
                          'flex h-8 w-9 items-center justify-center',
                          'rounded-lg text-center type-body-medium',
                          'text-primary',
                          'data-disabled:text-disabled',
                          'data-hovered:bg-primary',
                          'data-focused:bg-primary',
                          'data-today:font-semibold',
                          'data-selected:bg-secondary-pressed',
                          'focus-visible:outline-none data-focus-visible:axo-focus-ring'
                        )}
                        date={date}
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </div>
            </Calendar>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </AriaDatePicker>
  );
}

type ArrowButtonProps = Readonly<{
  slot: 'previous' | 'next';
}>;

function ArrowButton(props: ArrowButtonProps) {
  return (
    <Button
      slot={props.slot}
      className={tw(
        'flex items-center justify-center',
        'p-1',
        'rounded-full text-center type-body-medium',
        'font-medium text-primary',
        'data-disabled:text-disabled',
        'data-hovered:bg-primary',
        'data-focused:bg-primary',
        'data-selected:bg-secondary-pressed',
        'focus-visible:outline-none data-focus-visible:axo-focus-ring'
      )}
    >
      <AxoSymbol.Icon
        size={14}
        symbol={props.slot === 'previous' ? 'chevron-[start]' : 'chevron-[end]'}
        label={null}
      />
    </Button>
  );
}
