// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { PopperArrowProps } from 'react-popper';
import { Placement } from 'popper.js';
import * as styles from './StickerPreview.scss';
import { MessageBubble } from './MessageBubble';
import { MessageSticker, Props as MessageStickerProps } from './MessageSticker';
import { useI18n } from '../util/i18n';

export type Props = Pick<React.HTMLProps<HTMLDivElement>, 'style'> & {
  image: string;
  arrowProps?: PopperArrowProps;
  placement?: Placement;
};

const renderMessages = (
  text: string,
  image: string,
  kind: MessageStickerProps['kind']
) => (
  <>
    <MessageBubble minutesAgo={3}>{text}</MessageBubble>
    <MessageSticker image={image} kind={kind} minutesAgo={2} />
  </>
);

const getBaseClass = (placement?: Placement) => {
  if (placement === 'top') {
    return styles.top;
  }

  if (placement === 'right') {
    return styles.right;
  }

  if (placement === 'left') {
    return styles.left;
  }

  return styles.bottom;
};

const getArrowClass = (placement?: Placement) => {
  if (placement === 'top') {
    return styles.arrowBottom;
  }

  if (placement === 'right') {
    return styles.arrowLeft;
  }

  if (placement === 'left') {
    return styles.arrowRight;
  }

  return styles.arrowTop;
};

export const StickerPreview = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    ({ image, style, arrowProps, placement }: Props, ref) => {
      const i18n = useI18n();

      return (
        <div className={getBaseClass(placement)} ref={ref} style={style}>
          {arrowProps ? (
            <div
              ref={arrowProps.ref}
              style={arrowProps.style}
              className={getArrowClass(placement)}
            />
          ) : null}
          <div className={styles.frameLight}>
            {renderMessages(
              i18n('StickerCreator--StickerPreview--light'),
              image,
              'light'
            )}
          </div>
          <div className={styles.frameDark}>
            {renderMessages(
              i18n('StickerCreator--StickerPreview--dark'),
              image,
              'dark'
            )}
          </div>
        </div>
      );
    }
  )
);
