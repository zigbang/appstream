Set-WinSystemLocale ko-KR
Set-WinUILanguageOverride ko-KR 
Set-WinUserLanguageList ko-KR -Force
Set-WinHomeLocation -GeoId 0x86
Set-TimeZone -Id "Korea Standard Time" -PassThru
New-ItemProperty -Path "HKLM:\SYSTEM/CurrentControlSet/services/i8042prt/parameters" -Name "LayerDriver KOR" -Value "kbd101c.dll" -Force
New-ItemProperty -Path "HKLM:\SYSTEM/CurrentControlSet/services/i8042prt/parameters" -Name "OverrideKeyboardIdentifier" -Value "PCAT_101CKEY" -Force
New-ItemProperty -Path "HKLM:\SYSTEM/CurrentControlSet/services/i8042prt/parameters" -Name "OverrideKeyboardSubtype" -Value 5 -Force
New-ItemProperty -Path "HKLM:\SYSTEM/CurrentControlSet/services/i8042prt/parameters" -Name "OverrideKeyboardType" -Value 8 -Force
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
