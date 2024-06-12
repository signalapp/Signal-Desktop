import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useMount from 'react-use/lib/useMount';
import { SessionIcon, SessionIconProps, SessionIconType } from '../components/icon';
import { sleepFor } from '../session/utils/Promise';
import { useIsDarkTheme } from '../state/selectors/theme';
import { COLORS } from '../themes/constants/colors';
import { getThemeValue } from '../themes/globals';
import { ThemeColorVariables } from '../themes/variableColors';

const convertIconToImageURL = async (
  props: Pick<SessionIconProps, 'iconType' | 'iconSize' | 'iconColor' | 'backgroundColor'>
) => {
  const { iconType, iconSize, iconColor = COLORS.BLACK, backgroundColor = COLORS.WHITE } = props;

  const root = document.querySelector('#root');
  const divElement = document.createElement('div');
  divElement.id = 'icon-to-image-url';
  root?.appendChild(divElement);

  const reactRoot = createRoot(divElement!);
  reactRoot.render(
    <SessionIcon
      iconType={iconType}
      iconSize={iconSize}
      iconColor={iconColor}
      backgroundColor={backgroundColor}
    />
  );
  // wait for it to render
  await sleepFor(100);
  const svg = root?.querySelector(`#icon-to-image-url svg`);
  svg?.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgString = svg?.outerHTML;
  reactRoot?.unmount();
  root?.removeChild(divElement);

  if (svgString) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }

  return null;
};

export const useIconToImageURL = ({
  iconType,
  iconSize,
  theming = true,
}: {
  iconType: SessionIconType;
  iconSize: number;
  theming?: boolean;
}) => {
  const isDarkTheme = useIsDarkTheme();
  const [dataURL, setDataURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inDarkTheme, setInDarkTheme] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('');
  const [iconColor, setIconColor] = useState('');

  const chooseColor = useCallback(
    (darkColor: keyof ThemeColorVariables, lightColor: keyof ThemeColorVariables) => {
      return theming ? getThemeValue(isDarkTheme ? darkColor : lightColor) : '';
    },
    [isDarkTheme, theming]
  );

  const loadURL = useCallback(async () => {
    setLoading(true);
    setDataURL('');
    try {
      const bgColor = chooseColor('--text-primary-color', '--background-primary-color');
      const fgColor = chooseColor('--background-primary-color', '--text-primary-color');

      setBackgroundColor(bgColor);
      setIconColor(fgColor);

      const newURL = await convertIconToImageURL({
        iconType,
        iconSize,
        iconColor: fgColor,
        backgroundColor: bgColor,
      });

      if (!newURL) {
        throw new Error('[useIconToImageURL] Failed to convert icon to URL');
      }
      setDataURL(newURL);
      setInDarkTheme(!!theming && isDarkTheme);

      if (!mounted) {
        setMounted(true);
      }
      setLoading(false);
    } catch (error) {
      window.log.error('[useIconToImageURL] Error fetching icon data url', error);
    }
  }, [chooseColor, iconSize, iconType, isDarkTheme, mounted, theming]);

  useMount(() => {
    void loadURL();
  });

  useEffect(() => {
    if (mounted && theming && isDarkTheme !== inDarkTheme) {
      void loadURL();
    }
  }, [inDarkTheme, isDarkTheme, loadURL, mounted, theming]);

  const returnProps = { dataURL, iconSize, iconColor, backgroundColor, loading };

  window.log.debug(`WIP: [useIconToImageURL] returnProps: ${JSON.stringify(returnProps)}`);

  return returnProps;
};
