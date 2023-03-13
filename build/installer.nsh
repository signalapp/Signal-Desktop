# DO NOT EDIT. This is a generated file.

!include WinVer.nsh

# en_US
LangString signalMinWinVersionErr 1033 "Signal desktop no longer works on this computer. To use Signal desktop again, update your computer’s version of Windows."
# de_DE
LangString signalMinWinVersionErr 1031 "Signal Desktop funktioniert auf diesem Computer nicht mehr. Um Signal Desktop wieder verwenden zu können, aktualisiere die Windows-Version deines Computers."
# fr_FR
LangString signalMinWinVersionErr 1036 "La version Desktop de Signal ne fonctionne plus sur cet ordinateur. Pour continuer d’utiliser la version Desktop de Signal, veuillez mettre à jour la version Windows de votre ordinateur."
# es_ES
LangString signalMinWinVersionErr 3082 "Signal para Escritorio ya no funciona en este ordenador. Para volver a usar Signal para Escritorio, actualiza la versión de Windows de tu ordenador."
# zh_CN
LangString signalMinWinVersionErr 2052 "Signal desktop 无法在此电脑上运行。如您希望再次使用 Signal desktop，请更新您电脑的 Windows 版本。"
# zh_TW
LangString signalMinWinVersionErr 1028 "Signal 桌面版不再適用於此電腦。如要再次使用 Signal 桌面版，請更新電腦的 Windows 版本。"
# ja_JP
LangString signalMinWinVersionErr 1041 "このコンピュータではSignal desktopは動作しなくなりました。Signal desktopを再びご利用になる場合は、お使いのコンピュータのバージョンWindowsをアップデートしてください。"
# ko_KR
LangString signalMinWinVersionErr 1042 "Signal 데스크톱이 이 컴퓨터에서 더 이상 작동하지 않습니다. Signal 데스크톱을 다시 사용하려면 컴퓨터의 Windows 버전을 업데이트하세요."
# it_IT
LangString signalMinWinVersionErr 1040 "Signal desktop non funziona più su questo computer. Per usare di nuovo Signal desktop, aggiorna la versione di Windows presente sul tuo computer."
# nl_NL
LangString signalMinWinVersionErr 1043 "Signal Desktop werkt niet meer op deze computer. Werk de versie van Windows op je computer bij om Signal Desktop weer te gebruiken."
# da_DK
LangString signalMinWinVersionErr 1030 "Signal Desktop fungerer ikke længere på denne computer. Hvis du vil bruge Signal Desktop igen, skal du opdatere din computers version af Windows."
# sv_SE
LangString signalMinWinVersionErr 1053 "Signal Desktop fungerar inte längre på den här datorn. Uppdatera datorns version av Windows för att använda Signal Desktop igen."
# nb_NO
LangString signalMinWinVersionErr 1044 "Signal Desktop fungerer ikke lenger på denne datamaskinen. Du må oppdatere til en nyere versjon av Windows for å kunne bruke Signal igjen."
# fi_FI
LangString signalMinWinVersionErr 1035 "Signalin työpöytäsovellus ei enää toimi tässä tietokoneessa. Jos haluat käyttää Signalin työpöytäsovellusta uudelleen, päivitä tietokoneesi Windows-versio."
# ru_RU
LangString signalMinWinVersionErr 1049 "Signal Desktop больше не работает на этом компьютере. Чтобы продолжить использовать Signal Desktop, обновите версию Windows на своём компьютере."
# pt_PT
LangString signalMinWinVersionErr 2070 "A versão desktop do Signal já não funciona neste computador. Para usar a versão desktop do Signal outra vez, atualize a versão do Windows do seu computador."
# pt_BR
LangString signalMinWinVersionErr 1046 "O Signal para desktop não funciona mais neste computador. Para usar o Signal para desktop novamente, atualize a versão do Windows do seu computador."
# pl_PL
LangString signalMinWinVersionErr 1045 "Signal Desktop już nie działa na tym komputerze. Aby móc znów obsługiwać Signal Desktop, zaktualizuj Windows na swoim komputerze."
# uk_UA
LangString signalMinWinVersionErr 1058 "Signal більше не працює на цьому комп'ютері. Щоб знову користуватися Signal, оновіть версію Windows вашого комп'ютера."
# cs_CZ
LangString signalMinWinVersionErr 1029 "Aplikace Signal desktop již na tomto počítači nefunguje. Pokud chcete aplikaci Signal desktop opět používat, aktualizujte na svém počítači verzi Windows."
# sk_SK
LangString signalMinWinVersionErr 1051 "Signal desktop už na tomto počítači nefunguje. Ak chcete znova používať Signal desktop, aktualizujte verziu Windows na svojom počítači."
# hu_HU
LangString signalMinWinVersionErr 1038 "A Signal asztali számítógépről elérhető változata már nem működik ezen a számítógépen. A Signal asztali számítógépről elérhető változatának ismételt használatához frissítsd a számítógépeden a(z) Windows verzióját."
# ar_SA
LangString signalMinWinVersionErr 1025 "لم يعُد تطبيق Signal يَعمل على هذا الحاسوب. لاستخدام تطبيق Signal الخاص بالحاسوب مرة أخرى، يُرجى تحديث إصدار Windows لحاسوبك."
# tr_TR
LangString signalMinWinVersionErr 1055 "Signal masaüstü artık bu bilgisayarda çalışmıyor. Signal masaüstünü tekrar kullanmak için bilgisayarının Windows sürümünü güncelle."
# th_TH
LangString signalMinWinVersionErr 1054 "คอมพิวเตอร์เครื่องนี้ไม่รองรับการใช้งาน Signal เดสก์ท็อปอีกต่อไป หากต้องการใช้งาน Signal เดสก์ท็อปต่อ กรุณาอัปเดตเวอร์ชันของ Windows ที่คอมพิวเตอร์คุณใช้งานอยู่"
# vi_VN
LangString signalMinWinVersionErr 1066 "Signal desktop không còn hoạt động được trên máy tính này. Để có thể tiếp tục sử dụng Signal desktop, cập nhật phiên bản của hệ điều hành Windows trên máy tính bạn."

!macro preInit
  ${IfNot} ${AtLeastWin7}
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(signalMinWinVersionErr)"
    DetailPrint `Windows version check failed`
    Abort
  ${EndIf}
!macroend
