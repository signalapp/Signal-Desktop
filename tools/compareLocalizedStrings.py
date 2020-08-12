#!/bin/python3


# usage : ./tools/compareLocalizedStrings.py en de

import re
import os
from glob import glob
import json
import sys

if len(sys.argv) != 3:
    print(f'usage: {sys.argv[0]} <source_local> <compare_local>')
    sys.exit(1)

src = sys.argv[1]
dest = sys.argv[2]
print(f'src {src}, dest {dest}')
jsonInEn = json.loads(open(f'_locales/{src}/messages.json', 'r').read())
jsonInDe = json.loads(open(f'_locales/{dest}/messages.json', 'r').read())
keysInEn = jsonInEn.keys()
keysInDe = jsonInDe.keys()

print(keysInEn)

for key in keysInEn:
    if key not in keysInDe:
        print(f'not found in de:{key}')

print(f'total keys in en {len(keysInEn)}')