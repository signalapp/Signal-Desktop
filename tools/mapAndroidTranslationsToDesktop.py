#!/bin/python3

import re
import os
from glob import glob
import json
import sys
import xmltodict

# androidKey
# "androidKeyCount": "one" or "other" used to find matching key with quantity
# replace \\' with '
# replace \\\" with \"
# "wordCapitalize": true capitalize each words (must be called before addStart)
# "addStart": "&" char to add as start char
# "androidReplace": replace all occurences of key value pair

allowedItemKeys = ['message', 'description', 'comment', 'placeholders', 'androidKey', 'wordCapitalize', 'androidKeyCount', 'androidReplace', 'addStart']

if len(sys.argv) != 3:
    print(f"usage: {sys.argv[0]} <dst language i.e. 'de'> <android_root folder>")
    sys.exit(1)

dest = sys.argv[1]
androidRoot = sys.argv[2]

desktopSrc = json.loads(open(f"_locales/en/messages.json",
 "r").read())
desktopDst = json.loads(open(f"_locales/{dest}/messages.json",
 "r").read())

androidEnValueFile = f"{androidRoot}/res/values/strings.xml"
androidTranslatedValueFile = f"{androidRoot}/res/values-{dest}/strings.xml"
print(f"androidEnValueFile {androidEnValueFile}")
print(f"androidTranslatedValueFile {androidTranslatedValueFile}")

androidEnXml = open(androidEnValueFile, "r").read()
androidTranslatedXml = open(androidTranslatedValueFile, "r").read()
androidEnJsonSingular = xmltodict.parse(androidEnXml)['resources']['string']
androidEnJsonPlurals = xmltodict.parse(androidEnXml)['resources']['plurals']

androidEnJsonSingular = [dict(item) for item in androidEnJsonSingular]
androidEnJsonPlurals = [dict(item) for item in androidEnJsonPlurals]
androidTranslatedJson = xmltodict.parse(androidTranslatedXml)

# print(f"androidTranslatedXml {androidTranslatedXml}")
# print(f"\n\n\n\n androidEnJsonSingular {androidEnJsonSingular}")
# print(f"\n\n\n\n androidEnJsonPlurals {androidEnJsonPlurals}")

missingAndroidKeyCount = 0

def findCountInItem(quantityStr, items):
    found = [item for item in items if item['@quantity'] == quantityStr]
    # print(f'findCountInItem: {found}, quantityStr: {quantityStr}')

    if len(found) != 1:
        raise Exception(f'quantityStr not found: {quantityStr} ')
    return dict(found[0])


def findByNameSingular(keySearchedFor, singularString):
    found = [item for item in singularString if item['@name'] == keySearchedFor]
    if len(found) != 1:
        raise Exception(f'android key not found: {keySearchedFor} but should have been found')
    return found[0]

def findByNamePlurals(keySearchedFor, pluralsString, quantityStr):
    found = [item for item in pluralsString if item['@name'] == keySearchedFor]
    if len(found) != 1:
        raise Exception(f'android key not found: {keySearchedFor} but should have been found')
    found = findCountInItem(quantityStr, found[0]['item'])

    return found

def validateKeysPresent(items):
    for keyItem, valueItem in items:
        if keyItem not in allowedItemKeys:
            print(f"Invalid key item: {keyItem}")
            exit(1)
        # print(f"keyItem: '{keyItem}', valueItem: '{valueItem}'")


def morphToDesktopSyntax(androidString, desktopItem):
    # print(f"androidString: '{androidString}', desktopItem: '{desktopItem}'")
    replaced = androidString.replace(r"\'", "'")
    # replaced = androidString.replace(r"\’", "'")
    # replaced = androidString.replace('’', )

    if('wordCapitalize' in desktopItem.keys() and desktopItem['wordCapitalize']):
        replaced = replaced.title()

    if ('androidReplace' in desktopItem.keys()):
        for key, value in desktopItem['androidReplace'].items():
            replaced = replaced.replace(key.title(), value)
            replaced = replaced.replace(key, value)

    # print(f"androidString: '{androidString}', replaced: '{replaced}'")
    if ('addStart' in desktopItem.keys()):
        toAdd = desktopItem['addStart']
        replaced = f'{toAdd}{replaced}'
    return replaced

notMatching = 0


for key, value in desktopSrc.items():
    # print(f"key: '{key}', value: '{value}'")
    items = value.items()
    validateKeysPresent(items)
    if 'androidKey' not in value.keys():
        # print('androidKey not found for {key}')
        missingAndroidKeyCount = missingAndroidKeyCount + 1
        continue
    androidKey = value['androidKey']
    androidKeyCount = None
    if 'androidKeyCount' in value.keys():
        androidKeyCount = value['androidKeyCount']
    # print(f'key: {key}, androidKey: {androidKey}, androidKeyCount: {androidKeyCount}')
    itemEnDesktop = desktopSrc[key]
    txtEnDesktop = itemEnDesktop['message']
    if androidKeyCount:
        itemEnAndroid = findByNamePlurals(androidKey, androidEnJsonPlurals, androidKeyCount)
    else:
        itemEnAndroid = findByNameSingular(androidKey, androidEnJsonSingular)
    txtEnAndroid = itemEnAndroid['#text']

    morphedEnAndroid = morphToDesktopSyntax(txtEnAndroid, itemEnDesktop)
    if (txtEnDesktop != morphedEnAndroid):
        print(f'\t\tDOES NOT MATCH: "{txtEnDesktop}" vs "{morphedEnAndroid}", itemEnDesktop: {itemEnDesktop}\n\n')
        notMatching = notMatching + 1
    # else:
    #     print(f'MATCH: "{txtEnDesktop}" vs "{morphedEnAndroid}"')





print(f"total keys missing {missingAndroidKeyCount}") # androidKey set on desktop but not found on android EN resources
print(f"total text not matching EN to EN {notMatching}")