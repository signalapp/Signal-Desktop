// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode, Ref } from 'react';
import { memo, useMemo } from 'react';
import { css } from '../_internal/css.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AriaClickable } from '../AriaClickable.dom.tsx';
import { AxoBadge } from '../AxoBadge.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoOutgoingStatus } from '../message/AxoOutgoingStatus.dom.tsx';
import { AxoBaseChatItem } from './_AxoBaseChatItem.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoChatItem.Root>
 *   <AxoChatItem.Avatar>
 *     <AxoAvatar.Root /> or <AxoChatItem.IconAvatar />
 *   </AxoChatItem.Avatar>
 *   <AxoChatItem.Content>
 *     <AxoChatItem.Label />
 *     <AxoChatItem.LabelIcon />
 *     <AxoChatItem.Timestamp />
 *     <AxoChatItem.Description />
 *     <AxoChatItem.OutgoingStatus />
 *     <AxoChatItem.s />
 *   </AxoChatItem.Content>
 *   <AxoChatItem.Count />
 *   <AxoChatItem.HiddenTrigger />
 *   <AxoChatItem.Accessory />
 * </AxoChatItem.Root>
 * ```
 */
export namespace AxoChatItem {
  /**
   * <AxoChatItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { ref, children, ...rest } = props;
    return (
      <AxoBaseChatItem.Root
        ref={ref}
        compact={false}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoBaseChatItem.Root>
    );
  });

  Root.displayName = 'AxoChatItem.Root';

  /**
   * <AxoChatItem.Avatar>
   * --------------------------------------------------------------------------
   */

  export type AvatarProps = Readonly<{
    children: ReactNode;
  }>;

  export const Avatar: FC<AvatarProps> = memo(props => {
    return <AxoBaseChatItem.Avatar>{props.children}</AxoBaseChatItem.Avatar>;
  });

  Avatar.displayName = 'AxoChatItem.Avatar';

  /**
   * <AxoChatItem.IconAvatar>
   * --------------------------------------------------------------------------
   */

  export type IconAvatarProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const IconAvatar: FC<IconAvatarProps> = memo(props => {
    return <AxoBaseChatItem.IconAvatar size={48} symbol={props.symbol} />;
  });

  IconAvatar.displayName = 'AxoChatItem.IconAvatar';

  /**
   * <AxoChatItem.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    return <div className="axo-chat-item-content">{props.children}</div>;
  });

  Content.displayName = 'AxoChatItem.Content';

  /**
   * <AxoChatItem.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return <div className="axo-chat-item-label">{props.children}</div>;
  });

  Label.displayName = 'AxoChatItem.Label';

  /**
   * <AxoChatItem.LabelIcon>
   * --------------------------------------------------------------------------
   */

  export type LabelIconProps = Readonly<{
    symbol: AxoSymbol.Name;
    label: string | null;
  }>;

  export const LabelIcon: FC<LabelIconProps> = memo(props => {
    const { symbol, label } = props;
    return (
      <span className="axo-chat-item-label-icon">
        <AxoSymbol.Icon size={14} symbol={symbol} label={label} />
      </span>
    );
  });

  LabelIcon.displayName = 'AxoChatItem.LabelIcon';

  /**
   * <AxoChatItem.Timestamp>
   * --------------------------------------------------------------------------
   */

  export type TimestampProps = Readonly<{
    timestamp: number;
    children: ReactNode;
  }>;

  export const Timestamp: FC<TimestampProps> = memo(props => {
    const { timestamp, children } = props;
    const dateTime = useMemo(() => {
      return new Date(timestamp).toISOString();
    }, [timestamp]);
    return (
      <time dateTime={dateTime} className="axo-chat-item-timestamp">
        {children}
      </time>
    );
  });

  Timestamp.displayName = 'AxoChatItem.Timestamp';

  /**
   * <AxoChatItem.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <div dir="auto" className="axo-chat-item-description">
        {props.children}
      </div>
    );
  });

  Description.displayName = 'AxoChatItem.Description';

  /**
   * <AxoChatItem.OutgoingStatus>
   * --------------------------------------------------------------------------
   */

  export type OutgoingStatusProps = Readonly<{
    status: AxoOutgoingStatus.Status;
    label: string | null;
  }>;

  export const OutgoingStatus: FC<OutgoingStatusProps> = memo(props => {
    const { status, label } = props;
    return (
      <span
        className={css(
          'axo-chat-item-outgoing-status',
          status === 'error' && 'axo-chat-item-outgoing-status-error'
        )}
      >
        <AxoOutgoingStatus.Root status={status} label={label} />
      </span>
    );
  });

  OutgoingStatus.displayName = 'AxoChatItem.OutgoingStatus';

  /**
   * <AxoChatItem.Badges>
   * --------------------------------------------------------------------------
   */

  export type BadgesProps = AxoBaseChatItem.BadgesProps;

  export const Badges: FC<BadgesProps> = memo(props => {
    return <AxoBaseChatItem.Badges {...props} />;
  });

  Badges.displayName = 'AxoChatItem.Badges';

  /**
   * <AxoChatItem.HiddenTrigger>
   * --------------------------------------------------------------------------
   */

  export type HiddenTriggerProps = AxoBaseChatItem.HiddenTriggerProps;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    return <AxoBaseChatItem.HiddenTrigger {...props} />;
  });

  HiddenTrigger.displayName = 'AxoChatItem.HiddenTrigger';

  /**
   * <AxoChatItem.Count>
   * --------------------------------------------------------------------------
   */

  export type CountProps = Readonly<{
    count: number;
    label: string | null;
  }>;

  export const Count: FC<CountProps> = memo(props => {
    return (
      <div className="axo-chat-item-count">
        <AxoBadge.Root
          variant="secondary"
          size="md"
          value={props.count}
          max={AxoBaseChatItem.BADGE_MAX}
          label={props.label}
        />
      </div>
    );
  });

  Count.displayName = 'AxoChatItem.Count';

  /**
   * <AxoChatItem.Accessory>
   * --------------------------------------------------------------------------
   */

  export type AccessoryProps = Readonly<{
    children: ReactNode;
  }>;

  export const Accessory: FC<AccessoryProps> = memo(props => {
    return (
      <AriaClickable.SubWidget>
        <div className="axo-chat-item-accessory">{props.children}</div>
      </AriaClickable.SubWidget>
    );
  });

  Accessory.displayName = 'AxoChatItem.Accessory';
}
