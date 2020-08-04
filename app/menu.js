const { isString } = require('lodash');

exports.createTemplate = (options, messages) => {
  if (!isString(options.platform)) {
    throw new TypeError('`options.platform` must be a string');
  }

  const {
    isBeta,
    includeSetup,
    openContactUs,
    openGithub,
    openForums,
    openJoinTheBeta,
    openReleaseNotes,
    openSupportPage,
    platform,
    setupAsNewDevice,
    setupAsStandalone,
    showAbout,
    showDebugLog,
    showKeyboardShortcuts,
    showSettings,
    showStickerCreator,
  } = options;

  const template = [
    {
      label: messages.mainMenuFile.message,
      submenu: [
        {
          label: messages.mainMenuCreateStickers.message,
          click: showStickerCreator,
        },
        {
          label: messages.mainMenuSettings.message,
          accelerator: 'CommandOrControl+,',
          click: showSettings,
        },
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: messages.appMenuQuit.message,
        },
      ],
    },
    {
      label: messages.mainMenuEdit.message,
      submenu: [
        {
          role: 'undo',
          label: messages.editMenuUndo.message,
        },
        {
          role: 'redo',
          label: messages.editMenuRedo.message,
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: messages.editMenuCut.message,
        },
        {
          role: 'copy',
          label: messages.editMenuCopy.message,
        },
        {
          role: 'paste',
          label: messages.editMenuPaste.message,
        },
        {
          role: 'pasteandmatchstyle',
          label: messages.editMenuPasteAndMatchStyle.message,
        },
        {
          role: 'delete',
          label: messages.editMenuDelete.message,
        },
        {
          role: 'selectall',
          label: messages.editMenuSelectAll.message,
        },
      ],
    },
    {
      label: messages.mainMenuView.message,
      submenu: [
        {
          role: 'resetzoom',
          label: messages.viewMenuResetZoom.message,
        },
        {
          accelerator: platform === 'darwin' ? 'Command+=' : 'Control+=',
          role: 'zoomin',
          label: messages.viewMenuZoomIn.message,
        },
        {
          role: 'zoomout',
          label: messages.viewMenuZoomOut.message,
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: messages.viewMenuToggleFullScreen.message,
        },
        {
          type: 'separator',
        },
        {
          label: messages.debugLog.message,
          click: showDebugLog,
        },
        {
          type: 'separator',
        },
        {
          role: 'toggledevtools',
          label: messages.viewMenuToggleDevTools.message,
        },
      ],
    },
    {
      label: messages.mainMenuWindow.message,
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: messages.windowMenuMinimize.message,
        },
      ],
    },
    {
      label: messages.mainMenuHelp.message,
      role: 'help',
      submenu: [
        {
          label: messages.helpMenuShowKeyboardShortcuts.message,
          accelerator: 'CmdOrCtrl+/',
          click: showKeyboardShortcuts,
        },
        {
          type: 'separator',
        },
        {
          label: messages.contactUs.message,
          click: openContactUs,
        },
        {
          label: messages.goToReleaseNotes.message,
          click: openReleaseNotes,
        },
        {
          label: messages.goToForums.message,
          click: openForums,
        },
        {
          label: messages.goToSupportPage.message,
          click: openSupportPage,
        },
        {
          label: messages.goToGithub.message,
          click: openGithub,
        },
        ...(!isBeta
          ? [
              {
                label: messages.joinTheBeta.message,
                click: openJoinTheBeta,
              },
            ]
          : []),
        {
          type: 'separator',
        },
        {
          label: messages.aboutSignalDesktop.message,
          click: showAbout,
        },
      ],
    },
  ];

  if (includeSetup) {
    const fileMenu = template[0];

    // These are in reverse order, since we're prepending them one at a time
    if (options.development) {
      fileMenu.submenu.unshift({
        label: messages.menuSetupAsStandalone.message,
        click: setupAsStandalone,
      });
    }

    fileMenu.submenu.unshift({
      type: 'separator',
    });
    fileMenu.submenu.unshift({
      label: messages.menuSetupAsNewDevice.message,
      click: setupAsNewDevice,
    });
  }

  if (platform === 'darwin') {
    return updateForMac(template, messages, options);
  }

  return template;
};

function updateForMac(template, messages, options) {
  const { showAbout, showSettings, showWindow } = options;

  // Remove About item and separator from Help menu, since they're in the app menu
  template[4].submenu.pop();
  template[4].submenu.pop();

  // Remove preferences, separator, and quit from the File menu, since they're
  // in the app menu
  const fileMenu = template[0];
  fileMenu.submenu.pop();
  fileMenu.submenu.pop();
  fileMenu.submenu.pop();

  // Add the OSX-specific Signal Desktop menu at the far left
  template.unshift({
    label: messages.signalDesktop.message,
    submenu: [
      {
        label: messages.aboutSignalDesktop.message,
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        label: messages.mainMenuSettings.message,
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuHide.message,
        role: 'hide',
      },
      {
        label: messages.appMenuHideOthers.message,
        role: 'hideothers',
      },
      {
        label: messages.appMenuUnhide.message,
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuQuit.message,
        role: 'quit',
      },
    ],
  });

  // Add to Edit menu
  template[2].submenu.push(
    {
      type: 'separator',
    },
    {
      label: messages.speech.message,
      submenu: [
        {
          role: 'startspeaking',
          label: messages.editMenuStartSpeaking.message,
        },
        {
          role: 'stopspeaking',
          label: messages.editMenuStopSpeaking.message,
        },
      ],
    }
  );

  // Replace Window menu
  // eslint-disable-next-line no-param-reassign
  template[4].submenu = [
    {
      label: messages.windowMenuClose.message,
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      label: messages.windowMenuMinimize.message,
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: messages.windowMenuZoom.message,
      role: 'zoom',
    },
    {
      label: messages.show.message,
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
      label: messages.windowMenuBringAllToFront.message,
    },
  ];

  return template;
}
