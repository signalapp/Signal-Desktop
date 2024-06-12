import styled from 'styled-components';
import { useIconToImageURL } from '../../../hooks/useIconToImageURL';
import { QRCodeLogoProps, SessionQRCode } from '../../SessionQRCode';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { SpacerSM } from '../../basic/Text';
import { SessionIconButton } from '../../icon';

const qrLogoProps: QRCodeLogoProps = {
  iconType: 'brand',
  iconSize: 40,
};

export const QRView = ({ sessionID }: { sessionID: string }) => {
  const { dataURL, iconSize, iconColor, backgroundColor, loading } = useIconToImageURL(qrLogoProps);

  return (
    <SessionQRCode
      id={'session-account-id'}
      value={sessionID}
      size={190}
      backgroundColor={backgroundColor}
      foregroundColor={iconColor}
      hasLogo={qrLogoProps}
      logoImage={dataURL}
      logoSize={iconSize}
      loading={loading}
      ariaLabel={'Account ID QR code'}
      dataTestId={'your-qr-code'}
      style={{ marginTop: '-1px' }}
    />
  );
};

type ProfileAvatarProps = {
  avatarPath: string | null;
  newAvatarObjectUrl?: string | null;
  profileName: string | undefined;
  ourId: string;
};

export const ProfileAvatar = (props: ProfileAvatarProps) => {
  const { newAvatarObjectUrl, avatarPath, profileName, ourId } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || avatarPath}
      forcedName={profileName || ourId}
      size={AvatarSize.XL}
      pubkey={ourId}
    />
  );
};

type ProfileHeaderProps = ProfileAvatarProps & {
  onClick: () => void;
  onQRClick: () => void;
};

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const { avatarPath, profileName, ourId, onClick, onQRClick } = props;

  return (
    <div className="avatar-center">
      <div className="avatar-center-inner">
        <ProfileAvatar avatarPath={avatarPath} profileName={profileName} ourId={ourId} />
        <div
          className="image-upload-section"
          role="button"
          onClick={onClick}
          data-testid="image-upload-section"
        />
        <div className="qr-view-button" onClick={onQRClick} role="button">
          <SessionIconButton iconType="qr" iconSize={26} iconColor="var(--black-color)" />
        </div>
      </div>
    </div>
  );
};

// We center the name in the modal by offsetting the pencil icon
// we have a transparent border to match the dimensions of the SessionInput
const StyledProfileName = styled(Flex)`
  margin-inline-start: calc((25px + var(--margins-sm)) * -1);
  padding: 8px;
  border: 1px solid var(--transparent-color);

  .session-icon-button {
    padding: 0px;
  }
`;

const StyledName = styled.p`
  font-size: var(--font-size-xl);
  line-height: 1.4;
  margin: 0;
  padding: 0px;
`;

export const ProfileName = (props: { profileName: string; onClick: () => void }) => {
  const { profileName, onClick } = props;

  return (
    <StyledProfileName container={true} justifyContent="center" alignItems="center">
      <SessionIconButton
        iconType="pencil"
        iconSize="large"
        onClick={onClick}
        dataTestId="edit-profile-icon"
      />
      <SpacerSM />
      <StyledName data-testid="your-profile-name">{profileName}</StyledName>
    </StyledProfileName>
  );
};
