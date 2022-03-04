$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
Function InitializeExecuter {
    $options = [pscustomobject]@{}
    $optionsPath = Join-Path -Path $PSScriptRoot -ChildPath '\option.executer.json'
    if ([System.IO.File]::Exists($optionsPath )) {  
        $options = (Get-Content $optionsPath | ConvertFrom-Json)
    }
    $options
}
Function InitializeSecrets([pscustomobject] $optionsExecuter) {
    if ($options.IsShowLogInitializeSecrets -eq $True) {
        Write-Host '=====InitializeSecrets====='
    }
    $secrets = [pscustomobject]@{}
    try {
        $GITHUB_secrets = $env:GITHUB_secrets | ConvertFrom-Json
        $GITHUB_secrets.PSObject.Properties | ForEach-Object {
            if ($_.Name -ne "github_token") {
                $converFromBase64 = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_.Value))
                $secrets | Add-Member `
                    -NotePropertyName $_.Name `
                    -NotePropertyValue ($converFromBase64 | ConvertFrom-Json)   
            }  
            else {
                $secrets | Add-Member `
                    -NotePropertyName $_.Name `
                    -NotePropertyValue $_.Value 
            }
        }
    }
    catch {
        $secretsPath = Join-Path -Path $PSScriptRoot -ChildPath '.githubsecrets'
        if ([System.IO.Directory]::Exists($secretsPath )) {            
            $secretsPath = Join-Path -Path $secretsPath -ChildPath '*'
            $extension = ".githubsecrets.json"
            $table = get-childitem -Path ($secretsPath) -Include @('*' + $extension)
            foreach ($file in $table) {
                $secrets | Add-Member `
                    -NotePropertyName ($file.Name.Replace($extension, '')) `
                    -NotePropertyValue (Get-Content $file.Fullname | ConvertFrom-Json)
            }
        }
    }
    if ($options.IsShowLogInitializeSecrets -eq $True) {
        Write-Host ($secrets | ConvertTo-Json)
        Write-Host '=====END:InitializeSecrets='
    }
    $secrets
}
$options = InitializeExecuter
$secrets = InitializeSecrets -optionsExecuter $options
Write-Host $options