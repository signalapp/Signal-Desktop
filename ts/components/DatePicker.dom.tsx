// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
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
  Popover,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
} from 'react-aria-components';
import { Dialog as RadixDialog } from 'radix-ui';
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
      <Group
        className={tw(
          'flex min-w-0 flex-1 items-center rounded-lg border-[2.5px] border-transparent bg-primary px-2 py-0.5 keyboard-mode:focus-within:axo-focus-ring'
        )}
      >
        <DateInput className={tw('inline-flex items-center')}>
          {segment => (
            <DateSegment
              className={classNames(
                tw(
                  'inline-block px-px type-body-medium outline-none focus:bg-secondary'
                ),
                isDisabled ? tw('text-placeholder') : null
              )}
              segment={segment}
            />
          )}
        </DateInput>
        <Button
          className={classNames(
            tw('ms-auto p-0.5 outline-none focus-visible:bg-secondary'),
            isDisabled ? tw('text-placeholder') : null
          )}
        >
          <AxoSymbol.Icon size={14} symbol="calendar" label={null} />
        </Button>
      </Group>

      {/**
       * Radix UI and React Aria both have their own focus scope logic and
       * scroll locking behavior. We're sorta using Radix UI as a "decorator"
       * here to inform it of this other portaled element.
       *
       * React Aria does not appear to pass through all props the way that
       * Radix UI wants it to, but it does give Radix UI a ref and merges event
       * handlers well enough that this just works
       */}
      <RadixDialog.Root
        // This is not strictly necessary to sync open state, but it disables
        // Radix UI from doing anything while the popover is not open which
        // seems safer
        open={open}
        // We need this to act as a dialog or it won't render the <Overlay>
        modal
      >
        {/**
         * We need to render <Overlay> even though asChild+null prevents it
         * from creating any element because it contains the logic to break
         * <Content> out of scroll locking.
         */}
        <RadixDialog.Overlay asChild>{null}</RadixDialog.Overlay>
        <RadixDialog.Content
          // Merge behavior of radix <Dialog.Content> with react-aria's <Popover>
          asChild
          // Remove extra radix attributes that don't do anything
          aria-labelledby={undefined}
          data-state={undefined}
        >
          <Popover
            className={tw(
              'overflow-auto',
              'rounded-[10px] bg-surface-secondary shadow-elevation-1',
              'outline-none keyboard-mode:data-focused:axo-focus-ring'
            )}
          >
            <RadixDialog.Title className={tw('sr-only')}>
              {i18n('icu:DatePicker__popupTitle')}
            </RadixDialog.Title>
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
                          'outline-none keyboard-mode:data-focused:axo-focus-ring'
                        )}
                        date={date}
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </div>
            </Calendar>
          </Popover>
        </RadixDialog.Content>
      </RadixDialog.Root>
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
        'outline-none keyboard-mode:data-focused:axo-focus-ring'
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
