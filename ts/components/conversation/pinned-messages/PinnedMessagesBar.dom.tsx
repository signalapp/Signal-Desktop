// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, ReactNode } from 'react';
import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import { Tabs } from 'radix-ui';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { strictAssert } from '../../../util/assert.std.js';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.js';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.js';
import { AriaClickable } from '../../../axo/AriaClickable.dom.js';
import { UserText } from '../../UserText.dom.js';
import type { PinnedMessageId } from '../../../types/PinnedMessage.std.js';
import {
  MessageTextRenderer,
  RenderLocation,
} from '../MessageTextRenderer.dom.js';
import type { HydratedBodyRangesType } from '../../../types/BodyRange.std.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { stripNewlinesForLeftPane } from '../../../util/stripNewlinesForLeftPane.std.js';

export type PinMessageText = Readonly<{
  body: string;
  bodyRanges: HydratedBodyRangesType;
}>;

export type PinMessageAttachment = Readonly<
  | { type: 'image'; url: string | null }
  | { type: 'video'; url: string | null }
  | { type: 'voiceMessage' }
  | { type: 'gif' }
  | { type: 'file'; name: string | null }
>;

export type PinMessageContact = Readonly<{
  name: string | null;
}>;

export type PinMessagePoll = Readonly<{
  question: string;
}>;

export type PinMessage = Readonly<{
  id: string;
  text?: PinMessageText | null;
  attachment?: PinMessageAttachment | null;
  contact?: PinMessageContact | null;
  payment?: boolean;
  poll?: PinMessagePoll | null;
  sticker?: boolean;
}>;

export type PinSender = Readonly<{
  id: string;
  title: string;
  isMe: boolean;
}>;

export type Pin = Readonly<{
  id: PinnedMessageId;
  sender: PinSender;
  message: PinMessage;
}>;

export type PinnedMessagesBarProps = Readonly<{
  i18n: LocalizerType;
  pins: ReadonlyArray<Pin>;
  current: PinnedMessageId;
  onCurrentChange: (current: PinnedMessageId) => void;
  onPinGoTo: (messageId: string) => void;
  onPinRemove: (messageId: string) => void;
  onPinsShowAll: () => void;
  canPinMessages: boolean;
}>;

export const PinnedMessagesBar = memo(function PinnedMessagesBar(
  props: PinnedMessagesBarProps
) {
  const { i18n, onCurrentChange } = props;

  strictAssert(props.pins.length > 0, 'Must have at least one pin');

  const handleValueChange = useCallback(
    (value: string) => {
      onCurrentChange(Number(value) as PinnedMessageId);
    },
    [onCurrentChange]
  );

  if (props.pins.length === 1) {
    const pin = props.pins.at(0);
    strictAssert(pin != null, 'Missing pin');
    return (
      <Container i18n={i18n} pinsCount={props.pins.length}>
        <Content
          i18n={i18n}
          pin={pin}
          onPinGoTo={props.onPinGoTo}
          onPinRemove={props.onPinRemove}
          onPinsShowAll={props.onPinsShowAll}
          canPinMessages={props.canPinMessages}
        />
      </Container>
    );
  }

  return (
    <Tabs.Root
      orientation="vertical"
      value={String(props.current)}
      onValueChange={handleValueChange}
      asChild
      activationMode="manual"
    >
      <Container i18n={i18n} pinsCount={props.pins.length}>
        <TabsList
          i18n={i18n}
          pins={props.pins}
          current={props.current}
          onCurrentChange={props.onCurrentChange}
        />
        {props.pins.map(pin => {
          return (
            <Tabs.Content
              key={pin.id}
              tabIndex={-1}
              value={String(pin.id)}
              asChild
            >
              <Content
                i18n={i18n}
                pin={pin}
                onPinGoTo={props.onPinGoTo}
                onPinRemove={props.onPinRemove}
                onPinsShowAll={props.onPinsShowAll}
                canPinMessages={props.canPinMessages}
              />
            </Tabs.Content>
          );
        })}
      </Container>
    </Tabs.Root>
  );
});

function Container(props: {
  i18n: LocalizerType;
  pinsCount: number;
  children: ReactNode;
}) {
  const { i18n } = props;

  return (
    <section
      aria-label={i18n('icu:PinnedMessagesBar__AccessibilityLabel', {
        pinsCount: props.pinsCount,
      })}
    >
      <AriaClickable.Root
        className={tw(
          'flex h-14 items-center bg-background-primary py-2.5 pe-3 select-none',
          'rounded-xs',
          'outline-0 outline-border-focused',
          'data-[focused]:outline-[2.5px]',
          props.pinsCount === 1 && 'ps-4'
        )}
      >
        {props.children}
      </AriaClickable.Root>
    </section>
  );
}

