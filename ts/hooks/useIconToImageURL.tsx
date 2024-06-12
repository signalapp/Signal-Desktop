import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useMount from 'react-use/lib/useMount';
import { SessionIcon, SessionIconProps, SessionIconType } from '../components/icon';
import { sleepFor } from '../session/utils/Promise';
import { useIsDarkTheme } from '../state/selectors/theme';
import { ThemeKeys, getThemeValue } from '../themes/globals';

const chooseIconColors = (
  isThemed: boolean,
  isDarkTheme: boolean,
  darkColor: ThemeKeys,
  lightColor: ThemeKeys,
  fallbackColor: ThemeKeys
) => {
  return getThemeValue(isThemed ? (isDarkTheme ? darkColor : lightColor) : fallbackColor);
};

const convertIconToImageURL = async (
  props: { isThemed: boolean; isDarkTheme: boolean } & Pick<
    SessionIconProps,
    'iconType' | 'iconSize' | 'iconColor' | 'backgroundColor'
  >
): Promise<{ dataUrl: string; bgColor: string; fgColor: string }> => {
  const { isThemed, isDarkTheme, iconType, iconSize } = props;
  let { iconColor, backgroundColor } = props;

  if (!backgroundColor) {
    backgroundColor = chooseIconColors(
      isThemed,
      isDarkTheme,
      '--text-primary-color',
      '--background-primary-color',
      '--white-color'
    );
  }

  if (!iconColor) {
    iconColor = chooseIconColors(
      isThemed,
      isDarkTheme,
      '--background-primary-color',
      '--text-primary-color',
      '--black-color'
    );
  }

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

  return {
    bgColor: backgroundColor,
    fgColor: iconColor,
    dataUrl: svgString ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}` : '',
  };
};

export const useIconToImageURL = ({
  iconType,
  iconSize,
  isThemed = true,
}: {
  iconType: SessionIconType;
  iconSize: number;
  isThemed?: boolean;
}) => {
  const isDarkTheme = useIsDarkTheme();
  const [dataURL, setDataURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inDarkTheme, setInDarkTheme] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('');
  const [iconColor, setIconColor] = useState('');

  const loadURL = useCallback(async () => {
    setLoading(true);
    setDataURL('');

    try {
      const {
        dataUrl: newURL,
        bgColor,
        fgColor,
      } = await convertIconToImageURL({
        isThemed,
        isDarkTheme,
        iconType,
        iconSize,
        iconColor,
        backgroundColor,
      });

      if (!newURL) {
        throw new Error('[useIconToImageURL] Failed to convert icon to URL');
      }

      setBackgroundColor(bgColor);
      setIconColor(fgColor);
      setDataURL(newURL);

      if (!mounted) {
        setMounted(true);
      }
      setLoading(false);
      setInDarkTheme(!!isThemed && isDarkTheme);
    } catch (error) {
      window.log.error('[useIconToImageURL] Error fetching icon data url', error);
    }
  }, [backgroundColor, iconColor, iconSize, iconType, isDarkTheme, isThemed, mounted]);

  useMount(() => {
    void loadURL();
  });

  useEffect(() => {
    if (!loading && mounted && isThemed && isDarkTheme !== inDarkTheme) {
      void loadURL();
    }
  }, [inDarkTheme, isDarkTheme, isThemed, loadURL, loading, mounted]);

  return { dataURL, iconSize, iconColor, backgroundColor, loading };
};
