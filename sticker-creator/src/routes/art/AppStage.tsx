// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import styles from './AppStage.module.scss';
import { Button } from '../../elements/Button';
import { PageHeader } from '../../elements/PageHeader';
import { LabeledCheckbox } from '../../elements/LabeledCheckbox';
import { useI18n } from '../../contexts/I18n';
import { Toaster } from '../../components/Toaster';
import { dismissToast } from '../../slices/art';
import { useArtOrder, useToasts } from '../../selectors/art';

export type Props = Readonly<{
  children: React.ReactNode;
  empty?: boolean;
  prev?: string;
  prevText?: string;
  next?: string;
  nextActive?: boolean;
  noMessage?: boolean;
  noScroll?: boolean;
  onNext?: () => unknown;
  onPrev?: () => unknown;
  nextText?: string;
  showGuide?: boolean;
  setShowGuide?: (value: boolean) => unknown;
}>;

const getClassName = ({ noMessage, empty }: Props) => {
  if (noMessage) {
    return styles.noMessage;
  }

  if (empty) {
    return styles.empty;
  }

  return styles.main;
};

export function AppStage(props: Props): JSX.Element {
  const {
    children,
    next,
    nextActive,
    nextText,
    noScroll,
    onNext,
    onPrev,
    prev,
    prevText,
    showGuide = false,
    setShowGuide,
  } = props;
  const i18n = useI18n();
  const navigate = useNavigate();
  const artPaths = useArtOrder();
  const haveStickers = artPaths.length > 0;

  const handleNext = React.useCallback(() => {
    if (next) {
      navigate(next);
    }
  }, [next, navigate]);

  const handlePrev = React.useCallback(() => {
    if (prev) {
      navigate(prev);
    }
  }, [prev, navigate]);

  const dispatch = useDispatch();
  const toasts = useToasts();

  return (
    <div className={styles.container}>
      <div className={noScroll ? styles.noScroll : styles.scroll}>
        <PageHeader />

        <main className={getClassName(props)}>{children}</main>
      </div>

      <footer className={styles.footer}>
        {setShowGuide && haveStickers ? (
          <LabeledCheckbox onChange={setShowGuide} value={showGuide}>
            {i18n('StickerCreator--DropStage--showMargins')}
          </LabeledCheckbox>
        ) : null}
        <div className={styles.grow} />
        {prev || onPrev ? (
          <Button className={styles.button} onClick={onPrev || handlePrev}>
            {prevText || i18n('StickerCreator--AppStage--prev')}
          </Button>
        ) : null}
        {next || onNext ? (
          <Button
            className={styles.button}
            onClick={onNext || handleNext}
            primary
            disabled={!nextActive}
          >
            {nextText || i18n('StickerCreator--AppStage--next')}
          </Button>
        ) : null}
      </footer>
      <Toaster
        className={styles.toaster}
        loaf={toasts.map((slice, id) => ({
          id,
          text: i18n(slice.key, slice.subs),
        }))}
        onDismiss={() => dispatch(dismissToast())}
      />
    </div>
  );
}
