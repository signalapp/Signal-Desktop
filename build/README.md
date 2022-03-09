APP ICONS
"""""""""

If you update the app icon, you also need to update all those file generated from it and based on https://www.electron.build/icons.html.

The current source file is build/session_icon_source_1024px.png

-> macOS: use https://cloudconvert.com/png-to-icns to get .icns from the 1024px.png source file => save as icon-mac.icns
-> windows: use https://cloudconvert.com/png-to-ico to get .ico from the 1024px.png source file => save as icon.ico
-> linux: build binaries on github actions, get the zip with the deb+appImage, extract it, all the icons are in a .icons-set folder, and you can copy paste them into build/icons
