/**
 * @prettier
 */
import React from 'react';

import { Message } from './types/Message';

interface Props {
  message: Message;
  onClick?: () => void;
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

export class MediaGridItem extends React.Component<Props, {}> {
  public renderContent() {
    const { message } = this.props;

    if (!message.objectURL) {
      return null;
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
      <div style={styles.container} onClick={this.props.onClick}>
        {this.renderContent()}
      </div>
    );
  }
}
