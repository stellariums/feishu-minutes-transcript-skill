# Feishu Minutes Transcript Skill

[English](README.en.md) | 简体中文

一个仅支持 Windows + PowerShell 的 Codex Skill，用于从用户有权查看的飞书/Lark 妙记分享链接中提取完整逐字稿，并保存：

- 原始 `subtitles_v2.json`
- UTF-8 无 BOM 的带时间戳 `transcript.md`

它适合网页采用虚拟滚动、复制 DOM 只能得到部分文字，或 CLI 下载逐字稿返回 HTTP 403，但分享页面仍可直接查看的情况。

## 使用边界

- 仅处理你本人有权查看、下载和保存的内容。
- 不绕过飞书登录、分享范围或其他访问控制。
- 当前使用新的无头 Chrome 会话，不会继承个人 Chrome 的登录状态。
- 脚本依赖飞书网页内部接口；飞书更新页面后可能需要同步维护。
- 妙记 URL、token、原始 JSON 和逐字稿都可能包含敏感信息，请勿提交到公开仓库。

## 环境要求

- Windows 10/11
- PowerShell 7
- Node.js 20 或更高版本
- Google Chrome 稳定版
- Codex（用于安装和调用 Skill）

## 安装

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$SkillsRoot = Join-Path $CodexHome 'skills'
$SkillTarget = Join-Path $SkillsRoot 'extracting-feishu-minutes-transcripts'

New-Item -ItemType Directory -Path $SkillsRoot -Force | Out-Null
git clone https://github.com/stellariums/feishu-minutes-transcript-skill.git $SkillTarget
Set-Location $SkillTarget
npm install
```

重启 Codex 后，可这样调用：

```text
$extracting-feishu-minutes-transcripts 请从这个飞书妙记链接提取完整逐字稿：<URL>
```

也可以直接运行脚本：

```powershell
$Url = 'https://tenant.feishu.cn/minutes/<minute-token>'
$Token = ([uri]$Url).Segments[-1].Trim('/')
$OutDir = Join-Path (Get-Location) "minutes\$Token"

node '.\scripts\fetch-feishu-transcript.mjs' `
    --url $Url `
    --output (Join-Path $OutDir 'subtitles_v2.json')

& '.\scripts\extract-feishu-transcript.ps1' `
    -InputPath (Join-Path $OutDir 'subtitles_v2.json') `
    -OutputPath (Join-Path $OutDir 'transcript.md') `
    -SourceUrl $Url
```

## 验证与维护

```powershell
npm run check
npm test
& '.\scripts\extract-feishu-transcript.test.ps1'
```

不支持 Windows PowerShell 5.1：它在中文系统上可能按系统代码页读取 UTF-8 无 BOM 脚本，导致乱码或解析失败。

单元测试不访问真实飞书数据。真实链接测试应由内容所有者在本地执行，不应把链接、token 或逐字稿加入公开测试夹具。

## 常见问题

### 页面要求登录怎么办？

当前脚本使用全新的无头 Chrome 会话，不继承个人浏览器登录状态，也不提供绕过权限的能力。请让内容所有者生成你有权访问的分享链接。

### 为什么不用复制网页文字？

妙记页面可能使用虚拟滚动，DOM 中只保留当前可见的部分内容。脚本会在页面会话内分批读取完整段落，避免漏掉未渲染的文字。

### 为什么只支持 PowerShell 7？

Windows PowerShell 5.1 在中文系统上可能按系统代码页读取 UTF-8 无 BOM 脚本，导致乱码或解析失败。PowerShell 7 对 UTF-8 的默认处理更可靠。

### 飞书更新后失效怎么办？

先提交 Issue，并附上已脱敏的错误信息、Node.js/PowerShell/Chrome 版本。不要公开妙记链接、token、Cookie 或逐字稿内容。

## 隐私说明

脚本只在本机打开用户提供的飞书/Lark 页面并将结果写入指定的本地路径，不会主动把逐字稿发送给其他第三方服务。默认生成的 `minutes/` 目录已加入 `.gitignore`。

## License

[MIT](LICENSE)
