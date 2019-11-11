import React from 'react';
import classNames from 'classnames';

interface Props {
  messageCount: number;
  onCancel: any;
  onDelete: any;
}

export class BulkEdit extends React.Component<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const classes = ['bulk-edit-container'];

    if (this.props.messageCount === 0) {
      classes.push('hidden');
    }

    return (
      <div className={classNames(classes)}>
        <span
          className="delete-button"
          role="button"
          onClick={this.props.onDelete}
        >
          Delete
        </span>
        <span className="message-counter">
          Messages selected: {this.props.messageCount}
        </span>
        <span
          className="cancel-button"
          role="button"
          onClick={this.props.onCancel}
        >
          Cancel
        </span>
      </div>
    );
  }
}
