/**
 * @prettier
 */
import React from 'react';

import * as Colors from '../../styles/Colors';

interface Props {
  label: string;
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,

    fontSize: 28,
    color: Colors.TEXT_SECONDARY,
  } as React.CSSProperties,
};

export class EmptyState extends React.Component<Props, {}> {
  public render() {
    const { label } = this.props;
    return <div style={styles.container}>{label}</div>;
  }
}
