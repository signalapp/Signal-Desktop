// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { RemoteActionableMegaphoneType } from '../types/Megaphone.std.js';
import { tw } from '../axo/tw.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { offsetDistanceModifier } from '../util/popperUtil.std.js';

export type PropsType = Omit<RemoteActionableMegaphoneType, 'type'> & {
  isFullSize: boolean;
  i18n: LocalizerType;
};

export function RemoteMegaphone({
  i18n,
  title,
  body,
  imagePath,
  primaryCtaId,
  secondaryCtaId,
  primaryCtaText,
  secondaryCtaText,
  remoteMegaphoneId,
  isFullSize,
  onInteractWithMegaphone,
}: PropsType): React.JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  // We need to provide this to <Tooltip> to render correctly
  const wrapperClassName = tw(
    '@container flex flex-col',
    'max-w-[500px] rounded-lg border-1 border-border-primary p-3',
    isFullSize ? 'pe-2 pb-1.5' : 'size-[76px]',
    'bg-elevated-background-primary dark:bg-elevated-background-tertiary'
  );
  const image: React.JSX.Element = (
    <div className={tw('size-[48px] shrink-0 @min-[88px]:size-[64px]')}>
      <img
        alt=""
        className={tw('object-cover')}
        src={imagePath}
        width={64}
        height={64}
        draggable={false}
      />
    </div>
  );

  if (isFullSize) {
    return (
      <div className={wrapperClassName} aria-live="polite">
        <div className={tw('flex items-start gap-3')}>
          {image}
          <div className={tw('w-full')}>
            <h2 className={tw('mt-[3px] type-body-large font-semibold')}>
              {title}
            </h2>
            <p
              className={tw(
                'mt-[1px] mb-2 type-body-medium text-label-secondary'
              )}
            >
              {body}
            </p>
          </div>
        </div>
        <div className={tw('flex justify-end')}>
          {secondaryCtaId && (
            <AxoButton.Root
              size="md"
              variant="borderless-primary"
              onClick={() =>
                onInteractWithMegaphone(remoteMegaphoneId, secondaryCtaId)
              }
            >
              {secondaryCtaText}
            </AxoButton.Root>
          )}
          {primaryCtaId && (
            <AxoButton.Root
              size="md"
              variant="borderless-primary"
              onClick={() =>
                onInteractWithMegaphone(remoteMegaphoneId, primaryCtaId)
              }
            >
              {primaryCtaText}
            </AxoButton.Root>
          )}
        </div>
      </div>
    );
  }

  // Narrow collapsed sidebar
  // TODO: DESKTOP-9540
  const tooltipContent: React.JSX.Element = (
    <div className={tw('text-start text-label-primary')}>
      <h2 className={tw('mt-1 type-body-medium font-semibold')}>{title}</h2>
      <p className={tw('mt-1 mb-2 type-body-medium')}>{body}</p>
    </div>
  );

  return (
    <Tooltip
      content={tooltipContent}
      className="RemoteMegaphoneTooltip"
      wrapperClassName={wrapperClassName}
      direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
      popperModifiers={[offsetDistanceModifier(15)]}
    >
      <div className={tw('m-auto')}>{image}</div>
    </Tooltip>
  );
}
