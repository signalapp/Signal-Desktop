#!/bin/sh

const filesToRename = [
  { from: 'es-419', to: 'es_419' },
  { from: 'es-ES', to: 'es' },
  { from: 'nn-NO', to: 'no' },
  { from: 'pa-IN', to: 'pa' },
  { from: 'pt-BR', to: 'pt_NR' },
  { from: 'pt-PT', to: 'pt_PT' },
  { from: 'sv-SE', to: 'sv' },
  { from: 'sr-CS', to: 'sr' },
  { from: 'zh-CN', to: 'zh_CN' },
  { from: 'zh-TW', to: 'zh_TW' },
];

mv $PWD/_locales/es-419/messages.json $PWD/_locales/es_419/messages.json
mv $PWD/_locales/es-ES/messages.json $PWD/_locales/es/messages.json
mv $PWD/_locales/nn-NO/messages.json $PWD/_locales/no/messages.json
mv $PWD/_locales/pa-IN/messages.json $PWD/_locales/pa/messages.json
mv $PWD/_locales/pt-BR/messages.json $PWD/_locales/pt_BR/messages.json
mv $PWD/_locales/pt-PT/messages.json $PWD/_locales/pt_PT/messages.json
mv $PWD/_locales/sv-SE/messages.json $PWD/_locales/sv/messages.json
mv $PWD/_locales/sr-CS/messages.json $PWD/_locales/sr/messages.json
mv $PWD/_locales/zh-CN/messages.json $PWD/_locales/zh_CN/messages.json
mv $PWD/_locales/zh-TW/messages.json $PWD/_locales/zh_TW/messages.json

