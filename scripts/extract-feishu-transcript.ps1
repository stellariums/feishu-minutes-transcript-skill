param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Title = '飞书妙记逐字稿',

    [string]$SourceUrl = ''
)

$ErrorActionPreference = 'Stop'

if ([System.IO.Path]::GetExtension($OutputPath) -ne '.md') {
    throw 'OutputPath 必须使用 .md 扩展名。'
}

function Format-Timestamp {
    param([long]$Milliseconds)

    $time = [TimeSpan]::FromMilliseconds($Milliseconds)
    if ($time.TotalHours -ge 1) {
        return '{0:00}:{1:00}:{2:00}' -f [math]::Floor($time.TotalHours), $time.Minutes, $time.Seconds
    }

    return '{0:00}:{1:00}' -f $time.Minutes, $time.Seconds
}

function Escape-YamlDoubleQuoted {
    param([string]$Value)

    return $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n')
}

$json = [System.IO.File]::ReadAllText($InputPath, [System.Text.Encoding]::UTF8)
$root = $json | ConvertFrom-Json

if ($null -eq $root.data.paragraphs) {
    throw '输入文件中未找到 data.paragraphs，请确认文件是飞书妙记逐字稿接口返回的 JSON。'
}

$paragraphs = @($root.data.paragraphs)
$entries = [System.Collections.Generic.List[string]]::new()
$timestamps = [System.Collections.Generic.List[string]]::new()

foreach ($paragraph in $paragraphs) {
    $paragraphText = [System.Text.StringBuilder]::new()
    $startTime = $null

    foreach ($sentence in @($paragraph.sentences)) {
        if ($null -eq $startTime -and $null -ne $sentence.start_time) {
            $startTime = [long]$sentence.start_time
        }

        foreach ($content in @($sentence.contents)) {
            [void]$paragraphText.Append([string]$content.content)
        }
    }

    $text = $paragraphText.ToString().Trim() -replace '\r?\n', '<br>'
    if ($text.Length -eq 0) {
        continue
    }

    if ($null -eq $startTime) {
        $startTime = [long]$paragraph.start_time
    }

    $timestamp = Format-Timestamp $startTime
    $timestamps.Add($timestamp)
    $entries.Add(('- **[{0}]** {1}' -f $timestamp, $text))
}

$safeTitle = $Title.Replace("`r", '').Replace("`n", ' ').Trim()
$markdown = [System.Collections.Generic.List[string]]::new()
$markdown.Add('---')
$markdown.Add('type: "feishu-minutes-transcript"')
if ($SourceUrl) {
    $markdown.Add(('source: "{0}"' -f (Escape-YamlDoubleQuoted $SourceUrl)))
}
$markdown.Add(('paragraph_count: {0}' -f $entries.Count))
$markdown.Add('---')
$markdown.Add('')
$markdown.Add(('# {0}' -f $safeTitle))
if ($SourceUrl) {
    $markdown.Add('')
    $markdown.Add(('> 来源：[飞书妙记]({0})' -f $SourceUrl))
}
$markdown.Add('')
$markdown.Add('## 逐字稿')
$markdown.Add('')
$markdown.AddRange($entries)

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($OutputPath, $markdown, $utf8NoBom)

[pscustomobject]@{
    InputPath = $InputPath
    OutputPath = $OutputPath
    ParagraphCount = $paragraphs.Count
    MarkdownEntryCount = $entries.Count
    OutputChars = ([System.IO.File]::ReadAllText($OutputPath, [System.Text.Encoding]::UTF8)).Length
    FirstTimestamp = if ($timestamps.Count) { '[{0}]' -f $timestamps[0] } else { $null }
    LastTimestamp = if ($timestamps.Count) { '[{0}]' -f $timestamps[$timestamps.Count - 1] } else { $null }
} | ConvertTo-Json -Compress
