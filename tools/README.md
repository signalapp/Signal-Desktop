**Those tools can be used to keep in sync our locale in the app between different language and with android translations**



## Step 1: Find unused key locales in EN

`tools/unusedLocalizedString.py` is iterating over all root keys in _locales/en/message.json and try to find them on the code with a regex. If it does not find it, it will print a line with False.
Some key exceptions are hardcoded to not report false negative


So just run:
`tools/unusedLocalizedString.py |grep False`
and double check by searching in the app if you can effectively remove those keys.


## Step 2: Sync keys between each locales on desktop

This step removes every key in all locales not found in the locale EN.
So if for example, you have a key in `it` which is not present in `en`, it will be removed and the `it` file will be written without it.

A summary for each language file is printed on the screen to let you know if anything was changed during the process

`python3 tools/compareLocalizedStrings.py`


## Step 3: Map translations from android to desktop

This step matches translations from android to desktop. It needs to be run for each locale you want to update.


`python3 tools/mapAndroidTranslationsToDesktop.py fr <path_to_android_root_project>`

Under the hood, it uses a item from the EN desktop locale called `androidKey` to find the matching translation for each locale.

Note that if a desktop key does not have an `androidKey` set, it will just be skipped
The goal is to have an androidKey for each item, if possible. But for now apps are too different for that to make sense.