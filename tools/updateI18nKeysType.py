#!/bin/python3


# usage : ./tools/compareLocalizedStrings.py en de

import re
from os import path, listdir
from glob import glob
import json
import sys

LOCALES_FOLDER = './_locales'

EN_FILE = LOCALES_FOLDER + '/en/messages.json'

LOCALIZED_KEYS_FILE = './ts/types/LocalizerKeys.ts'

stringToWrite = "export type LocalizerKeys =\n  | "

with open(EN_FILE,'r') as jsonFile:
    data = json.load(jsonFile)
    keys = data.keys()

    stringToWrite += json.dumps(keys, sort_keys=True).replace(',', '\n  |').replace('"', '\'')[1:-1]

    stringToWrite += ';\n'
    # print(stringToWrite)
    with open(LOCALIZED_KEYS_FILE, "w") as typeFile:
        typeFile.write(stringToWrite)

print('Updated LocalizerKeys.ts')
