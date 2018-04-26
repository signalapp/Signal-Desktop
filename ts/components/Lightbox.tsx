/**
 * @prettier
 */
import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';

interface Props {
  close: () => void;
  objectURL: string;
  contentType: MIME.MIMEType | undefined;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  } as React.CSSProperties,
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 0,
  } as React.CSSProperties,
  objectContainer: {
    flexGrow: 1,
    display: 'inline-flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  image: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,
  controls: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: 10,
  } as React.CSSProperties,
  navigationContainer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
  } as React.CSSProperties,
  saveButton: {
    marginTop: 10,
  },
  iconButtonPlaceholder: {
    // Dimensions match `.iconButton`:
    display: 'inline-block',
    width: 50,
    height: 50,
  },
};

interface IconButtonProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  type: 'save' | 'close' | 'previous' | 'next';
}

const IconButton = ({ onClick, style, type }: IconButtonProps) => {
  const clickHandler = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    if (!onClick) {
      return;
    }

    onClick();
  };

  return (
    <a
      href="#"
      onClick={clickHandler}
      className={classNames('iconButton', type)}
      style={style}
    />
  );
};

const IconButtonPlaceholder = () => (
  <div style={styles.iconButtonPlaceholder} />
);

export class Lightbox extends React.Component<Props, {}> {
  private containerRef: HTMLDivElement | null = null;

  public componentDidMount() {
    const useCapture = true;
    document.addEventListener('keyup', this.onKeyUp, useCapture);
  }

  public componentWillUnmount() {
    const useCapture = true;
    document.removeEventListener('keyup', this.onKeyUp, useCapture);
  }

  public render() {
    const { contentType, objectURL } = this.props;
    return (
      <div
        style={styles.container}
        onClick={this.onContainerClick}
        ref={this.setContainerRef}
      >
        <div style={styles.mainContainer}>
          <div style={styles.objectContainer}>
            {!is.undefined(contentType)
              ? this.renderObject({ objectURL, contentType })
              : null}
          </div>
          <div style={styles.controls}>
            <IconButton type="close" onClick={this.onClose} />
            {this.props.onSave ? (
              <IconButton
                type="save"
                onClick={this.props.onSave}
                style={styles.saveButton}
              />
            ) : null}
          </div>
        </div>
        <div style={styles.navigationContainer}>
          {this.props.onPrevious ? (
            <IconButton type="previous" onClick={this.props.onPrevious} />
          ) : (
            <IconButtonPlaceholder />
          )}
          {this.props.onNext ? (
            <IconButton type="next" onClick={this.props.onNext} />
          ) : (
            <IconButtonPlaceholder />
          )}
        </div>
      </div>
    );
  }

  private renderObject = ({
    objectURL,
    contentType,
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
  }) => {
    const isImage = GoogleChrome.isImageTypeSupported(contentType);
    if (isImage) {
      return (
        <img
          style={styles.image}
          src={objectURL}
          onClick={this.onObjectClick}
        />
      );
    }

    const isVideo = GoogleChrome.isVideoTypeSupported(contentType);
    if (isVideo) {
      return (
        <video controls>
          <source src={objectURL} />
        </video>
      );
    }

    // tslint:disable-next-line no-console
    console.log('Lightbox: Unexpected content type', { contentType });
    return null;
  };

  private setContainerRef = (value: HTMLDivElement) => {
    this.containerRef = value;
  };

  private onClose = () => {
    const { close } = this.props;
    if (!close) {
      return;
    }

    close();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    this.onClose();
  };

  private onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== this.containerRef) {
      return;
    }
    this.onClose();
  };

  private onObjectClick = (event: React.MouseEvent<HTMLImageElement>) => {
    event.stopPropagation();
    this.onClose();
  };
}
