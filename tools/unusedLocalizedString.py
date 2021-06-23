#!/bin/python


# usage : ./tools/unusedLocalizedString.py |grep False

import re
import os
from glob import glob

# get all files matching .js, .ts and .tsx in ./
dir_path = './'
files = [y for x in os.walk(dir_path) for y in glob(os.path.join(x[0], '*.js'))]
files += [y for x in os.walk(dir_path) for y in glob(os.path.join(x[0], '*.ts'))]
files += [y for x in os.walk(dir_path) for y in glob(os.path.join(x[0], '*.tsx'))]

# exclude node_modules directories
filtered_files = [f for f in files if "node_modules" not in f]

# search for this pattern in _locales/en/messages.json: it is a defined localized string
patternLocalizedString = re.compile("^  \".*\"\: {")

localizedStringToSearch = 0
localizedStringNotFound = 0
for i, line in enumerate(open('_locales/en/messages.json')):
    for match in re.finditer(patternLocalizedString, line):
        localizedStringToSearch = localizedStringToSearch + 1
        found = match.group()
        # extract the key only from the line
        foundAline = found[3:-4]
        # print 'Found on line %s: \'%s\'' % (i + 1, foundAline)

        # generate a new regex to be searched for to find its usage in the code
        # currently, it matches
        #       * i18n('key') with or without line return
        #       * messages.key (used in some places)
        #       * and also 'key'. (some false positive might be present here)
        searchedLine = "i18n\([\r\n]?\s*'{0}'|messages.{0}|'{0}'".format(foundAline)


        found = False
        # skip timerOptions string constructed dynamically
        if 'timerOption_' in foundAline:
            found = True
        else:
            for file_path in filtered_files:
                fileContent = open(file_path, 'r').read()
                if len(re.findall(searchedLine,fileContent,re.MULTILINE)) > 0:
                    found = True
                    break
            if not found:
                localizedStringNotFound = localizedStringNotFound + 1
        print "i18n for '{0}': found:{1}:".format(foundAline, found)

print "number of localized string found in messages.json:{0}".format(localizedStringToSearch)
print "number of localized string NOT found:{0}".format(localizedStringNotFound)