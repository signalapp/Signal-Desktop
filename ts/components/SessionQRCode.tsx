import { MouseEvent, useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../themes/globals';
import { saveBWQRCode } from '../util/saveBWQRCode';
import { AnimatedFlex } from './basic/Flex';
import { SessionIconType } from './icon';

// AnimatedFlex because we fade in the QR code a flicker on first render
const StyledQRView = styled(AnimatedFlex)<{
  size: number;
}>`
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  ${props => props.size && `width: ${props.size}px; height: ${props.size}px;`}
`;

export type QRCodeLogoProps = { iconType: SessionIconType; iconSize: number };

export type SessionQRCodeProps = {
  id: string;
  value: string;
  size: number;
  backgroundColor?: string;
  foregroundColor?: string;
  hasLogo?: QRCodeLogoProps;
  logoImage?: string;
  logoSize?: number;
  ariaLabel?: string;
  dataTestId?: string;
  style?: CSSProperties;
  loading?: boolean;
  saveWithTheme?: boolean;
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
    style,
    loading,
    saveWithTheme = false,
  } = props;
  const [logo, setLogo] = useState(logoImage);
  const [bgColor, setBgColor] = useState(backgroundColor);
  const [fgColor, setFgColor] = useState(foregroundColor);

  const qrRef = useRef<QRCode>(null);
  const qrCanvasSize = 1000;
  const canvasLogoSize = logoSize ? (qrCanvasSize * 0.25 * logoSize) / logoSize : 250;

  const saveQRCode = async () => {
    const fileName = `${id}-${new Date().toISOString()}.jpg`;
    try {
      if (saveWithTheme) {
        qrRef.current?.download('jpg', fileName);
      } else {
        void saveBWQRCode(fileName, {
          id: `${id}-save`,
          value,
          size,
          hasLogo,
          logoImage,
          logoSize,
        });
      }
    } catch (err) {
      window.log.error(`QR code save failed! ${fileName}\n${err}`);
    }
  };

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
        void saveQRCode();
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
