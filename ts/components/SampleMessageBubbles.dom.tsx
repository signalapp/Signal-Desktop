// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import classNames from 'classnames';
import type { BubbleColorRenderData } from '../types/ChatStyle.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { formatTime } from '../util/formatTimestamp.dom.ts';
import { getMessageMetadataStatusIconClassName } from './conversation/MessageMetadata.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { isDevEnvironment } from '../environment.std.ts';
import { DurationMs } from '@signalapp/types';
import { getBubbleColorRenderDataBackground } from '../util/getCustomColorStyle.std.ts';

type SampleMessageProps = Readonly<{
  bubbleColor: BubbleColorRenderData;
  direction: 'incoming' | 'outgoing';
  i18n: LocalizerType;
  text: string;
  timestampDeltaFromNow: number;
  status: 'delivered' | 'read' | 'sent';
}>;

function SampleMessage(props: SampleMessageProps): ReactNode {
  const { i18n, bubbleColor, direction, text, timestampDeltaFromNow, status } =
    props;

  const background = getBubbleColorRenderDataBackground(bubbleColor);

  return (
    <div
      className={classNames(
        'module-message',
        direction === 'incoming' && 'module-message--incoming',
        direction === 'outgoing' && 'module-message--outgoing'
      )}
      // Not positioned, so the gradient layer below is positioned relative to
      // the nearest positioned ancestor outside of the message instead
      style={{ position: 'static' }}
    >
      <div className="module-message__container-outer">
        <div
          className={classNames(
            'module-message__container',
            direction === 'incoming' && 'module-message__container--incoming',
            direction === 'outgoing' && 'module-message__container--outgoing'
          )}
          style={{
            position: 'static',
            // Unlike `overflow`, `clip-path` also clips descendants that are
            // positioned relative to an ancestor outside of this element
            clipPath: 'border-box',
          }}
        >
          {direction === 'outgoing' && (
            <span
              aria-hidden
              data-sample-gradient-layer
              className={tw(
                // Needs to be positioned relative to the scroll container so
                // the gradients behave like `background-attachment: fixed`
                'absolute inset-0 -z-10',
                'pointer-events-none'
              )}
              style={{ background }}
            />
          )}
          <div
            dir="auto"
            className={classNames(
              'module-message__text',
              direction === 'incoming' && 'module-message__text--incoming',
              direction === 'outgoing' && 'module-message__text--outgoing'
            )}
          >
            <span>{text}</span>
          </div>
          <div
            className={classNames(
              'module-message__metadata',
              direction === 'outgoing' && 'module-message__metadata--outgoing'
            )}
          >
            <span className="module-message__metadata__date">
              {/* oxlint-disable-next-line react/purity */}
              {formatTime(i18n, Date.now() - timestampDeltaFromNow, Date.now())}
            </span>
            {direction === 'outgoing' && (
              <div
                className={classNames(
                  'module-message__metadata__status-icon',
                  getMessageMetadataStatusIconClassName(status)
                )}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export type SampleMessageBubblesProps = Readonly<{
  i18n: LocalizerType;
  bubbleColor: BubbleColorRenderData;
}>;

export function SampleMessageBubbles(
  props: SampleMessageBubblesProps
): ReactNode {
  const { i18n, bubbleColor } = props;
  const ref = useRef<HTMLDivElement>(null);

  // dev-only check to prevent breaking message bubble gradients
  useLayoutEffect(() => {
    if (!isDevEnvironment()) {
      return;
    }

    strictAssert(ref.current, 'Missing ref');
    const root = ref.current;

    const layers = root.querySelectorAll<HTMLElement>(
      '[data-sample-gradient-layer]'
    );
    for (const layer of layers) {
      // Ensure that the message bubble gradient elements have offsets that are
      // equal to the root element's offsets. If they are not then there is
      // probably something with `position: relative` in between them.
      strictAssert(
        layer.offsetParent === root,
        'SampleMessageBubbles: Gradients must be relative to outer container'
      );
    }
  }, []);

  return (
    <div ref={ref} className={tw('relative flex flex-col gap-3')}>
      <SampleMessage
        bubbleColor={bubbleColor}
        direction="outgoing"
        i18n={i18n}
        text={i18n('icu:ChatColorPicker__sampleBubble1')}
        timestampDeltaFromNow={DurationMs.fromHours(4)}
        status="read"
      />
      <SampleMessage
        bubbleColor={bubbleColor}
        direction="incoming"
        i18n={i18n}
        text={i18n('icu:ChatColorPicker__sampleBubble2')}
        timestampDeltaFromNow={DurationMs.fromHours(2)}
        status="read"
      />
      <SampleMessage
        bubbleColor={bubbleColor}
        direction="outgoing"
        i18n={i18n}
        text={i18n('icu:ChatColorPicker__sampleBubble3')}
        timestampDeltaFromNow={0}
        status="delivered"
      />
    </div>
  );
}
