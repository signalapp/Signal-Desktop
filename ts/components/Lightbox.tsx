/**
 * @prettier
 */
import React from 'react';


interface Props {
  imageURL?: string;
  onClose: () => void;
  close: () => void;
}

const styles = {
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    width: '100%',
    height: '100%',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'cover',
  }
};

export class Lightbox extends React.Component<Props, {}> {
  public render() {
    const { imageURL } = this.props;
    return (
      <div style={styles.container}>
        <img
          style={styles.image}
          src={imageURL}
         />
        <button onClick={this.props.close}>Close</button>
      </div>
    );
  }
}
