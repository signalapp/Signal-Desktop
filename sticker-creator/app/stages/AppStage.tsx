// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import * as styles from './AppStage.scss';
import { history } from '../../util/history';
import { Button } from '../../elements/Button';
import { useI18n } from '../../util/i18n';
import { Text } from '../../elements/Typography';
import { Toaster } from '../../components/Toaster';
import { stickersDuck } from '../../store';

export type Props = {
  readonly children: React.ReactNode;
  readonly empty?: boolean;
  readonly prev?: string;
  readonly prevText?: string;
  readonly next?: string;
  readonly nextActive?: boolean;
  readonly noMessage?: boolean;
  readonly onNext?: () => unknown;
  readonly onPrev?: () => unknown;
  readonly nextText?: string;
};

const getClassName = ({ noMessage, empty }: Props) => {
  if (noMessage) {
    return styles.noMessage;
  }

  if (empty) {
    return styles.empty;
  }

  return styles.main;
};

export const AppStage: React.ComponentType<Props> = props => {
  const {
    children,
    next,
    nextActive,
    nextText,
    onNext,
    onPrev,
    prev,
    prevText,
  } = props;
  const i18n = useI18n();

  const handleNext = React.useCallback(() => {
    if (next) {
      history.push(next);
    }
  }, [next]);

  const handlePrev = React.useCallback(() => {
    if (prev) {
      history.push(prev);
    }
  }, [prev]);

  const addMoreCount = stickersDuck.useAddMoreCount();
  const toasts = stickersDuck.useToasts();
  const { dismissToast } = stickersDuck.useStickerActions();

  return (
    <>
      <main className={getClassName(props)}>{children}</main>
      <footer className={styles.footer}>
        {prev || onPrev ? (
          <Button className={styles.button} onClick={onPrev || handlePrev}>
            {prevText || i18n('StickerCreator--AppStage--prev')}
          </Button>
        ) : null}
        {addMoreCount > 0 ? (
          <Text secondary>
            {i18n('StickerCreator--DropStage--addMore', [
              addMoreCount.toString(),
            ])}
          </Text>
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
        onDismiss={dismissToast}
      />
    </>
  );
};
