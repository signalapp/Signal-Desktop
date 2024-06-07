import { isString } from 'lodash';
import { LocaleMessagesType } from './locale';

export const createTemplate = (
  options: {
    openReleaseNotes: () => void;
    openSupportPage: () => void;
    platform: string;
    showAbout: () => void;
    showDebugLog: () => void;
    showWindow: () => void;
  },
  messages: LocaleMessagesType
) => {
  if (!isString(options.platform)) {
    throw new TypeError('`options.platform` must be a string');
  }

  const { openReleaseNotes, openSupportPage, platform, showAbout, showDebugLog, showWindow } =
    options;

  const template = [
    {
      label: messages.mainMenuFile,
      submenu: [
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: messages.appMenuQuit,
        },
      ],
    },
    {
      label: messages.mainMenuEdit,
      submenu: [
        {
          role: 'undo',
          label: messages.editMenuUndo,
        },
        {
          role: 'redo',
          label: messages.editMenuRedo,
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: messages.editMenuCut,
        },
        {
          role: 'copy',
          label: messages.editMenuCopy,
        },
        {
          role: 'paste',
          label: messages.editMenuPaste,
        },
        {
          role: 'delete',
          label: messages.delete,
        },
        {
          role: 'selectall',
          label: messages.editMenuSelectAll,
        },
      ],
    },
    {
      label: messages.mainMenuView,
      submenu: [
        {
          role: 'resetzoom',
          label: messages.viewMenuResetZoom,
        },
        {
          accelerator: platform === 'darwin' ? 'Command+=' : 'Control+Plus',
          role: 'zoomin',
          label: messages.viewMenuZoomIn,
        },
        {
          role: 'zoomout',
          label: messages.viewMenuZoomOut,
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: messages.viewMenuToggleFullScreen,
        },
        {
          type: 'separator',
        },
        {
          label: messages.debugLog,
          click: showDebugLog,
        },
        {
          type: 'separator',
        },
        {
          role: 'toggledevtools',
          label: messages.viewMenuToggleDevTools,
        },
      ],
    },
    {
      label: messages.mainMenuWindow,
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: messages.windowMenuMinimize,
        },
      ],
    },
    {
      label: messages.mainMenuHelp,
      role: 'help',
      submenu: [
        {
          label: messages.goToReleaseNotes,
          click: openReleaseNotes,
        },
        {
          type: 'separator',
        },
        {
          label: messages.goToSupportPage,
          click: openSupportPage,
        },
        {
          type: 'separator',
        },
        {
          label: messages.about,
          click: showAbout,
        },
      ],
    },
  ];

  if (platform === 'darwin') {
    return updateForMac(template, messages, {
      showAbout,
      showWindow,
    });
  }

  return template;
};

function updateForMac(
  template: any,
  messages: LocaleMessagesType,
  options: { showAbout: () => void; showWindow: () => void }
) {
  const { showAbout, showWindow } = options;

  // Remove About item and separator from Help menu, since it's on the first menu
  template[4].submenu.pop();
  template[4].submenu.pop();

  // Remove File menu
  template.shift();

  // Add the OSX-specific Signal Desktop menu at the far left
  template.unshift({
    label: messages.sessionMessenger,
    submenu: [
      {
        label: messages.about,
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuHide,
        role: 'hide',
      },
      {
        label: messages.appMenuHideOthers,
        role: 'hideothers',
      },
      {
        label: messages.appMenuUnhide,
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuQuit,
        role: 'quit',
      },
    ],
  });

  // Replace Window menu
  const windowMenuTemplateIndex = 3;
  // eslint-disable-next-line no-param-reassign
  template[windowMenuTemplateIndex].submenu = [
    {
      label: messages.windowMenuClose,
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      label: messages.windowMenuMinimize,
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: messages.windowMenuZoom,
      role: 'zoom',
    },
    {
      label: messages.show,
      click: showWindow,
    },
  ];

  return template;
}
