import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    common: {
      fonts: {
        sessionFontDefault: string;
        sessionFontAccent: string;
        sessionFontMono: string;
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
      };
      margins: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
      };
      animations: {
        defaultDuration: string;
      };
    };
    colors: {
      accent: string;
      accentButton: string;
      warning: string;
      destructive: string;
      // text
      textColor: string;
      textColorSubtle: string;
      textColorOpposite: string;
      textAccent: string;
      // conversation view
      composeViewButtonBackground: string;
      sentMessageBackground: string;
      sentMessageText: string;
      sessionShadow: string;
      // left pane
      clickableHovered: string;
      sessionBorder: string;
      sessionBorderColor: string;
      recoveryPhraseBannerBackground: string;
      // pill divider:
      pillDividerColor: string;
      // context menu
      lastSeenIndicatorColor: string;
      lastSeenIndicatorTextColor: string;
      quoteBottomBarBackground: string;
    };
  }
}
