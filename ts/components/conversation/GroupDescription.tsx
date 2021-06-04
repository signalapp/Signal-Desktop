// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { LocalizerType } from '../../types/Util';
import { AddNewLines } from './AddNewLines';

export type PropsType = {
  i18n: LocalizerType;
  title: string;
  text: string;
};

export const GroupDescription = ({
  i18n,
  title,
  text,
}: PropsType): JSX.Element => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [hasReadMore, setHasReadMore] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (!textRef || !textRef.current) {
      return;
    }

    setHasReadMore(textRef.current.scrollHeight > textRef.current.clientHeight);
  }, [setHasReadMore, textRef]);

  return (
    <>
      {showFullDescription && (
        <Modal
          hasXButton
          i18n={i18n}
          onClose={() => setShowFullDescription(false)}
          title={title}
        >
          <AddNewLines text={text} />
        </Modal>
      )}
      <div className="GroupDescription__text" ref={textRef}>
        {text}
      </div>
      {hasReadMore && (
        <button
          className="GroupDescription__read-more"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            setShowFullDescription(true);
          }}
          type="button"
        >
          {i18n('GroupDescription__read-more')}
        </button>
      )}
    </>
  );
};
