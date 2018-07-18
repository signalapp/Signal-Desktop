/**
 * @prettier
 */
import React from 'react';

interface Props {
  label: string;
}

export class EmptyState extends React.Component<Props> {
  public render() {
    const { label } = this.props;

    return <div className="module-empty-state">{label}</div>;
  }
}
