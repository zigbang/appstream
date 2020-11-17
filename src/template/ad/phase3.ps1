$Secure_String_Pwd = ConvertTo-SecureString "#{AD_PASSWORD}" -asplaintext -force
New-ADOrganizationalUnit -Name "appstream" -Path "#{DIRECTORY_NAME_DC}"

New-ADUser "#{AD_USER_NAME}" -CannotChangePassword $true -Enabled $ture -Path "OU=appstream,#{DIRECTORY_NAME_DC}"
Set-ADAccountPassword -Identity "#{AD_USER_NAME}" -NewPassword $Secure_String_Pwd
Set-ADUser -Identity "#{AD_USER_NAME}" -Enabled $true

Add-ADGroupMember -Identity "Domain Admins" -Members "#{AD_USER_NAME}"

New-GPO -Name WinRM
Set-GPRegistryValue -Name "WinRM" -Key "HKLM\Software\Policies\Microsoft\Windows\WinRM\Service" -ValueName AllowBasic -Type DWORD -Value 1
Set-GPRegistryValue -Name "WinRM" -Key "HKLM\Software\Policies\Microsoft\Windows\WinRM\service" -ValueName AllowAutoConfig -Type DWORD -Value 1
Set-GPRegistryValue -Name "WinRM" -Key "HKLM\Software\Policies\Microsoft\Windows\WinRM\service" -ValueName IPv4Filter -Type String -Value "*"
Set-GPRegistryValue -Name "WinRM" -Key "HKLM\Software\Policies\Microsoft\Windows\WinRM\service" -ValueName AllowUnencryptedTraffic -Type DWORD -Value 1
Set-GPRegistryValue -Name "WinRM" -Key "HKLM\Software\Policies\Microsoft\Windows\WinRM\Service" -ValueName AllowKerberos -Type DWORD -Value 0

New-GPLink -Name "WinRM" -Target "ou=appstream,#{DIRECTORY_NAME_DC | lower}"
Set-GPPermission -Name WinRM  -TargetName "#{AD_USER_NAME}" -TargetType Group -PermissionLevel GpoApply

gpupdate /force

aws configure set aws_access_key_id #{awsAccessKeyId}
aws configure set aws_secret_access_key #{awsSecretAccessKey}
aws configure set region #{awsRegion}

Set-Location C:\work\package\

yarn
npx appstream deployForAd #{CONFIG_FILE}

Unregister-ScheduledJob -Name phase3
