Set-Location -LiteralPath $PSScriptRoot
& 'C:\Program Files\nodejs\npm.cmd' run start *> "$PSScriptRoot\backend-runtime.log"
