import fs from 'fs';
import path from 'path';

/**
 * @typedef {{
 *   buffer: Buffer;
 *   fileType: string;
 *   originalName: string;
 *   source: string;
 * }} ResolvedUpload
 */

/**
 * @param {string} fileName
 */
function guessMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.avif') return 'image/avif';
    if (ext === '.png') return 'image/png';
    return 'image/png';
}

/**
 * @param {string} value
 */
function isHttpUrl(value) {
    return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isObject(value) {
    return typeof value === 'object' && value !== null;
}

/**
 * @param {unknown} candidate
 * @returns {{ path?: string, name?: string, mimeType?: string, source: string } | null}
 */
function normalizeFileCandidate(candidate) {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
        return { path: candidate, source: 'string' };
    }

    if (!isObject(candidate)) {
        return null;
    }

    const filePath = typeof candidate.filePath === 'string'
        ? candidate.filePath
        : typeof candidate.path === 'string'
            ? candidate.path
            : typeof candidate.localPath === 'string'
                ? candidate.localPath
                : typeof candidate.url === 'string'
                    ? candidate.url
                    : typeof candidate.uri === 'string'
                        ? candidate.uri
                        : undefined;

    const name = typeof candidate.filename === 'string'
        ? candidate.filename
        : typeof candidate.name === 'string'
            ? candidate.name
            : undefined;

    const mimeType = typeof candidate.mimeType === 'string'
        ? candidate.mimeType
        : typeof candidate.type === 'string'
            ? candidate.type
            : undefined;

    if (!filePath) {
        return null;
    }

    return {
        path: filePath,
        name,
        mimeType,
        source: 'object'
    };
}

/**
 * @param {string} value
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 * @param {string | undefined} preferredName
 * @param {string | undefined} preferredMimeType
 * @returns {Promise<ResolvedUpload>}
 */
async function loadFromUrl(value, fetchImpl, preferredName, preferredMimeType) {
    const imgRes = await fetchImpl(value);
    if (!imgRes.ok) {
        throw new Error(`Failed to fetch image URL: Status ${imgRes.status}`);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const urlPath = new URL(value).pathname;
    const derivedName = preferredName || path.basename(urlPath) || 'upload.png';

    return {
        buffer: Buffer.from(arrayBuffer),
        fileType: preferredMimeType || imgRes.headers.get('Content-Type') || guessMimeType(derivedName),
        originalName: derivedName,
        source: 'url'
    };
}

/**
 * @param {string} filePath
 * @param {string | undefined} preferredName
 * @param {string | undefined} preferredMimeType
 * @returns {ResolvedUpload}
 */
function loadFromLocalPath(filePath, preferredName, preferredMimeType) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Local file not found at path: ${filePath}`);
    }

    const originalName = preferredName || path.basename(resolvedPath);

    return {
        buffer: fs.readFileSync(resolvedPath),
        fileType: preferredMimeType || guessMimeType(originalName),
        originalName,
        source: 'local-path'
    };
}

/**
 * @param {string} image
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 * @param {string | undefined} preferredName
 * @returns {Promise<ResolvedUpload>}
 */
async function loadFromImageField(image, fetchImpl, preferredName) {
    if (image.startsWith('data:')) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            throw new Error('Invalid base64 image data URI format');
        }

        return {
            buffer: Buffer.from(match[2], 'base64'),
            fileType: match[1],
            originalName: preferredName || 'upload',
            source: 'data-uri'
        };
    }

    if (isHttpUrl(image)) {
        return loadFromUrl(image, fetchImpl, preferredName, undefined);
    }

    return {
        buffer: Buffer.from(image, 'base64'),
        fileType: guessMimeType(preferredName || 'upload.png'),
        originalName: preferredName || 'upload',
        source: 'base64'
    };
}

/**
 * @param {{
 *   image?: unknown;
 *   local_path?: unknown;
 *   filePath?: unknown;
 *   file?: unknown;
 *   image_file?: unknown;
 *   uploadedFile?: unknown;
 *   filename?: unknown;
 * }} input
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 * @returns {Promise<ResolvedUpload>}
 */
export async function resolveUploadInput(input, fetchImpl) {
    const preferredName = typeof input.filename === 'string' ? input.filename : undefined;
    const fileCandidate = normalizeFileCandidate(input.file)
        || normalizeFileCandidate(input.image_file)
        || normalizeFileCandidate(input.uploadedFile)
        || normalizeFileCandidate(input.filePath)
        || normalizeFileCandidate(input.local_path);

    if (fileCandidate?.path) {
        if (isHttpUrl(fileCandidate.path)) {
            return loadFromUrl(fileCandidate.path, fetchImpl, preferredName || fileCandidate.name, fileCandidate.mimeType);
        }

        return loadFromLocalPath(fileCandidate.path, preferredName || fileCandidate.name, fileCandidate.mimeType);
    }

    if (typeof input.image === 'string' && input.image.trim()) {
        return loadFromImageField(input.image, fetchImpl, preferredName);
    }

    throw new Error('Either image, filePath, file, image_file, or uploadedFile is required');
}

