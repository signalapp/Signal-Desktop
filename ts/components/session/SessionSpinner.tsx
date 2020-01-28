import React from 'react';

interface Props {
  loading: boolean;
}

export class SessionSpinner extends React.Component<Props> {
  public static defaultProps = {
    loading: true,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { loading } = this.props;

    return (
      <>
        {loading ? (
          <div className="session-loader">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}
      </>
    );
  }
}
