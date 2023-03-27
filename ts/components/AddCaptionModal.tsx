// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { noop } from 'lodash';
import { Button } from './Button';
import { Modal } from './Modal';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';

export type Props = {
  i18n: LocalizerType;
  onClose: () => void;
  onSubmit: (text: string) => void;
  draftText: string;
  theme: ThemeType;
  RenderCompositionTextArea: (
    props: SmartCompositionTextAreaProps
  ) => JSX.Element;
};

export function AddCaptionModal({
  i18n,
  onClose,
  onSubmit,
  draftText,
  RenderCompositionTextArea,
  theme,
}: Props): JSX.Element {
  const [messageText, setMessageText] = React.useState('');

  const [isScrolledTop, setIsScrolledTop] = React.useState(true);
  const [isScrolledBottom, setIsScrolledBottom] = React.useState(true);

  const scrollerRef = React.useRef<HTMLDivElement>(null);

  // add footer/header dividers depending on the state of scroll
  const updateScrollState = React.useCallback(() => {
    const scrollerEl = scrollerRef.current;
    if (scrollerEl) {
      setIsScrolledTop(scrollerEl.scrollTop === 0);
      setIsScrolledBottom(
        scrollerEl.scrollHeight - scrollerEl.scrollTop ===
          scrollerEl.clientHeight
      );
    }
  }, [scrollerRef]);

  useEffect(() => {
    updateScrollState();
  }, [updateScrollState]);

  const handleSubmit = React.useCallback(() => {
    onSubmit(messageText);
  }, [messageText, onSubmit]);

  return (
    <Modal
      i18n={i18n}
      modalName="AddCaptionModal"
      hasXButton
      hasHeaderDivider={!isScrolledTop}
      hasFooterDivider={!isScrolledBottom}
      moduleClassName="AddCaptionModal"
      padded={false}
      title={i18n('AddCaptionModal__title')}
      onClose={onClose}
      modalFooter={
        <Button onClick={handleSubmit}>
          {i18n('AddCaptionModal__submit-button')}
        </Button>
      }
    >
      <RenderCompositionTextArea
        maxLength={1500}
        whenToShowRemainingCount={1450}
        placeholder={i18n('AddCaptionModal__placeholder')}
        onChange={setMessageText}
        scrollerRef={scrollerRef}
        draftText={draftText}
        onSubmit={noop}
        onScroll={updateScrollState}
        theme={theme}
      />
    </Modal>
  );
}
