import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);

export function extractMinuteToken(inputUrl) {
    const url = new URL(inputUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const minutesIndex = segments.indexOf('minutes');
    const token = minutesIndex >= 0 ? segments[minutesIndex + 1] : undefined;

    if (url.protocol !== 'https:' || !token) {
        throw new Error(`无法从 HTTPS 飞书妙记 URL 提取 token: ${inputUrl}`);
    }
    return token;
}

export function buildParagraphIdsUrl(inputUrl, minuteToken) {
    const url = new URL('/minutes/api/subtitles/paragraph-ids', inputUrl);
    url.searchParams.set('page_size', '10000');
    url.searchParams.set('page_num', '0');
    url.searchParams.set('object_token', minuteToken);
    url.searchParams.set('language', 'zh_cn');
    return url;
}

export function buildSubtitlesUrl(inputUrl, minuteToken, paragraphId, size) {
    const url = new URL('/minutes/api/subtitles_v2', inputUrl);
    url.searchParams.set('paragraph_id', paragraphId);
    url.searchParams.set('size', String(size));
    url.searchParams.set('translate_lang', 'default');
    url.searchParams.set('is_fluent', 'false');
    url.searchParams.set('filter_speaker', 'true');
    url.searchParams.set('object_token', minuteToken);
    url.searchParams.set('language', 'zh_cn');
    return url;
}

export function buildLaunchOptions() {
    return {
        channel: 'chrome',
        headless: true,
    };
}

function loadPlaywright() {
    try {
        return require('playwright-core');
    } catch (error) {
        throw new Error('未找到 playwright-core。请先在 Skill 根目录运行 npm install。', { cause: error });
    }
}

function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith('--') || value === undefined) {
            throw new Error('用法: node fetch-feishu-transcript.mjs --url <妙记URL> --output <JSON路径>');
        }
        args[key.slice(2)] = value;
    }

    if (!args.url || !args.output) {
        throw new Error('必须提供 --url 和 --output。');
    }
    return args;
}

export function normalizeParagraphIds(payload) {
    const candidates = [
        payload?.data?.paragraph_ids,
        payload?.data?.paragraphIds,
        payload?.data?.ids,
        payload?.data?.list,
        payload?.data,
    ];

    const list = candidates.find(Array.isArray);
    if (!list) {
        throw new Error(`paragraph-ids 接口未返回可识别的段落 ID 列表: ${JSON.stringify(payload).slice(0, 1000)}`);
    }

    return list.map((item) => String(
        typeof item === 'object'
            ? item.id ?? item.pid ?? item.paragraph_id ?? item.paragraphId
            : item,
    )).filter((item) => item && item !== 'undefined');
}

export function extractParagraphId(paragraph) {
    return String(paragraph?.id ?? paragraph?.pid ?? paragraph?.paragraph_id ?? '');
}

async function fetchJsonInPage(page, url) {
    const result = await page.evaluate(async (requestUrl) => {
        const response = await fetch(requestUrl, { credentials: 'include' });
        return {
            status: response.status,
            text: await response.text(),
        };
    }, url.toString());

    let payload;
    try {
        payload = JSON.parse(result.text);
    } catch {
        throw new Error(`接口返回非 JSON 内容，HTTP ${result.status}: ${result.text.slice(0, 200)}`);
    }

    if (result.status >= 400 || (payload.code !== undefined && payload.code !== 0)) {
        throw new Error(`接口请求失败，HTTP ${result.status}: ${JSON.stringify(payload).slice(0, 500)}`);
    }
    return payload;
}

async function fetchTranscript(page, inputUrl, minuteToken) {
    const idsPayload = await fetchJsonInPage(page, buildParagraphIdsUrl(inputUrl, minuteToken));
    const paragraphIds = normalizeParagraphIds(idsPayload);
    if (paragraphIds.length === 0) {
        throw new Error('妙记没有可抓取的逐字稿段落。');
    }

    const paragraphs = [];
    const seen = new Set();
    let cursor = 0;

    while (cursor < paragraphIds.length) {
        const payload = await fetchJsonInPage(
            page,
            buildSubtitlesUrl(inputUrl, minuteToken, paragraphIds[cursor], 1000),
        );
        const batch = payload?.data?.paragraphs;
        if (!Array.isArray(batch) || batch.length === 0) {
            throw new Error(`subtitles_v2 从段落 ${paragraphIds[cursor]} 开始未返回内容。`);
        }

        for (const paragraph of batch) {
            const id = extractParagraphId(paragraph);
            if (!seen.has(id)) {
                seen.add(id);
                paragraphs.push(paragraph);
            }
        }

        const lastId = extractParagraphId(batch.at(-1));
        const nextIndex = paragraphIds.indexOf(lastId, cursor) + 1;
        cursor = nextIndex > cursor ? nextIndex : cursor + batch.length;
    }

    return { data: { paragraphs } };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const minuteToken = extractMinuteToken(args.url);
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch(buildLaunchOptions());

    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const initialRequest = page.waitForResponse(
            (response) => response.url().includes('/minutes/api/subtitles/paragraph-ids'),
            { timeout: 120000 },
        ).catch(() => null);

        await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await initialRequest;

        const payload = await fetchTranscript(page, args.url, minuteToken);
        await mkdir(path.dirname(args.output), { recursive: true });
        await writeFile(args.output, JSON.stringify(payload, null, 2), 'utf8');

        process.stdout.write(`${JSON.stringify({
            output: path.resolve(args.output),
            paragraphCount: payload.data.paragraphs.length,
        })}\n`);
    } finally {
        await browser.close();
    }
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
    main().catch((error) => {
        console.error(error.stack ?? error.message);
        process.exitCode = 1;
    });
}
