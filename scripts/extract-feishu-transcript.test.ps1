$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'extract-feishu-transcript.ps1'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('feishu-transcript-test-' + [guid]::NewGuid())
$inputPath = Join-Path $tempRoot 'subtitles_v2.json'
$outputPath = Join-Path $tempRoot 'transcript.md'

try {
    [System.IO.Directory]::CreateDirectory($tempRoot) | Out-Null
    $fixture = @{
        data = @{
            paragraphs = @(
                @{
                    start_time = 23000
                    sentences = @(
                        @{
                            start_time = 23000
                            contents = @(@{ content = '第一段文字。' })
                        }
                    )
                },
                @{
                    start_time = 3723000
                    sentences = @(
                        @{
                            start_time = 3723000
                            contents = @(@{ content = '第二段文字。' })
                        }
                    )
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    [System.IO.File]::WriteAllText($inputPath, $fixture, [System.Text.UTF8Encoding]::new($false))

    & $scriptPath `
        -InputPath $inputPath `
        -OutputPath $outputPath `
        -Title '测试妙记' `
        -SourceUrl 'https://tenant.feishu.cn/minutes/example-token' | Out-Null

    $markdown = [System.IO.File]::ReadAllText($outputPath, [System.Text.Encoding]::UTF8)
    $expectedMarkers = @(
        '---',
        'source: "https://tenant.feishu.cn/minutes/example-token"',
        '# 测试妙记',
        '## 逐字稿',
        '- **[00:23]** 第一段文字。',
        '- **[01:02:03]** 第二段文字。'
    )

    foreach ($marker in $expectedMarkers) {
        if (-not $markdown.Contains($marker)) {
            throw "Markdown 输出缺少标记: $marker"
        }
    }

    $bytes = [System.IO.File]::ReadAllBytes($outputPath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw 'Markdown 输出不应包含 UTF-8 BOM。'
    }
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

'Markdown transcript test passed.'
