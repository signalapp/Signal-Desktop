import { MouseEvent, useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { CSSProperties } from 'styled-components';
import { COLORS } from '../themes/constants/colors';
import { saveQRCode } from '../util/saveQRCode';
import { Flex } from './basic/Flex';

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
    backgroundColor = COLORS.WHITE,
    foregroundColor = COLORS.BLACK,
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
    if (!loading && hasLogo && logo !== logoImage) {
      setBgColor(backgroundColor);
      setFgColor(foregroundColor);
      setLogo(logoImage);
    }
  }, [backgroundColor, foregroundColor, hasLogo, loading, logo, logoImage]);

  return (
    <Flex
      container={true}
      justifyContent="center"
      alignItems="center"
      width={`${size}px`}
      height={`${size}px`}
      id={id}
      aria-label={ariaLabel || 'QR code'}
      title={window.i18n('clickToTrustContact')}
      // onClick={(event: MouseEvent<HTMLDivElement>) => {
      //   event.preventDefault();
      //   const fileName = `${id}-${new Date().toISOString()}.png`;
      //   try {
      //     qrRef.current?.download('png', fileName);
      //   } catch (e) {
      //     window.log.error(`Error downloading QR code: ${fileName}\n${e}`);
      //   }
      // }}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        void saveQRCode(id, {
          ...props,
          id: `temp-${props.id}`,
          style: { display: 'none' },
        });
      }}
      data-testId={dataTestId || 'session-qr-code'}
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
          borderRadius: '10px',
          cursor: 'pointer',
          overflow: 'hidden',
          width: size,
          height: size,
        }}
      />
    </Flex>
  );
}
