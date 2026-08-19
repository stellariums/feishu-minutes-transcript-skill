import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildParagraphIdsUrl,
    buildLaunchOptions,
    buildSubtitlesUrl,
    extractParagraphId,
    extractMinuteToken,
    normalizeParagraphIds,
} from './fetch-feishu-transcript.mjs';

const minuteUrl = 'https://tenant.feishu.cn/minutes/example-token';

test('extracts the minute token from a Feishu Minutes URL', () => {
    assert.equal(extractMinuteToken(minuteUrl), 'example-token');
});

test('rejects URLs without a Minutes path', () => {
    assert.throws(() => extractMinuteToken('https://tenant.feishu.cn/docs/example-token'));
});

test('rejects non-HTTPS URLs', () => {
    assert.throws(() => extractMinuteToken('http://tenant.feishu.cn/minutes/example-token'));
});

test('builds the paragraph ID request URL', () => {
    const url = buildParagraphIdsUrl(minuteUrl, 'example-token');

    assert.equal(url.pathname, '/minutes/api/subtitles/paragraph-ids');
    assert.equal(url.searchParams.get('page_size'), '10000');
    assert.equal(url.searchParams.get('object_token'), 'example-token');
});

test('builds the subtitles request URL', () => {
    const url = buildSubtitlesUrl(minuteUrl, 'example-token', 'paragraph-1', 50);

    assert.equal(url.pathname, '/minutes/api/subtitles_v2');
    assert.equal(url.searchParams.get('paragraph_id'), 'paragraph-1');
    assert.equal(url.searchParams.get('size'), '50');
});

test('uses the installed Chrome channel for headless capture', () => {
    assert.deepEqual(buildLaunchOptions(), {
        channel: 'chrome',
        headless: true,
    });
});

test('normalizes paragraph IDs from the live API list shape', () => {
    assert.deepEqual(normalizeParagraphIds({
        data: {
            list: [
                { pid: 'paragraph-1' },
                { pid: 'paragraph-2' },
            ],
        },
    }), ['paragraph-1', 'paragraph-2']);
});

test('extracts pid from a live subtitle paragraph', () => {
    assert.equal(extractParagraphId({ pid: 'paragraph-1' }), 'paragraph-1');
});
