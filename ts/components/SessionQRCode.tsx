import { isEmpty } from 'lodash';
import { MouseEvent } from 'react';
import { QRCode } from 'react-qrcode-logo';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../themes/globals';
import { saveQRCode } from '../util/saveQRCode';
import { AnimatedFlex } from './basic/Flex';

// We fade in the QR code to hide the logo flickering on first render
const StyledQRView = styled(AnimatedFlex)`
  cursor: pointer;
  border-radius: var(--border-radius);
  overflow: hidden;
`;

type Props = {
  id: string;
  value: string;
  size: number;
  backgroundColor?: string;
  foregroundColor?: string;
  logoImage?: string;
  logoWidth?: number;
  logoHeight?: number;
  style?: CSSProperties;
};

export function SessionQRCode(props: Props) {
  const {
    id,
    value,
    size,
    backgroundColor = '#FFF',
    foregroundColor = '#000',
    logoImage,
    logoWidth,
    logoHeight,
    style,
  } = props;
  return (
    <StyledQRView
      container={true}
      aria-label={window.i18n('clickToTrustContact')}
      title={window.i18n('clickToTrustContact')}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        saveQRCode(id);
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      style={style}
    >
      <QRCode
        id={id}
        value={value}
        ecLevel={'Q'}
        size={size}
        quietZone={10}
        bgColor={backgroundColor}
        fgColor={foregroundColor}
        logoImage={logoImage}
        logoWidth={logoWidth}
        logoHeight={logoHeight}
        removeQrCodeBehindLogo={!isEmpty(logoImage)}
      />
    </StyledQRView>
  );
}
