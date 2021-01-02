Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

choco install -y awscli
choco install -y nodejs-lts
choco install -y yarn

Set-Location \
mkdir work
Set-Location C:\work
tar -xzvf C:\"#{NPM_FILE}"

winrm set winrm/config/service/Auth '@{Basic="true"}'
winrm set winrm/config/service '@{AllowUnencrypted="true"}'
winrm set winrm/config/winrs '@{MaxMemoryPerShellMB="1024"}'
Set-Item wsman:\localhost\Client\TrustedHosts -value * -force

Rename-Computer -NewName "#{AD_SERVER_NAME}"

$trigger = New-JobTrigger -AtStartup -RandomDelay 00:00:10
Register-ScheduledJob -Trigger $trigger -FilePath C:\phase2.ps1 > C:\result2.txt -Name phase2

shutdown -r -t 1
