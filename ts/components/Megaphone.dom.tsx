// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { tw } from '../axo/tw.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { offsetDistanceModifier } from '../util/popperUtil.std.ts';

export type PropsType = {
  title: string;
  body: string;
  i18n: LocalizerType;
  imagePath: string;
  isFullSize: boolean;
  primaryCtaText: string | null;
  secondaryCtaText: string | null;
  testId: string | null;
  onClickNarrowMegaphone: () => void;
  onClickPrimaryCta: (() => void) | null;
  onClickSecondaryCta: (() => void) | null;
};

export function Megaphone({
  i18n,
  title,
  body,
  imagePath,
  isFullSize,
  primaryCtaText,
  secondaryCtaText,
  testId,
  onClickNarrowMegaphone,
  onClickPrimaryCta,
  onClickSecondaryCta,
}: PropsType): JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  // We need to provide this to <Tooltip> to render correctly
  const wrapperClassName = tw(
    '@container flex flex-col',
    'max-w-[500px] curved-3xl p-3',
    'bg-material-primary dark:bg-material-tertiary',
    'backdrop-blur-thick',
    'shadow-elevation-1',
    isFullSize ? '' : 'size-[76px]'
  );
  const image: JSX.Element = (
    <div className={tw('size-12 shrink-0', isFullSize ? 'size-14' : 'm-auto')}>
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
        data-testid={testId ?? 'Megaphone'}
      >
        <div className={tw('flex items-start gap-3')}>
          {image}
          <div className={tw('w-full')}>
            <h2
              className={tw(
                'mt-0.5 type-body-medium font-semibold text-primary'
              )}
            >
              {title}
            </h2>
            <p className={tw('mt-0.5 type-body-small text-secondary')}>
              {body}
            </p>
          </div>
        </div>
        <div className={tw('mt-3 flex justify-end')}>
          <div className={tw('flex flex-wrap-reverse gap-1.5')}>
            {onClickSecondaryCta && (
              <AxoButton.Root
                size="md"
                variant="strong-secondary"
                onClick={onClickSecondaryCta}
                width="grow"
              >
                {secondaryCtaText}
              </AxoButton.Root>
            )}
            {onClickPrimaryCta && (
              <AxoButton.Root
                size="md"
                variant="strong-primary"
                onClick={onClickPrimaryCta}
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
  const tooltipContent: JSX.Element = (
    <div className={tw('text-start text-primary')}>
      <h2 className={tw('mt-1 type-body-medium font-semibold')}>{title}</h2>
      <p className={tw('mt-1 mb-2 type-body-medium')}>{body}</p>
    </div>
  );

  return (
    <Tooltip
      content={tooltipContent}
      className="MegaphoneTooltip"
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
