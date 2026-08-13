// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  memo,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
  type MouseEvent,
  useId,
} from 'react';
import { tw } from '../tw.dom.tsx';
import type { SentTimestampMs } from '@signalapp/types';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { AxoExpireTimer } from './AxoExpireTimer.dom.tsx';

// TODO: We can add  author name and timestamp as invisible text in order to
// format the message nicely when copy and pasted
//
// function InvisibleCopyableText(props: { text: string }): ReactNode {
//   return (
//     <span
//       aria-hidden
//       className={tw(
//         'inline-block size-0 overflow-clip whitespace-pre select-text'
//       )}
//     >
//       {props.text}
//     </span>
//   );
// }

export namespace AxoMessage {
  export type Direction = 'incoming' | 'outgoing';

  type RootContextType = Readonly<{
    textId: string;
    metaId: string;
    direction: Direction;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoMessage.Root');

  /**
   * <AxoMessage.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    direction: Direction;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { direction } = props;
    const textId = useId();
    const metaId = useId();

    const context = useMemo((): RootContextType => {
      return { textId, metaId, direction };
    }, [textId, metaId, direction]);

    return (
      <RootContext value={context}>
        <article
          // TODO: Need to do more research on how to make this accessible, but
          // we should probably add `aria-roledescription="Message"`
          aria-labelledby={textId}
          className={tw(
            'flex w-full',
            'py-px',
            'justify-start',
            props.direction === 'incoming' && 'flex-row',
            props.direction === 'outgoing' && 'flex-row-reverse'
          )}
        >
          {props.children}
        </article>
      </RootContext>
    );
  });

  Root.displayName = 'AxoMessage.Root';

  /**
   * <AxoMessage.Bubble>
   * --------------------------------------------------------------------------
   */

  export type BubbleProps = Readonly<{
    collapseAbove: boolean;
    collapseBelow: boolean;
    children: ReactNode;
  }>;

  export const Bubble: FC<BubbleProps> = memo(props => {
    const context = useStrictContext(RootContext);
    return (
      <div
        className={tw(
          'relative',
          'overflow-clip',
          'flow-root', // clearfix for floating meta
          'w-fit',
          'max-w-[min(80ch,80%)]',
          'min-w-[25ch]',
          'px-3 py-1.5',

          props.collapseAbove && context.direction === 'incoming'
            ? 'rounded-ss-sm'
            : 'rounded-ss-2xl',

          props.collapseBelow && context.direction === 'incoming'
            ? 'rounded-es-sm'
            : 'rounded-es-2xl',

          props.collapseAbove && context.direction === 'outgoing'
            ? 'rounded-se-sm'
            : 'rounded-se-2xl',

          props.collapseBelow && context.direction === 'outgoing'
            ? 'rounded-ee-sm'
            : 'rounded-ee-2xl',

          context.direction === 'outgoing' &&
            'bg-surface-message-outgoing text-primary-oncolor',
          context.direction === 'incoming' &&
            'bg-surface-message-incoming text-primary'
        )}
      >
        {props.children}
      </div>
    );
  });

  Bubble.displayName = 'AxoMessage.Bubble';

  /**
   * <AxoMessage.DeletedBubble>
   * --------------------------------------------------------------------------
   */

  export type DeletedBubbleProps = Readonly<{
    direction: Direction;
    children: ReactNode;
  }>;

  export const DeletedBubble: FC<DeletedBubbleProps> = memo(props => {
    return (
      <div
        className={tw(
          'flow-root' // clearfix for floating meta
        )}
      >
        {props.children}
      </div>
    );
  });

  DeletedBubble.displayName = 'AxoMessage.DeletedBubble';

  /**
   * <AxoMessage.Text>
   * --------------------------------------------------------------------------
   */

  export type Text = Readonly<{
    body: string;
  }>;

  export type TextProps = Readonly<{
    text: Text;
  }>;

  export const Text: FC<TextProps> = memo(props => {
    const context = useStrictContext(RootContext);
    return (
      <span
        id={context.textId}
        className={tw(
          'type-body-large',
          'wrap-break-word',
          '[word-break:auto-phrase]',
          'whitespace-pre-wrap',
          'hyphens-auto',
          'select-text'
        )}
      >
        {props.text.body}
      </span>
    );
  });

  Text.displayName = 'AxoMessage.Text';

  /**
   * <AxoMessage.Meta>
   * --------------------------------------------------------------------------
   */

  export type MetaProps = Readonly<{
    children: ReactNode;
  }>;

  export const Meta: FC<MetaProps> = memo(props => {
    const context = useStrictContext(RootContext);

    return (
      <span className={tw('float-end align-baseline')}>
        &nbsp;
        <span
          id={context.metaId}
          className={tw(
            'inline-flex gap-[0.5ch] type-caption',
            context.direction === 'incoming' && 'text-secondary',
            context.direction === 'outgoing' && 'text-secondary-oncolor'
          )}
        >
          {props.children}
        </span>
      </span>
    );
  });

  Meta.displayName = 'AxoMessage.Meta';

  /**
   * <AxoMessage.MetaSentTimestamp>
   * --------------------------------------------------------------------------
   */

  export type MetaTimestampProps = Readonly<{
    sentAt: SentTimestampMs;
    // TODO: Once we have axo utils for formatting date times we should just
    // automatically render a relative time here
    children: ReactNode;
  }>;

  export const MetaTimestamp: FC<MetaTimestampProps> = memo(props => {
    const { sentAt } = props;

    const isoFormat = useMemo(() => {
      return new Date(sentAt).toISOString();
    }, [sentAt]);

    return (
      <time dateTime={isoFormat} className={tw('min-w-[3.5ch] text-end')}>
        {props.children}
      </time>
    );
  });

  MetaTimestamp.displayName = 'AxoMessage.MetaSentTimestamp';

  /**
   * <AxoMessage.MetaExpireTimer>
   * --------------------------------------------------------------------------
   */

  export type MetaExpireTimerProps = Readonly<{
    expireTimer: AxoExpireTimer.ExpireTimer;
  }>;

  export const MetaExpireTimer: FC<MetaExpireTimerProps> = memo(props => {
    return <AxoExpireTimer.Root expireTimer={props.expireTimer} />;
  });

  MetaExpireTimer.displayName = 'AxoMessage.MetaExpireTimer';

  /**
   * <AxoMessage.MetaOutgoingStatus>
   * --------------------------------------------------------------------------
   */

  export type OutgoingStatus = 'sending' | 'sent' | 'delivered' | 'read';

  const OutgoingStatusSymbols = variants<OutgoingStatus, AxoSymbol.Name>(
    'AxoMessage.OutgoingStatus',
    {
      sending: 'ticks',
      sent: 'check-circle',
      delivered: 'check-circle-on-check-circle',
      read: 'check-circle-on-check-circle-fill',
    }
  );

  export type MetaOutgoingStatusProps = Readonly<{
    status: OutgoingStatus;
  }>;

  // TODO: Pull this into its own component so it can be used in other places like message details
  export const MetaOutgoingStatus: FC<MetaOutgoingStatusProps> = memo(props => {
    const inlineGlyph = (
      <AxoSymbol.InlineGlyph
        symbol={OutgoingStatusSymbols.get(props.status)}
        label={null}
      />
    );

    return (
      <span
        // TODO: Need to do more research on the best way to make this accessible
        // but maybe something like adding role="status"` `aria-live={false}`,
        // and `aria-label` for each status
        className={tw(props.status === 'sending' && 'animate-spin')}
      >
        {inlineGlyph}
      </span>
    );
  });

  MetaOutgoingStatus.displayName = 'AxoMessage.MetaOutgoingStatus';

  /**
   * <AxoMessage.MetaAction>
   * --------------------------------------------------------------------------
   */

  export type MetaActionProps = Readonly<{
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  export const MetaAction: FC<MetaActionProps> = memo(props => {
    const { onClick } = props;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick(event);
      },
      [onClick]
    );

    return (
      <button
        type="button"
        onClick={handleClick}
        className={tw(
          'rounded-xs outline-0 keyboard-mode:focus:axo-focus-ring'
        )}
      >
        {props.children}
      </button>
    );
  });

  MetaAction.displayName = 'AxoMessage.MetaAction';
}
