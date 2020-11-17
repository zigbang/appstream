Set-DnsClientServerAddress -InterfaceIndex 4 -ServerAddresses ("127.0.0.1") 

Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools

$password = ConvertTo-SecureString "#{AD_PASSWORD}" -asplaintext -force 

Install-ADDSForest `
	-DomainName "#{DIRECTORY_NAME}" `
	-CreateDnsDelegation:$false `
	-DatabasePath "C:\Windows\NTDS" `
	-DomainMode "7" `
	-DomainNetbiosName "appstream" `
	-ForestMode "7" `
	-InstallDns:$true `
	-LogPath "C:\Windows\NTDS" `
	-NoRebootOnCompletion:$True `
	-SafeModeAdministratorPassword: $password `
	-SysvolPath "C:\Windows\SYSVOL" `
	-Force:$true 

$trigger = New-JobTrigger -AtStartup -RandomDelay 00:00:10
Register-ScheduledJob -Trigger $trigger -FilePath C:\phase3.ps1 > C:\result3.txt -Name phase3

Unregister-ScheduledJob -Name phase2
shutdown -r -t 1 
