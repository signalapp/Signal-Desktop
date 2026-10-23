// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useMemo } from 'react';
import { css } from '../_internal/css.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AriaClickable } from '../AriaClickable.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';
import { AxoBadge } from '../AxoBadge.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';

export namespace AxoBaseChatItem {
  /**
   * <AxoBaseChatItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    compact: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { ref, compact, children, ...rest } = props;
    return (
      <AriaClickable.Root asChild>
        <div
          ref={ref}
          className={css('axo-chat-item', compact && 'axo-chat-item-compact')}
          {...forwardExtraPropsForRadix(rest)}
        >
          <div className="axo-chat-item-inner">{children}</div>
        </div>
      </AriaClickable.Root>
    );
  });

  Root.displayName = 'AxoBaseChatItem.Root';

  /**
   * <AxoBaseChatItem.Avatar>
   * --------------------------------------------------------------------------
   */

  export type AvatarProps = Readonly<{
    children: ReactNode;
  }>;

  export const Avatar: FC<AvatarProps> = memo(props => {
    return <div className="axo-chat-item-avatar">{props.children}</div>;
  });

  Avatar.displayName = 'AxoBaseChatItem.Avatar';

  /**
   * <AxoBaseChatItem.IconAvatar>
   * --------------------------------------------------------------------------
   */

  export type IconAvatarProps = Readonly<{
    size: AxoAvatar.Size;
    symbol: AxoSymbol.Name;
  }>;

  export const IconAvatar: FC<IconAvatarProps> = memo(props => {
    return (
      <AxoAvatar.Root size={props.size}>
        <AxoAvatar.Content label={null}>
          <AxoAvatar.Icon symbol={props.symbol} />
        </AxoAvatar.Content>
      </AxoAvatar.Root>
    );
  });

  IconAvatar.displayName = 'AxoBaseChatItem.IconAvatar';

  /**
   * <AxoBaseChatItem.Badges>
   * --------------------------------------------------------------------------
   */

  export const BADGE_MAX = 999;

  export type BadgesProps = Readonly<{
    unreadCount: number;
    markedUnread: boolean;
    mentioned: boolean;
  }>;

  export const Badges: FC<BadgesProps> = memo(props => {
    const { unreadCount, markedUnread, mentioned } = props;

    const isEmpty = useMemo(() => {
      return unreadCount === 0 && !markedUnread && !mentioned;
    }, [unreadCount, markedUnread, mentioned]);

    const unreadValue = useMemo((): AxoBadge.Value | null => {
      if (unreadCount > 0) {
        return unreadCount;
      }
      if (markedUnread) {
        return 'unread';
      }
      return null;
    }, [unreadCount, markedUnread]);

    if (isEmpty) {
      return null;
    }

    return (
      <span
        className={css(
          'axo-chat-item-badges',
          mentioned && 'axo-chat-item-badges-mentioned'
        )}
      >
        {mentioned && (
          <span className="axo-chat-item-badge">
            <AxoBadge.Root
              variant="primary"
              size="md"
              value="mention"
              max={BADGE_MAX}
              label={null}
            />
          </span>
        )}
        {unreadValue != null && (
          <span className="axo-chat-item-badge">
            <AxoBadge.Root
              variant="primary"
              size="md"
              value={unreadValue}
              max={BADGE_MAX}
              label={null}
            />
          </span>
        )}
      </span>
    );
  });

  Badges.displayName = 'AxoBaseChatItem.Badges';

  /**
   * <AxoBaseChatItem.HiddenTrigger>
   * --------------------------------------------------------------------------
   */

  export type HiddenTriggerProps = Readonly<{
    ref?: Ref<HTMLButtonElement>;
    label?: string;
    labelledby?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    const { ref, label, labelledby, onClick, ...rest } = props;
    return (
      <AriaClickable.HiddenTrigger
        ref={ref}
        label={label}
        labelledby={labelledby}
        onClick={onClick}
        {...forwardExtraPropsForRadix(rest)}
      />
    );
  });

  HiddenTrigger.displayName = 'AxoBaseChatItem.HiddenTrigger';
}
