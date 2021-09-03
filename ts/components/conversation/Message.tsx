import React from 'react';

import _ from 'lodash';
import uuid from 'uuid';
import { QuoteClickOptions } from '../../models/messageType';
import autoBind from 'auto-bind';
import { GenericReadableMessage } from './message/GenericReadableMessage';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

type Props = {
  messageId: string;
  isDetailView?: boolean; // when the detail is shown for a message, we disble click and some other stuff
  onQuoteClick?: (options: QuoteClickOptions) => Promise<void>;
};

export class Message extends React.PureComponent<Props> {
  public ctxMenuID: string;

  public constructor(props: Props) {
    super(props);
    autoBind(this);

    this.ctxMenuID = `ctx-menu-message-${uuid()}`;
  }

  // tslint:disable-next-line: cyclomatic-complexity cyclomatic-complexity
  public render() {
    return (
      <GenericReadableMessage
        onQuoteClick={this.onQuoteClick}
        ctxMenuID={this.ctxMenuID}
        messageId={this.props.messageId}
        isDetailView={this.props.isDetailView}
      />
    );
  }

  private onQuoteClick(quote: QuoteClickOptions) {
    void this.props.onQuoteClick?.(quote);
  }
}
