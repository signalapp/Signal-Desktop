#!/bin/python3


import re
from os import path, listdir
from glob import glob
import json
import sys
from collections import OrderedDict

LOCALES_FOLDER = './_locales'

EN_FILE = LOCALES_FOLDER + '/en/messages.json'

LOCALIZED_KEYS_FILE = './ts/types/LocalizerKeys.ts'

stringToWrite = "export type LocalizerKeys =\n  | "

with open(EN_FILE,'r') as jsonFile:
    data = json.loads(jsonFile.read(), object_pairs_hook=OrderedDict)
    keys = sorted(list(data.keys()))

    stringToWrite += json.dumps(keys, sort_keys=True).replace(',', '\n  |').replace('"', '\'')[1:-1]


    stringToWrite += ';\n'
    # print(stringToWrite)
    with open(LOCALIZED_KEYS_FILE, "w") as typeFile:
        typeFile.write(stringToWrite)

print('Updated LocalizerKeys.ts')
