# Feishu Minutes Transcript Skill

English | [简体中文](README.md)

A Windows and PowerShell Codex skill that extracts complete transcripts from Feishu/Lark Minutes share links the user is authorized to access. It saves both:

- The original `subtitles_v2.json` response
- A timestamped `transcript.md` encoded as UTF-8 without BOM

It is useful when the Minutes page uses virtual scrolling and copying the DOM only captures part of the transcript, or when a CLI transcript download returns HTTP 403 while the shared page remains directly accessible.

## Access and privacy boundaries

- Only process content you are authorized to view, download, and save.
- The skill does not bypass Feishu/Lark sign-in, sharing restrictions, or access controls.
- It starts a fresh headless Chrome session and does not inherit an existing Chrome login.
- It relies on internal web endpoints used by the Minutes page, which may change without notice.
- Minutes URLs, tokens, raw JSON, and transcripts may contain sensitive information. Never commit them to a public repository.

## Requirements

- Windows 10 or 11
- PowerShell 7
- Node.js 20 or later
- Stable Google Chrome
- Codex, when installing and invoking it as a skill

## Install as a Codex skill

Run the following commands in PowerShell 7:

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$SkillsRoot = Join-Path $CodexHome 'skills'
$SkillTarget = Join-Path $SkillsRoot 'extracting-feishu-minutes-transcripts'

New-Item -ItemType Directory -Path $SkillsRoot -Force | Out-Null
git clone https://github.com/stellariums/feishu-minutes-transcript-skill.git $SkillTarget
Set-Location $SkillTarget
npm install
```

Restart Codex, then invoke the skill with a request such as:

```text
$extracting-feishu-minutes-transcripts Extract the complete transcript from this accessible Feishu Minutes URL: <URL>
```

## Run the scripts directly

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

By default, the scripts produce:

```text
minutes/<minute-token>/
|-- subtitles_v2.json
`-- transcript.md
```

The `minutes/` directory is excluded by `.gitignore`.

## Validate and maintain

```powershell
npm run check
npm test
& '.\scripts\extract-feishu-transcript.test.ps1'
```

The unit tests do not access live Feishu/Lark data. Live-link testing should only be performed locally by an authorized content owner. Never add real links, tokens, or transcript content to public test fixtures.

## Troubleshooting

### The page requires sign-in

The script uses a fresh headless Chrome session. It does not reuse your personal browser profile and does not bypass access controls. Ask the content owner for a share link you are authorized to access.

### Copying the page misses transcript sections

Minutes pages may use virtual scrolling, so only currently visible content exists in the DOM. This skill reads transcript paragraphs in batches from within the page session instead of copying rendered text.

### Why is PowerShell 7 required?

Windows PowerShell 5.1 may decode UTF-8 files without BOM using the system code page, which can corrupt Chinese text or cause parser errors. PowerShell 7 handles UTF-8 more reliably by default.

### The extractor stopped working after a Feishu/Lark update

Open an Issue with sanitized error output and your Node.js, PowerShell, and Chrome versions. Do not post Minutes links, tokens, cookies, or transcript content.

## Privacy

The scripts open the supplied Feishu/Lark page locally and write results only to the requested local path. They do not intentionally upload transcript data to another third-party service.

## License

[MIT](LICENSE)
