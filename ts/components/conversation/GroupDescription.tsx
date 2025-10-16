// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { GroupDescriptionText } from '../GroupDescriptionText.dom.js';

// Emojification can cause the scroll height to be *slightly* larger than the client
//   height, so we add a little wiggle room.
const SHOW_READ_MORE_THRESHOLD = 5;

export type PropsType = {
  i18n: LocalizerType;
  title: string;
  text: string;
};

export function GroupDescription({
  i18n,
  title,
  text,
}: PropsType): JSX.Element {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [hasReadMore, setHasReadMore] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (!textRef || !textRef.current) {
      return;
    }

    setHasReadMore(
      textRef.current.scrollHeight - SHOW_READ_MORE_THRESHOLD >
        textRef.current.clientHeight
    );
  }, [setHasReadMore, text, textRef]);

  return (
    <>
      {showFullDescription && (
        <Modal
          modalName="GroupDescription"
          hasXButton
          i18n={i18n}
          onClose={() => setShowFullDescription(false)}
          title={title}
        >
          <GroupDescriptionText text={text} />
        </Modal>
      )}
      <div className="GroupDescription__text" ref={textRef}>
        <GroupDescriptionText text={text} />
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
          {i18n('icu:GroupDescription__read-more')}
        </button>
      )}
    </>
  );
}
