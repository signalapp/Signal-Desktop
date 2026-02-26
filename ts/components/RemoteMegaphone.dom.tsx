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
  onClickNarrowMegaphone: () => void;
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
  onClickNarrowMegaphone,
  onInteractWithMegaphone,
}: PropsType): React.JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  // We need to provide this to <Tooltip> to render correctly
  const wrapperClassName = tw(
    '@container flex flex-col',
    'max-w-[500px] curved-3xl p-3',
    'bg-elevated-background-primary dark:bg-elevated-background-tertiary',
    'shadow-elevation-1',
    isFullSize ? '' : 'size-[76px]'
  );
  const image: React.JSX.Element = (
    <div
      className={tw(
        'size-[48px] shrink-0',
        isFullSize ? 'size-[56px]' : 'm-auto'
      )}
    >
      <img
        alt=""
        className={tw('object-cover')}
        src={imagePath}
        width={56}
        height={56}
        draggable={false}
      />
    </div>
  );

  if (isFullSize) {
    return (
      <div
        className={wrapperClassName}
        aria-live="polite"
        data-testid="RemoteMegaphone"
      >
        <div className={tw('flex items-start gap-3')}>
          {image}
          <div className={tw('w-full')}>
            <h2
              className={tw(
                'mt-[2px] type-body-medium font-semibold text-label-primary select-none'
              )}
            >
              {title}
            </h2>
            <p
              className={tw(
                'mt-[2px] type-body-small text-label-secondary select-none'
              )}
            >
              {body}
            </p>
          </div>
        </div>
        <div className={tw('mt-3 flex justify-end')}>
          <div className={tw('flex flex-wrap-reverse gap-1.5')}>
            {secondaryCtaId && (
              <AxoButton.Root
                size="md"
                variant="secondary"
                onClick={() =>
                  onInteractWithMegaphone(remoteMegaphoneId, secondaryCtaId)
                }
                width="grow"
              >
                {secondaryCtaText}
              </AxoButton.Root>
            )}
            {primaryCtaId && (
              <AxoButton.Root
                size="md"
                variant="primary"
                onClick={() =>
                  onInteractWithMegaphone(remoteMegaphoneId, primaryCtaId)
                }
                width="grow"
              >
                {primaryCtaText}
              </AxoButton.Root>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Narrow collapsed sidebar
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
      direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
      popperModifiers={[offsetDistanceModifier(15)]}
    >
      <button
        aria-label={i18n('icu:Megaphone__ExpandNarrowSidebar')}
        className={wrapperClassName}
        onClick={onClickNarrowMegaphone}
        type="button"
      >
        {image}
      </button>
    </Tooltip>
  );
}
