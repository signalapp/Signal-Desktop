#!/bin/python3

import re
import os
from glob import glob
import json
import sys
import xmltodict
import traceback

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

def getDictFromFile(filepath, keyToSearch):
    xml = open(filepath, "r").read()
    asDict = xmltodict.parse(xml)['resources'][keyToSearch]
    return [dict(item) for item in asDict]

def getStringFromFileAsJSON(filepath):
    return getDictFromFile(filepath, 'string')

def getPluralsFromFileAsJSON(filepath):
    return getDictFromFile(filepath, 'plurals')

# read and extract values from xml file in EN android side
androidEnJsonSingular = getStringFromFileAsJSON(androidEnValueFile)
androidEnJsonPlurals = getPluralsFromFileAsJSON(androidEnValueFile)

# read and extract values from xml file in DESTINATION LANGUAGE android side
androidDestJsonSingular = getStringFromFileAsJSON(androidTranslatedValueFile)
androidDestJsonPlurals = getPluralsFromFileAsJSON(androidTranslatedValueFile)

# print(f"androidDestJsonSingular {androidDestJsonSingular}")
# print(f"androidDestJsonPlurals {androidDestJsonPlurals}")
# print(f"\n\n\n\n androidEnJsonSingular {androidEnJsonSingular}")
# print(f"\n\n\n\n androidEnJsonPlurals {androidEnJsonPlurals}")

missingAndroidKeyCount = 0
notMatchingCount = 0

def findCountInItem(quantityStr, items):
    found = [item for item in items if item['@quantity'] == quantityStr]
    # print(f'findCountInItem: {found}, quantityStr: {quantityStr}')

    if len(found) != 1:
        raise KeyError(f'quantityStr not found: {quantityStr} ')
    return dict(found[0])


def findByNameSingular(keySearchedFor, singularString):
    found = [item for item in singularString if item['@name'] == keySearchedFor]
    if len(found) != 1:
        raise KeyError(f'android key singular not found: {keySearchedFor} but should have been found')
    return found[0]


def findByNamePlurals(keySearchedFor, pluralsString, quantityStr):
    found = [item for item in pluralsString if item['@name'] == keySearchedFor]
    if len(found) != 1:
        raise KeyError(f'android key plurals not found: {keySearchedFor} but should have been found')
    return findCountInItem(quantityStr, found[0]['item'])


def validateKeysPresent(items):
    for keyItem, valueItem in items:
        if keyItem not in allowedItemKeys:
            print(f"Invalid key item: {keyItem}")
            exit(1)
        # print(f"keyItem: '{keyItem}', valueItem: '{valueItem}'")


# morph a string from android syntax to desktop syntax. Like replacing char, or %s
def morphToDesktopSyntax(androidString, desktopItem):
    replaced = androidString.replace(r"\'", "'")

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

def getAndroidItem(androidKey, androidKeyCount, singularJson, pluralsJson):
    if androidKeyCount:
        return findByNamePlurals(androidKey, pluralsJson, androidKeyCount)
    else:
        return findByNameSingular(androidKey, singularJson)

def getAndroidKeyCountFromItem(item):
    androidKeyCount = None
    if 'androidKeyCount' in item.keys():
        androidKeyCount = item['androidKeyCount']
    return androidKeyCount



###################  MAIN #####################
for key, itemEnDesktop in desktopSrc.items():
    # print(f"key: '{key}', itemEnDesktop: '{itemEnDesktop}'")
    items = itemEnDesktop.items()
    validateKeysPresent(items)
    if 'androidKey' not in itemEnDesktop.keys():
        # print('androidKey not found for {key}')
        missingAndroidKeyCount = missingAndroidKeyCount + 1
        continue
    androidKey = itemEnDesktop['androidKey']
    androidKeyCount = getAndroidKeyCountFromItem(itemEnDesktop)
    # print(f'key: {key}, androidKey: {androidKey}, androidKeyCount: {androidKeyCount}')
    txtEnDesktop = itemEnDesktop['message']
    itemEnAndroid = getAndroidItem(androidKey, androidKeyCount, androidEnJsonSingular, androidEnJsonPlurals)

    txtEnAndroid = itemEnAndroid['#text']

    morphedEnAndroid = morphToDesktopSyntax(txtEnAndroid, itemEnDesktop)
    if (txtEnDesktop != morphedEnAndroid):
        print(f'\t\tDOES NOT MATCH: "{txtEnDesktop}" vs "{morphedEnAndroid}", itemEnDesktop: {itemEnDesktop}\n\n')
        notMatchingCount = notMatchingCount + 1
    else:
        # if it does match, find the corresponding value on the target language on android
        print(f'MATCH: "{txtEnDesktop}" vs "{morphedEnAndroid}"')
        try:
            textTranslated = getAndroidItem(androidKey, androidKeyCount, androidDestJsonSingular, androidDestJsonPlurals)['#text']
            print(f'textTranslated: "{textTranslated}"')

            textMorphed = morphToDesktopSyntax(textTranslated, itemEnDesktop)
            print(f'textMorphed: "{textMorphed}"')



        except KeyError:
            print('KeyError exception:', traceback.format_exc())






print(f"total keys missing {missingAndroidKeyCount}") # androidKey set on desktop but not found on android EN resources
print(f"total text not matching EN to EN {notMatchingCount}")