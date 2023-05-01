#!/bin/sh


mv $PWD/_locales/es-419 $PWD/_locales/es_419
mv $PWD/_locales/es-ES $PWD/_locales/es
mv $PWD/_locales/pa-IN $PWD/_locales/pa
mv $PWD/_locales/si-LK $PWD/_locales/si
mv $PWD/_locales/pt-BR $PWD/_locales/pt_BR
mv $PWD/_locales/pt-PT $PWD/_locales/pt_PT
mv $PWD/_locales/sv-SE $PWD/_locales/sv
mv $PWD/_locales/sr-CS $PWD/_locales/sr
mv $PWD/_locales/zh-CN $PWD/_locales/zh_CN
mv $PWD/_locales/zh-TW $PWD/_locales/zh_TW

echo 'Updated locales from crowdin to session-desktop folder'

python3 $PWD/tools/updateI18nKeysType.py

