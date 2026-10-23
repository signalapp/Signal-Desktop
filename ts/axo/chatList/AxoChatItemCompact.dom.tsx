// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode, Ref } from 'react';
import { memo } from 'react';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoBaseChatItem } from './_AxoBaseChatItem.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoChatItemCompact.Root>
 *   <AxoChatItemCompact.Avatar>
 *     <AxoAvatar.Root size={40} /> or <AxoChatItemCompact.IconAvatar />
 *     <AxoChatItemCompact.Badges />
 *   </AxoChatItemCompact.Avatar>
 *   <AxoChatItemCompact.HiddenTrigger />
 * </AxoChatItemCompact.Root>
 * ```
 */
export namespace AxoChatItemCompact {
  /**
   * <AxoChatItemCompact.Root>
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
        compact
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoBaseChatItem.Root>
    );
  });

  Root.displayName = 'AxoChatItemCompact.Root';

  /**
   * <AxoChatItemCompact.Avatar>
   * --------------------------------------------------------------------------
   */

  export type AvatarProps = Readonly<{
    children: ReactNode;
  }>;

  export const Avatar: FC<AvatarProps> = memo(props => {
    return <AxoBaseChatItem.Avatar>{props.children}</AxoBaseChatItem.Avatar>;
  });

  Avatar.displayName = 'AxoChatItemCompact.Avatar';

  /**
   * <AxoChatItemCompact.IconAvatar>
   * --------------------------------------------------------------------------
   */

  export type IconAvatarProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const IconAvatar: FC<IconAvatarProps> = memo(props => {
    return <AxoBaseChatItem.IconAvatar size={40} symbol={props.symbol} />;
  });

  IconAvatar.displayName = 'AxoChatItemCompact.IconAvatar';

  /**
   * <AxoChatItemCompact.Badges>
   * --------------------------------------------------------------------------
   */

  export type BadgesProps = AxoBaseChatItem.BadgesProps;

  export const Badges: FC<BadgesProps> = memo(props => {
    return <AxoBaseChatItem.Badges {...props} />;
  });

  Badges.displayName = 'AxoChatItemCompact.Badges';

  /**
   * <AxoChatItemCompact.HiddenTrigger>
   * --------------------------------------------------------------------------
   */

  export type HiddenTriggerProps = AxoBaseChatItem.HiddenTriggerProps;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    return <AxoBaseChatItem.HiddenTrigger {...props} />;
  });

  HiddenTrigger.displayName = 'AxoChatItemCompact.HiddenTrigger';
}
