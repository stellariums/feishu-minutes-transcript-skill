---
name: extracting-feishu-minutes-transcripts
description: Extract and save complete timestamped transcripts from accessible Feishu/Lark Minutes links on Windows, especially when CLI download returns HTTP 403 or the webpage uses virtual scrolling. Do not use it to bypass login or access controls.
---

# 提取飞书妙记逐字稿

## Overview

在 Windows 上使用无头 Chrome 打开用户有权查看的飞书/Lark 妙记页面，在同一网页会话内请求逐字稿数据，再生成 UTF-8 无 BOM 的带时间戳 Markdown。保留原始 JSON，方便校验和重新处理。

本 Skill 不会绕过登录、分享范围或其他访问控制。若页面要求登录，停止并请用户提供其有权访问的公开分享链接。

## Workflow

1. 从用户提供的妙记 URL 提取 token。
2. 默认输出到当前工作区的 `minutes/<token>/`，不要覆盖其他妙记。
3. 运行网页抓取器，生成 `subtitles_v2.json`。
4. 运行 PowerShell 处理器，生成 `transcript.md`。
5. 验证段落数、文本条目数、首尾时间戳和编码。

## Run

在 PowerShell 中执行。`$SkillDir` 应指向本 Skill 的安装目录：

```powershell
$SkillDir = 'C:\path\to\extracting-feishu-minutes-transcripts'
$Url = 'https://tenant.feishu.cn/minutes/<minute-token>'
$Token = ([uri]$Url).Segments[-1].Trim('/')
$OutDir = Join-Path (Get-Location) "minutes\$Token"
$JsonPath = Join-Path $OutDir 'subtitles_v2.json'
$MarkdownPath = Join-Path $OutDir 'transcript.md'
$Node = (Get-Command node.exe -ErrorAction Stop).Source

& $Node (Join-Path $SkillDir 'scripts\fetch-feishu-transcript.mjs') --url $Url --output $JsonPath
& (Join-Path $SkillDir 'scripts\extract-feishu-transcript.ps1') `
    -InputPath $JsonPath `
    -OutputPath $MarkdownPath `
    -Title '飞书妙记逐字稿' `
    -SourceUrl $Url
```

若用户指定输出目录、文件名或标题，使用用户指定值；输出文件必须为 `.md`，并仍保留原始 JSON。

## Verify

```powershell
$Json = [System.IO.File]::ReadAllText($JsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$Markdown = [System.IO.File]::ReadAllText($MarkdownPath, [System.Text.Encoding]::UTF8)
$Bytes = [System.IO.File]::ReadAllBytes($MarkdownPath)

[pscustomobject]@{
    Paragraphs = @($Json.data.paragraphs).Count
    MarkdownEntries = ([regex]::Matches($Markdown, '(?m)^- \*\*\[[^\]]+\]\*\* ')).Count
    HasTitle = $Markdown.Contains('# 飞书妙记逐字稿')
    HasSource = $Markdown.Contains('> 来源：[飞书妙记]')
    HasUtf8Bom = $Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF
    HasReplacementChar = $Markdown.Contains([char]0xFFFD)
}
```

要求：`Paragraphs` 与 `MarkdownEntries` 相等且大于 0；`HasTitle` 和 `HasSource` 为 `True`；`HasUtf8Bom` 和 `HasReplacementChar` 为 `False`。

## Failure Handling

- CLI 下载逐字稿出现 HTTP 403：不要反复授权；若妙记分享页可直接查看，改用本 Skill 的网页会话抓取。
- 直接 `curl` 返回 `session is invalid`：不要继续直连接口；必须先由浏览器打开妙记页面建立会话。
- 网页 DOM 只显示部分文字：这是虚拟滚动，不要依赖复制 DOM；使用脚本获取完整段落。
- 找不到 Playwright：在 Skill 根目录运行 `npm install`。
- 找不到 Chrome：安装稳定版 Google Chrome 后重试。
- 页面要求登录或没有查看权限：停止；本 Skill 不复用个人 Chrome 登录状态，也不绕过访问控制。

## Maintain

在 Skill 根目录运行：

```powershell
$Node = (Get-Command node.exe -ErrorAction Stop).Source
& $Node --test '.\scripts\fetch-feishu-transcript.test.mjs'
& $Node --check '.\scripts\fetch-feishu-transcript.mjs'
& '.\scripts\extract-feishu-transcript.test.ps1'
```
