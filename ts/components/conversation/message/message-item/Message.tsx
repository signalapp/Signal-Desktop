import React from 'react';

import _ from 'lodash';
import uuid from 'uuid';
import { useSelector } from 'react-redux';
import { getGenericReadableMessageSelectorProps } from '../../../../state/selectors/conversations';
import { GenericReadableMessage } from './GenericReadableMessage';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

type Props = {
  messageId: string;
  isDetailView?: boolean; // when the detail is shown for a message, we disble click and some other stuff
};

export const Message = (props: Props) => {
  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as any, props.messageId)
  );

  const ctxMenuID = `ctx-menu-message-${uuid()}`;

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
