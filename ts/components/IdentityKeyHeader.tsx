import React from 'react';

interface Props {
  identityKey: string;
  name?: string;
  onEditProfile: () => void;
}

export class IdentityKeyHeader extends React.Component<Props> {
  public render() {
    const {
      name,
      identityKey,
      onEditProfile,
    } = this.props;

    return (
      <div className='identity-key-container'>
        <div className='identity-key-text-container'>
          <div>
            Your identity key: <span className='identity-key_bold'>{identityKey}</span>
          </div>
          {!!name &&
            <div>
              Your display name: <span className='identity-key_bold'>{name}</span>
            </div>
          }
        </div>
        <div
        id='editProfile'
        role="button"
        onClick={onEditProfile}
        className="identity-key-wrapper__pencil-icon"
      />
      </div>
    );
  }
}