function TabsList(props: {
  i18n: LocalizerType;
  pins: ReadonlyArray<Pin>;
  current: PinnedMessageId;
  onCurrentChange: (current: PinnedMessageId) => void;
}) {
  const { i18n } = props;

  strictAssert(props.pins.length >= 2, 'Too few pins for tabs');
  strictAssert(props.pins.length <= 3, 'Too many pins for tabs');

  return (
    <AriaClickable.SubWidget>
      <Tabs.List className={tw('flex h-full flex-col')}>
        {props.pins.map((pin, pinIndex) => {
          return (
            <TabTrigger
              key={pin.id}
              i18n={i18n}
              pin={pin}
              pinNumber={pinIndex + 1}
              pinsCount={props.pins.length}
            />
          );
        })}
      </Tabs.List>
    </AriaClickable.SubWidget>
  );
}

function TabTrigger(props: {
  i18n: LocalizerType;
  pin: Pin;
  pinNumber: number;
  pinsCount: number;
}) {
  const { i18n } = props;
  return (
    <Tabs.Trigger
      value={String(props.pin.id)}
      aria-label={i18n('icu:PinnedMessagesBar__Tab__AccessibilityLabel', {
        pinNumber: props.pinNumber,
      })}
      className={tw(
        'group flex-1 px-[7px] outline-0',
        props.pinsCount === 3 ? 'py-[1px]' : 'py-0.5'
      )}
    >
      <span
        className={tw(
          'block h-full w-0.5 rounded-full',
          'bg-label-disabled',
          'group-data-[state=active]:bg-label-primary',
          'outline-border-focused',
          'group-focused:outline-[2.5px]'
        )}
      />
    </Tabs.Trigger>
  );
}

type ContentProps = Readonly<{
  i18n: LocalizerType;
  pin: Pin;
  onPinGoTo: (messageId: string) => void;
  onPinRemove: (messageId: string) => void;
  onPinsShowAll: () => void;
  canPinMessages: boolean;
}>;

const Content = forwardRef(function Content(
  {
    i18n,
    pin,
    onPinGoTo,
    onPinRemove,
    onPinsShowAll,
    canPinMessages,
    ...forwardedProps
  }: ContentProps,
  ref: ForwardedRef<HTMLDivElement>
): JSX.Element {
  const handlePinGoTo = useCallback(() => {
    onPinGoTo(pin.message.id);
  }, [onPinGoTo, pin.message.id]);

  const handlePinRemove = useCallback(() => {
    onPinRemove(pin.message.id);
  }, [onPinRemove, pin.message.id]);

  const handlePinsShowAll = useCallback(() => {
    onPinsShowAll();
  }, [onPinsShowAll]);

  const thumbnailUrl = useMemo(() => {
    return getThumbnailUrl(pin.message);
  }, [pin.message]);

  return (
    <div
      ref={ref}
      {...forwardedProps}
      className={tw('flex min-w-0 flex-1 flex-row items-center')}
    >
      {thumbnailUrl != null && <ImageThumbnail url={thumbnailUrl} />}
      <div className={tw('min-w-0 flex-1')}>
        <h1 className={tw('type-body-small font-semibold text-label-primary')}>
          <UserText text={pin.sender.title} />
        </h1>
        <p className={tw('me-2 truncate type-body-medium text-label-primary')}>
          <MessagePreview i18n={i18n} message={pin.message} />
        </p>
        <AriaClickable.HiddenTrigger
          aria-label={i18n(
            'icu:PinnedMessagesBar__GoToMessageClickableArea__AccessibilityLabel'
          )}
          onClick={handlePinGoTo}
        />
      </div>
      <AriaClickable.SubWidget>
        <AxoDropdownMenu.Root>
          <AxoDropdownMenu.Trigger>
            <AxoIconButton.Root
              variant="borderless-secondary"
              size="md"
              symbol="pin"
              aria-label={i18n(
                'icu:PinnedMessagesBar__ActionsMenu__Button__AccessibilityLabel'
              )}
            />
          </AxoDropdownMenu.Trigger>
          <AxoDropdownMenu.Content>
            {canPinMessages && (
              <AxoDropdownMenu.Item
                symbol="pin-slash"
                onSelect={handlePinRemove}
              >
                {i18n('icu:PinnedMessagesBar__ActionsMenu__UnpinMessage')}
              </AxoDropdownMenu.Item>
            )}
            <AxoDropdownMenu.Item
              symbol="message-arrow"
              onSelect={handlePinGoTo}
            >
              {i18n('icu:PinnedMessagesBar__ActionsMenu__GoToMessage')}
            </AxoDropdownMenu.Item>
            <AxoDropdownMenu.Item
              symbol="list-bullet"
              onSelect={handlePinsShowAll}
            >
              {i18n('icu:PinnedMessagesBar__ActionsMenu__SeeAllMessages')}
            </AxoDropdownMenu.Item>
          </AxoDropdownMenu.Content>
        </AxoDropdownMenu.Root>
      </AriaClickable.SubWidget>
    </div>
  );
});

