import React from 'react';

import { LoadingIndicator } from './LoadingIndicator';
import { Message } from './propTypes/Message';

interface Props {
  message: Message;
  i18n: (value: string) => string;
}

const styles = {
  container: {
    backgroundColor: '#f3f3f3',
    marginRight: 4,
    marginBottom: 4,
    width: 94,
    height: 94,
  },
};

export class ImageThumbnail extends React.Component<Props, {}> {
  public renderContent() {
    const { i18n, message } = this.props;

    if (!message.imageUrl) {
      return <LoadingIndicator />;
    }

    return (
      <img
        src={message.imageUrl}
        alt={`${i18n('messageCaption')}: ${message.body}`}
      />
    );
  }

  public render() {
    return (
      <div style={styles.container}>
        {this.renderContent()}
      </div>
    );
  }
}
