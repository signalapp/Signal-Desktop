// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { UIEvent } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { LocalizerType } from '../types/I18N';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type SafetyTipsModalProps = Readonly<{
  i18n: LocalizerType;
  onClose(): void;
}>;

export function SafetyTipsModal({
  i18n,
  onClose,
}: SafetyTipsModalProps): JSX.Element {
  const pages = useMemo(() => {
    return [
      {
        key: 'crypto',
        title: i18n('icu:SafetyTipsModal__TipTitle--Crypto'),
        description: i18n('icu:SafetyTipsModal__TipDescription--Crypto'),
        imageUrl: 'images/safety-tips/safety-tip-crypto.png',
      },
      {
        key: 'vague',
        title: i18n('icu:SafetyTipsModal__TipTitle--Vague'),
        description: i18n('icu:SafetyTipsModal__TipDescription--Vague'),
        imageUrl: 'images/safety-tips/safety-tip-vague.png',
      },
      {
        key: 'links',
        title: i18n('icu:SafetyTipsModal__TipTitle--Links'),
        description: i18n('icu:SafetyTipsModal__TipDescription--Links'),
        imageUrl: 'images/safety-tips/safety-tip-links.png',
      },
      {
        key: 'business',
        title: i18n('icu:SafetyTipsModal__TipTitle--Business'),
        description: i18n('icu:SafetyTipsModal__TipDescription--Business'),
        imageUrl: 'images/safety-tips/safety-tip-business.png',
      },
    ];
  }, [i18n]);

  const [modalId] = useState(() => uuid());
  const [cardWrapperId] = useState(() => uuid());

  function getCardIdForPage(pageIndex: number) {
    return `${cardWrapperId}_${pages[pageIndex].key}`;
  }

  const maxPageIndex = pages.length - 1;
  const [pageIndex, setPageIndexInner] = useState(0);
  const reducedMotion = useReducedMotion();
  const scrollEndTimer = useRef<NodeJS.Timeout | null>(null);

  const [hasPageIndexChanged, setHasPageIndexChanged] = useState(false);
  function setPageIndex(nextPageIndex: number) {
    setPageIndexInner(nextPageIndex);
    setHasPageIndexChanged(true);
  }

  function clearScrollEndTimer() {
    if (scrollEndTimer.current != null) {
      clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearScrollEndTimer();
    };
  }, []);

  function scrollToPageIndex(nextPageIndex: number) {
    clearScrollEndTimer();
    setPageIndex(nextPageIndex);
    document.getElementById(getCardIdForPage(nextPageIndex))?.scrollIntoView({
      inline: 'center',
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  }

  function handleScroll(event: UIEvent) {
    clearScrollEndTimer();
    const { scrollWidth, scrollLeft, clientWidth } = event.currentTarget;
    const maxScrollLeft = scrollWidth - clientWidth;
    const absScrollLeft = Math.abs(scrollLeft);
    const percentScrolled = absScrollLeft / maxScrollLeft;
    const scrolledPageIndex = Math.round(percentScrolled * maxPageIndex);
    scrollEndTimer.current = setTimeout(() => {
      setPageIndex(scrolledPageIndex);
    }, 100);
  }

  return (
    <Modal
      i18n={i18n}
      modalName="SafetyTipsModal"
      moduleClassName="SafetyTipsModal"
      noMouseClose
      hasXButton
      padded={false}
      title={i18n('icu:SafetyTipsModal__Title')}
      onClose={onClose}
      aria-describedby={`${modalId}-description`}
      modalFooter={
        <>
          <Button
            className="SafetyTipsModal__Button SafetyTipsModal__Button--Previous"
            variant={ButtonVariant.SecondaryAffirmative}
            aria-disabled={pageIndex === 0}
            aria-controls={cardWrapperId}
            onClick={() => {
              if (pageIndex === 0) {
                return;
              }
              scrollToPageIndex(pageIndex - 1);
            }}
          >
            {i18n('icu:SafetyTipsModal__Button--Previous')}
          </Button>
          {pageIndex < maxPageIndex ? (
            <Button
              className="SafetyTipsModal__Button SafetyTipsModal__Button--Next"
              variant={ButtonVariant.Primary}
              aria-controls={cardWrapperId}
              onClick={() => {
                if (pageIndex === maxPageIndex) {
                  return;
                }
                scrollToPageIndex(pageIndex + 1);
              }}
            >
              {i18n('icu:SafetyTipsModal__Button--Next')}
            </Button>
          ) : (
            <Button
              className="SafetyTipsModal__Button SafetyTipsModal__Button--Next"
              variant={ButtonVariant.Primary}
              onClick={onClose}
            >
              {i18n('icu:SafetyTipsModal__Button--Done')}
            </Button>
          )}
        </>
      }
    >
      <p className="SafetyTipsModal__Description" id={`${modalId}-description`}>
        {i18n('icu:SafetyTipsModal__Description')}
      </p>
      <div>
        <div
          className="SafetyTipsModal__CardWrapper"
          id={cardWrapperId}
          aria-live={hasPageIndexChanged ? 'assertive' : undefined}
          aria-atomic
          onScroll={handleScroll}
        >
          {pages.map((page, index) => {
            const isCurrentPage = pageIndex === index;
            return (
              <div
                id={getCardIdForPage(index)}
                key={page.key}
                className="SafetyTipsModal__Card"
                aria-hidden={!isCurrentPage}
              >
                <img
                  role="presentation"
                  alt=""
                  className="SafetyTipsModal__CardImage"
                  src={page.imageUrl}
                  width={664}
                  height={314}
                />
                <h2 className="SafetyTipsModal__CardTitle">{page.title}</h2>
                <p className="SafetyTipsModal__CardDescription">
                  {page.description}
                </p>
              </div>
            );
          })}
        </div>
        <div className="SafetyTipsModal__Dots">
          {pages.map((page, index) => {
            const isCurrentPage = pageIndex === index;
            return (
              <button
                key={page.key}
                className="SafetyTipsModal__DotsButton"
                type="button"
                aria-controls={cardWrapperId}
                aria-current={isCurrentPage ? 'step' : undefined}
                onClick={() => {
                  scrollToPageIndex(index);
                }}
              >
                <div className="SafetyTipsModal__DotsButtonLabel">
                  {i18n('icu:SafetyTipsModal__DotLabel', {
                    page: index + 1,
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
