import React from 'react';

// import { getIncrement } from '../../util/timer';
import _ from 'lodash';
import uuid from 'uuid';
import { QuoteClickOptions } from '../../models/messageType';
import autoBind from 'auto-bind';
// import { messageExpired } from '../../state/ducks/conversations';
// import { getConversationController } from '../../session/conversations';
import { GenericReadableMessage } from './message/GenericReadableMessage';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

interface State {
  expiring: boolean;
  expired: boolean;
}

// const EXPIRATION_CHECK_MINIMUM = 2000;
// const EXPIRED_DELAY = 600;

type Props = {
  messageId: string;
  isDetailView?: boolean; // when the detail is shown for a message, we disble click and some other stuff
  onQuoteClick?: (options: QuoteClickOptions) => Promise<void>;
};

export class Message extends React.PureComponent<Props, State> {
  public expirationCheckInterval: any;
  public expiredTimeout: any;
  public ctxMenuID: string;

  public constructor(props: Props) {
    super(props);
    autoBind(this);

    this.state = {
      expiring: false,
      expired: false,
    };
    this.ctxMenuID = `ctx-menu-message-${uuid()}`;
  }

  public componentDidMount() {
    // const { expirationLength } = this.props;
    // if (!expirationLength) {
    //   return;
    // }
    // const increment = getIncrement(expirationLength);
    // const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
    // this.checkExpired();
    // this.expirationCheckInterval = setInterval(() => {
    //   this.checkExpired();
    // }, checkFrequency);
  }

  public componentWillUnmount() {
    // if (this.expirationCheckInterval) {
    //   clearInterval(this.expirationCheckInterval);
    // }
    // if (this.expiredTimeout) {
    //   global.clearTimeout(this.expiredTimeout);
    // }
  }

  // public componentDidUpdate() {
  //   this.checkExpired();
  // }

  // public checkExpired() {
  //   const now = Date.now();
  //   const { isExpired, expirationTimestamp, expirationLength, convoId, id } = this.props;

  //   if (!expirationTimestamp || !expirationLength) {
  //     return;
  //   }
  //   if (this.expiredTimeout) {
  //     return;
  //   }

  //   if (isExpired || now >= expirationTimestamp) {
  //     this.setState({
  //       expiring: true,
  //     });

  //     const setExpired = async () => {
  //       this.setState({
  //         expired: true,
  //       });
  //       await window.Signal.Data.removeMessage(id);
  //       window.inboxStore?.dispatch(
  //         messageExpired({
  //           conversationKey: convoId,
  //           messageId: id,
  //         })
  //       );
  //       const convo = getConversationController().get(convoId);
  //       convo?.updateLastMessage();
  //     };
  //     // as 'checkExpired' is potentially called more than once (componentDidUpdate & componentDidMount),
  //     //  we need to clear the timeout call to 'setExpired' first to avoid multiple calls to 'setExpired'.
  //     global.clearTimeout(this.expiredTimeout);
  //     this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
  //   }
  // }

  // tslint:disable-next-line: cyclomatic-complexity cyclomatic-complexity
  public render() {
    return (
      <GenericReadableMessage
        onQuoteClick={this.onQuoteClick}
        ctxMenuID={this.ctxMenuID}
        expired={this.state.expired}
        expiring={this.state.expiring}
        messageId={this.props.messageId}
        isDetailView={this.props.isDetailView}
      />
    );
  }

  private onQuoteClick(quote: QuoteClickOptions) {
    void this.props.onQuoteClick?.(quote);
  }
}
