import { MouseEvent, useRef } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { CSSProperties } from 'styled-components';
import { ThemeStateType } from '../themes/constants/colors';
import { THEME_GLOBALS } from '../themes/globals';
import { AnimatedFlex } from './basic/Flex';

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
  theme?: ThemeStateType;
  ignoreTheme?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
  style?: CSSProperties;
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
    theme,
    ignoreTheme,
    ariaLabel,
    dataTestId,
    style,
  } = props;

  const qrRef = useRef<QRCode>(null);

  // const [svgDataURL, setSvgDataURL] = useState('');
  // const [currentTheme, setCurrentTheme] = useState(theme);
  // const [loading, setLoading] = useState(false);

  // const loadLogoImage = useCallback(async () => {
  //   if (logoImage && logoIsSVG) {
  //     setLoading(true);
  //     try {
  //       const response = await fetch(logoImage);
  //       let svgString = await response.text();

  //       if (!ignoreTheme && theme && !isEmpty(theme)) {
  //         svgString = svgString.replaceAll(
  //           'black',
  //           getThemeValue(
  //             checkDarkTheme(theme) ? '--background-primary-color' : '--text-primary-color'
  //           )
  //         );
  //       }

  //       setSvgDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`);
  //     } catch (error) {
  //       window.log.error('Error fetching the QR Code logo which is an svg:', error);
  //     }
  //     setLoading(false);
  //   }
  // }, [ignoreTheme, logoImage, logoIsSVG, theme]);

  // useMount(() => {
  //   void loadLogoImage();
  // });

  // useEffect(() => {
  //   if (theme && theme !== currentTheme) {
  //     setCurrentTheme(theme);
  //     void loadLogoImage();
  //   }
  // }, [currentTheme, loadLogoImage, theme]);

  const qrCanvasSize = 1000;
  const canvasLogoWidth =
    logoWidth && logoHeight ? (qrCanvasSize * 0.25 * logoWidth) / logoHeight : undefined;
  const canvasLogoHeight = logoHeight ? (qrCanvasSize * 0.25 * logoHeight) / logoHeight : undefined;

  // We use an AnimatedFlex because we fade in the QR code to hide the logo flickering on first render
  return (
    <AnimatedFlex
      container={true}
      justifyContent="center"
      alignItems="center"
      width={`${size}px`}
      height={`${size}px`}
      id={id}
      aria-label={ariaLabel || 'QR code'}
      title={window.i18n('clickToTrustContact')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        qrRef.current?.download('jpg', id);
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
        bgColor={backgroundColor}
        fgColor={foregroundColor}
        quietZone={40}
        logoImage={logoImage}
        logoWidth={canvasLogoWidth}
        logoHeight={canvasLogoHeight}
        removeQrCodeBehindLogo={true}
        logoOnLoad={e => window.log.debug(`WIP: [SessionQRCode] logo loaded`, e)}
        style={{
          borderRadius: '10px',
          cursor: 'pointer',
          overflow: 'hidden',
          width: size,
          height: size,
        }}
      />
    </AnimatedFlex>
  );
}