function getThumbnailUrl(message: PinMessage): string | null {
  if (message.attachment == null) {
    return null;
  }
  if (
    message.attachment.type === 'image' ||
    message.attachment.type === 'video'
  ) {
    return message.attachment.url ?? null;
  }
  return null;
}

function ImageThumbnail(props: { url: string }) {
  return (
    <img
      alt=""
      src={props.url}
      className={tw('me-2 size-8 rounded-[10px] object-cover')}
    />
  );
}

type PreviewIcon = Readonly<{
  symbol: AxoSymbol.InlineGlyphName;
  label: string;
}>;

function getMessagePreviewIcon(
  i18n: LocalizerType,
  message: PinMessage
): PreviewIcon | null {
  if (message.attachment != null) {
    if (message.attachment.type === 'voiceMessage') {
      return {
        symbol: 'audio',
        label: i18n(
          'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--VoiceMessage'
        ),
      };
    }
    if (message.attachment.type === 'gif') {
      return {
        symbol: 'gif',
        label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Gif'),
      };
    }
    if (message.attachment.type === 'file') {
      return {
        symbol: 'file',
        label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--File'),
      };
    }
  }
  if (message.contact != null) {
    return {
      symbol: 'person-circle',
      label: message.contact.name ?? i18n('icu:unknownContact'),
    };
  }
  if (message.payment) {
    return {
      symbol: 'creditcard',
      label: i18n(
        'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Payment'
      ),
    };
  }
  if (message.poll != null) {
    return {
      symbol: 'poll',
      label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Poll'),
    };
  }
  if (message.sticker) {
    return {
      symbol: 'sticker',
      label: i18n(
        'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Sticker'
      ),
    };
  }
  return null;
}

function getMessagePreviewText(
  i18n: LocalizerType,
  message: PinMessage
): ReactNode {
  if (message.text != null) {
    return <MessageTextPreview i18n={i18n} text={message.text} />;
  }
  if (message.attachment != null) {
    if (message.attachment.type === 'image') {
      return i18n('icu:PinnedMessagesBar__MessagePreview__Text--Photo');
    }
    if (message.attachment.type === 'video') {
      return i18n('icu:PinnedMessagesBar__MessagePreview__Text--Video');
    }
    if (message.attachment.type === 'voiceMessage') {
      return i18n('icu:PinnedMessagesBar__MessagePreview__Text--VoiceMessage');
    }
    if (message.attachment.type === 'gif') {
      return i18n('icu:PinnedMessagesBar__MessagePreview__Text--Gif');
    }
    if (message.attachment.type === 'file') {
      return <UserText text={message.attachment.name ?? ''} />;
    }
    throw missingCaseError(message.attachment);
  }
  if (message.contact?.name != null) {
    return <UserText text={message.contact.name} />;
  }
  if (message.payment != null) {
    return i18n('icu:PinnedMessagesBar__MessagePreview__Text--Payment');
  }
  if (message.poll != null) {
    return <UserText text={message.poll.question} />;
  }
  if (message.sticker != null) {
    return i18n('icu:PinnedMessagesBar__MessagePreview__Text--Sticker');
  }
  return null;
}

function MessagePreview(props: { i18n: LocalizerType; message: PinMessage }) {
  const { i18n, message } = props;

  const icon = useMemo(() => {
    return getMessagePreviewIcon(i18n, message);
  }, [i18n, message]);

  const text = useMemo(() => {
    return getMessagePreviewText(i18n, message);
  }, [i18n, message]);

  return (
    <>
      {icon != null && (
        <>
          <AxoSymbol.InlineGlyph symbol={icon.symbol} label={null} />{' '}
        </>
      )}
      {text}
    </>
  );
}

function MessageTextPreview(props: {
  i18n: LocalizerType;
  text: PinMessageText;
}) {
  const { i18n } = props;

  const messagePreview = useMemo(() => {
    return stripNewlinesForLeftPane(props.text.body);
  }, [props.text.body]);

  return (
    <MessageTextRenderer
      bodyRanges={props.text.bodyRanges}
      direction={undefined}
      disableLinks
      jumboEmojiSize={null}
      i18n={i18n}
      isSpoilerExpanded={{}}
      messageText={messagePreview}
      originalMessageText={props.text.body}
      onExpandSpoiler={undefined}
      onMentionTrigger={() => null}
      renderLocation={RenderLocation.PinnedMessagesBar}
      textLength={props.text.body.length}
    />
  );
}
