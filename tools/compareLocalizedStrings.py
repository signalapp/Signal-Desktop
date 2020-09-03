#!/bin/python3


# usage : ./tools/compareLocalizedStrings.py en de

import re
from os import path, listdir
from glob import glob
import json
import sys

LOCALES_FOLDER = './_locales'


if len(sys.argv) != 1 and len(sys.argv) != 2:
    print(f'usage: {sys.argv[0]} <compared_locale>. If compared locale is not set, all found locales will be cleaned')
    sys.exit(1)

if (len(sys.argv) > 1):
    localesToCheck = [f'{LOCALES_FOLDER}{sys.argv[1]}']
else:
    localesToCheck = [path.join(LOCALES_FOLDER, o) for o in listdir(LOCALES_FOLDER) if path.isdir(path.join(LOCALES_FOLDER,o))]

for dest in localesToCheck:
    if dest == f'{LOCALES_FOLDER}/en':
        print('skipping "en" locale...')
        continue

    destFilePath = f'{dest}/messages.json'
    # print(f'dest {dest}, destFilePath {destFilePath}')

    jsonInSrc = json.loads(open(f'{LOCALES_FOLDER}/en/messages.json', 'r').read())
    jsonInDest = json.loads(open(destFilePath, 'r').read())
    keysInSrc = jsonInSrc.keys()
    keysInDest = jsonInDest.keys()

    destMinusSrc = list(set(keysInDest) - set(keysInSrc))
    for key in destMinusSrc:
        # print(f'Present in "{dest}" but not found in "{src}": {key}')
        del jsonInDest[key]

    print(f'total keys in "{dest}" to remove: {len(destMinusSrc)}')

    # write the updated json dict to the file
    with open(destFilePath, 'w') as outfile:
        json.dump(jsonInDest, outfile, indent=4, ensure_ascii=False)
