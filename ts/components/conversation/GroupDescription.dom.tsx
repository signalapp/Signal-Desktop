// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useLayoutEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { GroupDescriptionText } from '../GroupDescriptionText.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';

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
  const overflowRef = useRef<HTMLSpanElement | null>(null);
  const [hasReadMore, setHasReadMore] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useLayoutEffect(() => {
    const target = overflowRef.current;
    strictAssert(target, 'Missing ref');

    const observer = new IntersectionObserver(entries => {
      const entry = entries.at(0);
      strictAssert(entry, 'Missing entry');
      setHasReadMore(!entry.isIntersecting);
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <AxoDialog.Root
        open={showFullDescription}
        onOpenChange={setShowFullDescription}
      >
        <AxoDialog.Content size="md" escape="cancel-is-noop">
          <AxoDialog.Header>
            <AxoDialog.Title>{title}</AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <AxoDialog.Description>
              <GroupDescriptionText text={text} />
            </AxoDialog.Description>
          </AxoDialog.Body>
          <AxoDialog.Footer />
        </AxoDialog.Content>
      </AxoDialog.Root>

      <div className={tw('line-clamp-2')}>
        <GroupDescriptionText text={text} />
        <span className={tw('inline-block size-px')} ref={overflowRef} />
      </div>

      {hasReadMore && (
        <button
          type="button"
          className={tw('font-semibold')}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setShowFullDescription(true);
          }}
        >
          {i18n('icu:GroupDescription__read-more')}
        </button>
      )}
    </>
  );
}
