import React from 'react';

import { LoadingIndicator } from './LoadingIndicator';
import { Message } from './propTypes/Message';

interface Props {
  message: Message;
  i18n: (value: string) => string;
}

const size = {
  width: 94,
  height: 94,
};
const styles = {
  container: {
    ...size,
    backgroundColor: '#f3f3f3',
    marginRight: 4,
    marginBottom: 4,
  },
  image: {
    ...size,
    backgroundSize: 'cover',
  },
};

export class ImageThumbnail extends React.Component<Props, {}> {
  public renderContent() {
    const {/* i18n, */message } = this.props;

    if (!message.objectURL) {
      return <LoadingIndicator />;
    }

    return (
      <div
        style={{
          ...styles.container,
          ...styles.image,
          backgroundImage: `url("${message.objectURL}")`,
        }}
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
