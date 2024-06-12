import { MouseEvent, useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../themes/globals';
import { saveQRCode } from '../util/saveQRCode';
import { AnimatedFlex } from './basic/Flex';

// AnimatedFlex because we fade in the QR code a flicker on first render
const StyledQRView = styled(AnimatedFlex)<{
  size: number;
}>`
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  ${props => props.size && `width: ${props.size}px; height: ${props.size}px;`}
`;

export type SessionQRCodeProps = {
  id: string;
  value: string;
  size: number;
  hasLogo: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  logoImage?: string;
  logoSize?: number;
  loading: boolean;
  ariaLabel?: string;
  dataTestId?: string;
  style?: CSSProperties;
};

export function SessionQRCode(props: SessionQRCodeProps) {
  const {
    id,
    value,
    size,
    backgroundColor,
    foregroundColor,
    hasLogo,
    logoImage,
    logoSize,
    ariaLabel,
    dataTestId,
    loading,
    style,
  } = props;
  const [logo, setLogo] = useState(logoImage);
  const [bgColor, setBgColor] = useState(backgroundColor);
  const [fgColor, setFgColor] = useState(foregroundColor);

  const qrRef = useRef<QRCode>(null);
  const qrCanvasSize = 1000;
  const canvasLogoSize = logoSize ? (qrCanvasSize * 0.25 * logoSize) / logoSize : 250;

  useEffect(() => {
    // Don't pass the component props to the QR component directly instead update it's props in the next render cycle to prevent janky renders
    if (loading) {
      return;
    }

    if (bgColor !== backgroundColor) {
      setBgColor(backgroundColor);
    }

    if (fgColor !== foregroundColor) {
      setFgColor(foregroundColor);
    }

    if (hasLogo && logo !== logoImage) {
      setLogo(logoImage);
    }
  }, [backgroundColor, bgColor, fgColor, foregroundColor, hasLogo, loading, logo, logoImage]);

  return (
    <StyledQRView
      container={true}
      justifyContent="center"
      alignItems="center"
      size={size}
      id={id}
      aria-label={ariaLabel || 'QR code'}
      title={window.i18n('clickToTrustContact')}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        void saveQRCode(id, {
          ...props,
          id: `temp-${props.id}`,
          style: { display: 'none' },
        });
      }}
      data-testId={dataTestId || 'session-qr-code'}
      initial={{ opacity: 0 }}
      animate={{ opacity: loading ? 0 : 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      style={style}
    >
      <QRCode
        ref={qrRef}
        id={`${id}-canvas`}
        value={value}
        ecLevel={'Q'}
        size={qrCanvasSize}
        bgColor={bgColor}
        fgColor={fgColor}
        quietZone={40}
        logoImage={logo}
        logoWidth={canvasLogoSize}
        logoHeight={canvasLogoSize}
        removeQrCodeBehindLogo={true}
        style={{
          width: size,
          height: size,
        }}
      />
    </StyledQRView>
  );
}
