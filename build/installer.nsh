!include LogicLib.nsh

Function .onInit

  ; Check Windows major version
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" CurrentVersion
  StrCpy $R1 $R0 1 -1  ; Extract major version (e.g., "10" from "10.0")
  IntOp $R1 $R1 - 10   ; Subtract 10
  
  ; If major version is less than 10, abort
  ${If} $R1 < 0
    MessageBox MB_OK|MB_ICONERROR "This application requires Windows 10 or higher."
    Abort
  ${EndIf}

FunctionEnd