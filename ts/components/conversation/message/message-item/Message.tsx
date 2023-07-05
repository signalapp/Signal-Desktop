import React from 'react';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { useSelector } from 'react-redux';
import { getGenericReadableMessageSelectorProps } from '../../../../state/selectors/conversations';
import { GenericReadableMessage } from './GenericReadableMessage';
import { THUMBNAIL_SIDE } from '../../../../types/attachments/VisualAttachment';
import { StateType } from '../../../../state/reducer';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = THUMBNAIL_SIDE;

type Props = {
  messageId: string;
  isDetailView?: boolean; // when the detail is shown for a message, we disable click and some other stuff
};

export const Message = (props: Props) => {
  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as StateType, props.messageId)
  );

  const ctxMenuID = `ctx-menu-message-${uuidv4()}`;

  if (msgProps?.isDeleted && msgProps.direction === 'outgoing') {
    return null;
  }

  return (
    <GenericReadableMessage
      ctxMenuID={ctxMenuID}
      messageId={props.messageId}
      isDetailView={props.isDetailView}
    />
  );
};
