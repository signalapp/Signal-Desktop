import { isEmpty } from 'lodash';
import { CSSProperties, MouseEvent, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { useMount } from 'react-use';
import styled from 'styled-components';
import { THEME_GLOBALS, getThemeValue } from '../themes/globals';
import { saveQRCode } from '../util/saveQRCode';
import { AnimatedFlex } from './basic/Flex';

/** AnimatedFlex because we fade in the QR code to hide the logo flickering on first render
 * The container controls the visible width and height of the QR code because we lose quality if the html canvas size is too small so we scale down with CSS.
 */
const StyledQRView = styled(AnimatedFlex)<{
  canvasId?: string;
  size?: number;
  backgroundColor?: string;
}>`
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  padding: 10px;

  ${props => props.backgroundColor && ` background-color: ${props.backgroundColor}`};
  ${props =>
    props.canvasId &&
    props.size &&
    `#${props.canvasId} { width: ${props.size}px !important; height: ${props.size}px !important; }`}
`;

export type SessionQRCodeProps = {
  id: string;
  value: string;
  size: number;
  backgroundColor?: string;
  foregroundColor?: string;
  logoImage?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoIsSVG?: boolean;
  style?: CSSProperties;
  ignoreTheme?: boolean;
};

export function SessionQRCode(props: SessionQRCodeProps) {
  const {
    id,
    value,
    size,
    backgroundColor = 'white',
    foregroundColor = 'black',
    logoImage,
    logoWidth,
    logoHeight,
    logoIsSVG,
    style,
    ignoreTheme,
  } = props;

  const [svgDataURL, setSvgDataURL] = useState('');
  // Saving the QR code uses a separate react instance without the redux store so we don't use a selector here
  const theme = window.Events.getThemeSetting();

  useMount(() => {
    if (logoImage && logoIsSVG && isEmpty(svgDataURL)) {
      // eslint-disable-next-line more/no-then
      fetch(logoImage)
        .then(response => response.text())
        .then(response => {
          const svgString = ignoreTheme
            ? response
            : response.replaceAll(
                'black',
                getThemeValue(
                  theme.includes('dark') ? '--background-primary-color' : '--text-primary-color'
                )
              );
          setSvgDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`);
        })
        .catch(error =>
          window.log.error('Error fetching the QR Code logo which is an svg:', error)
        );
    }
  });

  if (logoImage && logoIsSVG && isEmpty(svgDataURL)) {
    return null;
  }

  const qrCanvasSize = 1000;
  const canvasLogoWidth =
    logoWidth && logoHeight ? (qrCanvasSize * 0.25 * logoWidth) / logoHeight : undefined;
  const canvasLogoHeight = logoHeight ? (qrCanvasSize * 0.25 * logoHeight) / logoHeight : undefined;

  return (
    <StyledQRView
      container={true}
      aria-label={window.i18n('clickToTrustContact')}
      title={window.i18n('clickToTrustContact')}
      canvasId={id}
      size={size}
      backgroundColor={backgroundColor}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        void saveQRCode(id, {
          ...props,
          id: `temp-${props.id}`,
          backgroundColor: 'white',
          foregroundColor: 'black',
          ignoreTheme: true,
          style: { display: 'none' },
        });
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
        size={qrCanvasSize}
        bgColor={backgroundColor}
        fgColor={foregroundColor}
        quietZone={0}
        logoImage={logoIsSVG ? svgDataURL : logoImage}
        logoWidth={canvasLogoWidth}
        logoHeight={canvasLogoHeight}
        removeQrCodeBehindLogo={true}
      />
    </StyledQRView>
  );
}
