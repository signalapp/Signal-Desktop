/**
 * @prettier
 */

import { Component } from 'react';

interface Props {
  label: string;
}

export class EmptyState extends Component<Props> {
  public render() {
    const { label } = this.props;

    return <div className="module-empty-state">{label}</div>;
  }
}
