$date = Get-Date -Format "yyyyMMdd"
image-assistant list-applications
image-assistant create-image --name #{imageName}-$date --use-latest-agent-version
