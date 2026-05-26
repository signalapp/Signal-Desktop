// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type JSX, useId, useMemo, useState } from 'react';
import { Tabs } from 'radix-ui';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { useReducedMotion } from '../hooks/useReducedMotion.dom.ts';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

export type SafetyTipsModalProps = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function SafetyTipsModal({
  i18n,
  onClose,
}: SafetyTipsModalProps): JSX.Element {
  const [page, setPage] = useState<'summary' | 'details'>('summary');
  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        {page === 'summary' ? (
          <SafetyTipsSummary
            i18n={i18n}
            onViewMore={() => setPage('details')}
          />
        ) : (
          <SafetyTipsDetails i18n={i18n} />
        )}
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function SafetyTipsSummary({
  i18n,
  onViewMore,
}: {
  i18n: LocalizerType;
  onViewMore: () => void;
}): JSX.Element {
  const tips = useMemo(
    () =>
      [
        {
          key: 'signal',
          iconUrl: 'images/safety-tips/safety-tip-icon-chat-x.svg',
          titleId: i18n('icu:SafetyTipsModal__TipTitle--SignalChat'),
          descriptionId: i18n(
            'icu:SafetyTipsModal__TipDescription--SignalChat'
          ),
        },
        {
          key: 'names-and-photos',
          iconUrl: 'images/safety-tips/safety-tip-icon-person-question.svg',
          titleId: i18n('icu:SafetyTipsModal__TipTitle--NamesAndPhotos'),
          descriptionId: i18n(
            'icu:SafetyTipsModal__TipDescription--NamesAndPhotos'
          ),
        },
        {
          key: 'scams',
          iconUrl: 'images/safety-tips/safety-tip-icon-raised-hand.svg',
          titleId: i18n('icu:SafetyTipsModal__TipTitle--Scams'),
          descriptionId: i18n('icu:SafetyTipsModal__TipDescription--Scams'),
        },
      ] as const,
    [i18n]
  );
  return (
    <>
      <AxoDialog.Header>
        <div className={tw('sr-only')}>
          <AxoDialog.Description>
            {i18n('icu:SafetyTipsModal__Title-v2')}
          </AxoDialog.Description>
        </div>
        <AxoDialog.Title>
          {i18n('icu:SafetyTipsModal__Title-v2')}
        </AxoDialog.Title>
        <AxoDialog.Close />
      </AxoDialog.Header>
      <AxoDialog.Body>
        <div className={tw('py-4')}>
          <ul className={tw('mb-7 space-y-9')}>
            {tips.map(tip => (
              <li key={tip.key} className={tw('flex items-start gap-4')}>
                <img
                  role="presentation"
                  alt=""
                  className={tw('mt-1 size-11 shrink-0')}
                  src={tip.iconUrl}
                />
                <div>
                  <h3 className={tw('type-title-small text-label-primary')}>
                    {tip.titleId}
                  </h3>
                  <p
                    className={tw('mt-1 type-body-medium text-label-secondary')}
                  >
                    {tip.descriptionId}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <AxoButton.Root
            size="lg"
            variant="secondary"
            width="full"
            onClick={onViewMore}
          >
            {i18n('icu:SafetyTipsModal__Button--ViewMore')}
          </AxoButton.Root>
        </div>
      </AxoDialog.Body>
    </>
  );
}

function SafetyTipsDetails({ i18n }: { i18n: LocalizerType }): JSX.Element {
  const cardWrapperId = useId();

  const tips = useMemo(
    () =>
      [
        {
          key: 'dontRespond',
          title: i18n('icu:SafetyTipsModal__TipTitle--DontRespond'),
          description: i18n('icu:SafetyTipsModal__TipDescription--DontRespond'),
          imageUrl: 'images/safety-tips/safety-tip-dont-respond.svg',
        },
        {
          key: 'reviewNames',
          title: i18n('icu:SafetyTipsModal__TipTitle--ReviewNames'),
          description: i18n('icu:SafetyTipsModal__TipDescription--ReviewNames'),
          imageUrl: 'images/safety-tips/safety-tip-review-names.svg',
        },
        {
          key: 'vague',
          title: i18n('icu:SafetyTipsModal__TipTitle--Vague'),
          description: i18n('icu:SafetyTipsModal__TipDescription--Vague'),
          imageUrl: 'images/safety-tips/safety-tip-vague.svg',
        },
        {
          key: 'links',
          title: i18n('icu:SafetyTipsModal__TipTitle--Links-v2'),
          description: i18n('icu:SafetyTipsModal__TipDescription--Links'),
          imageUrl: 'images/safety-tips/safety-tip-links.svg',
        },
        {
          key: 'crypto',
          title: i18n('icu:SafetyTipsModal__TipTitle--Crypto'),
          description: i18n('icu:SafetyTipsModal__TipDescription--Crypto'),
          imageUrl: 'images/safety-tips/safety-tip-crypto.svg',
        },
        {
          key: 'business',
          title: i18n('icu:SafetyTipsModal__TipTitle--Business'),
          description: i18n('icu:SafetyTipsModal__TipDescription--Business'),
          imageUrl: 'images/safety-tips/safety-tip-business.svg',
        },
      ] as const,
    [i18n]
  );

  function getCardIdForPage(pageIndex: number) {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    return `${cardWrapperId}_${tips[pageIndex]!.key}`;
  }

  const maxPageIndex = tips.length - 1;
  const [pageIndex, setPageIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  function scrollToPageIndex(nextPageIndex: number) {
    setPageIndex(nextPageIndex);
    document.getElementById(getCardIdForPage(nextPageIndex))?.scrollIntoView({
      inline: 'center',
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  }

  function scrollToPageKey(key: string) {
    const index = tips.findIndex(tip => tip.key === key);
    if (index >= 0) {
      scrollToPageIndex(index);
    }
  }

  return (
    <>
      <AxoDialog.Header>
        <div className={tw('sr-only')}>
          <AxoDialog.Title>
            {i18n('icu:SafetyTipsModal__Title-v2')}
          </AxoDialog.Title>
        </div>
        <AxoDialog.Close />
      </AxoDialog.Header>
      <Tabs.Root
        value={tips[pageIndex]?.key}
        onValueChange={scrollToPageKey}
        role="group"
        aria-label={i18n('icu:SafetyTipsModal__Title-v2')}
        aria-roledescription={i18n('icu:Carousel--Role')}
      >
        <div
          className={tw('flex gap-3 overflow-hidden')}
          id={cardWrapperId}
          aria-live="polite"
          aria-atomic="false"
        >
          {tips.map((page, index) => {
            return (
              <Tabs.Content
                key={page.key}
                id={getCardIdForPage(index)}
                value={page.key}
                forceMount
                className={tw('w-full shrink-0 snap-center px-10')}
                tabIndex={index === pageIndex ? 0 : -1}
                aria-roledescription={i18n('icu:Carousel__Slide--Role')}
              >
                <div className={tw('flex justify-center')}>
                  <img
                    role="presentation"
                    alt=""
                    className={tw('w-[#204px]')}
                    src={page.imageUrl}
                    width={240}
                  />
                </div>
                <h2
                  className={tw(
                    'mt-2 type-title-small font-semibold text-label-primary'
                  )}
                >
                  {page.title}
                </h2>
                <p className={tw('mt-1 type-body-medium text-label-secondary')}>
                  {page.description}
                </p>
              </Tabs.Content>
            );
          })}
        </div>
        <AxoDialog.Footer>
          <div className={tw('flex w-full items-center justify-between p-1')}>
            <div className={pageIndex === 0 ? tw('invisible') : ''}>
              <AxoIconButton.Root
                variant="secondary"
                iconWeight={300}
                label={i18n('icu:previous')}
                tooltip={false}
                symbol="chevron-[start]"
                disabled={pageIndex === 0}
                size="sm"
                aria-controls={cardWrapperId}
                onClick={() => {
                  if (pageIndex === 0) {
                    return;
                  }
                  scrollToPageIndex(pageIndex - 1);
                }}
              />
            </div>
            <Tabs.List loop={false}>
              {tips.map(page => {
                return (
                  <Tabs.Trigger
                    key={page.key}
                    value={page.key}
                    className="SafetyTipsModal__DotsButton"
                    aria-label={page.title}
                  />
                );
              })}
            </Tabs.List>

            <div className={pageIndex === maxPageIndex ? tw('invisible') : ''}>
              <AxoIconButton.Root
                symbol="chevron-[end]"
                variant="secondary"
                tooltip={false}
                iconWeight={300}
                label={i18n('icu:next')}
                disabled={pageIndex === maxPageIndex}
                size="sm"
                aria-controls={cardWrapperId}
                onClick={() => {
                  if (pageIndex === maxPageIndex) {
                    return;
                  }
                  scrollToPageIndex(pageIndex + 1);
                }}
              />
            </div>
          </div>
        </AxoDialog.Footer>
      </Tabs.Root>
    </>
  );
}
