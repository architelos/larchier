import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { normalize } from "node:path";

import { CouldNotFetch, InvalidVersion, SafeError } from "./exc.js";
import globals from "./globals.js";

/**
 * @param {string} res
 * @returns {string[]}
 */
function splitRes(res) {
    const width = res.trim().split("x")[0];
    const height = res.trim().split("x")[1];

    return [width, height];
}

/**
 * @param {string} directoryPath
 */
async function ensureDirExists(directoryPath) {
    if (!existsSync(directoryPath)) {
        await mkdir(directoryPath, { recursive: true });
    }
}

/**
 * @param {string} gameVersion
 */
function isSnapshot(gameVersion) {
    if (gameVersion.toLowerCase().includes("w")) {
        return true;
    }

    return false;
}

/**
 * @param {string} snapshot
 * @returns {string}
 */
function normalizeSnapshot(snapshot) {
    // TODO: probably not the best solution
    switch (snapshot) {
        case "1.rv-pre1":
            return "16w13a";

        case "15w14a":
            // The only normal April fools version
            return "15w14a";

        case "20w14infinite":
            return "20w13c";

        case "22w13oneblockatatime":
            return "22w13b";

        case "23w13a_or_b":
            return "23w13b";

        case "3d shareware v1.34":
            return "19w13c";

        case "24w14potato":
            return "24w13b";

        default:
            return snapshot;
    }
}

/**
 * @param {string} gameVersion1
 * @param {string} gameVersion2
 * @returns {boolean}
 */
function isVersionGreaterOrEqual(gameVersion1, gameVersion2) {
    // Normalize easter egg snapshot versions
    const firstVersion = normalizeSnapshot(gameVersion1.toLowerCase());
    const secondVersion = normalizeSnapshot(gameVersion2.toLowerCase());

    if (isSnapshot(gameVersion1) && isSnapshot(gameVersion2)) {
        // Example: 20w14a - match 1: 20, match 2: w, match 3: 14, match 4: a
        const firstComponents = firstVersion.match(/(\d+)([a-z]?)(\d+)([a-z]?)/);
        const secondComponents = secondVersion.match(/(\d+)([a-z]?)(\d+)([a-z]?)/);

        return firstComponents[0] >= secondComponents[0]
            || (firstComponents[0] === secondComponents[0] && firstComponents[3] >= secondComponents[3])
            || (firstComponents[0] === secondComponents[0] && firstComponents[3] === secondComponents[3] && firstComponents[4].charCodeAt(0) >= secondComponents[4].charCodeAt(0))
    }

    const firstBaseVersion = firstVersion.replace(/-pre(\d+)/, "").replace(/-rc(\d+)/, "");
    const secondBaseVersion = secondVersion.replace(/-pre(\d+)/, "").replace(/-rc(\d+)/, "");

    let [_, firstMinor, firstPatch] = firstBaseVersion.split(".").map(Number);
    if (!firstPatch) {
        firstPatch = 0;
    }
    let [__, secondMinor, secondPatch] = secondBaseVersion.split(".").map(Number);
    if (!secondPatch) {
        secondPatch = 0;
    }

    if (firstMinor > secondMinor
        || (firstMinor === secondMinor && firstPatch >= secondPatch)
    ) {
        return true;
    }

    // -rc takes precedence over -pre
    if (firstVersion.includes("-rc") && secondVersion.includes("-pre")) {
        return true;
    }

    // If both are -pre versions
    if (firstVersion.includes("-pre") && secondVersion.includes("-pre")) {
        const firstPre = firstVersion.split("-pre")[1];
        const secondPre = secondVersion.split("-pre")[1];

        return parseInt(firstPre) >= parseInt(secondPre);
    }

    // Do the same for -rc (release candidate)
    if (firstVersion.includes("-rc") && secondVersion.includes("-rc")) {
        const firstRc = firstVersion.split("-rc")[1];
        const secondRc = secondVersion.split("-rc")[1];

        return parseInt(firstRc) >= parseInt(secondRc);
    }

    if (firstBaseVersion === secondBaseVersion) {
        if (firstVersion.includes("-pre") || secondVersion.includes("-rc")) {
            return false;
        }

        return true;
    }

    return false;
}

/**
 * @param {string} gameVersion
 * @returns {boolean}
 */
function usesLegacyAssets(gameVersion) {
    const normalized = normalizeSnapshot(gameVersion);
    if (isSnapshot(normalized)) {
        return isVersionGreaterOrEqual(globals.legacyAssetSnapshot, normalized);
    }

    return isVersionGreaterOrEqual(globals.legacyAssetVersion, gameVersion);
}

/**
 * @param {string} gameVersion
 * @returns {string[]}
 */
function getJava(gameVersion) {
    if (isSnapshot(gameVersion)) {
        if (isVersionGreaterOrEqual(gameVersion, globals.java21Snapshot)) {
            return ["21", globals.java21Url];
        }

        if (isVersionGreaterOrEqual(gameVersion, globals.java17Snapshot)) {
            return ["17", globals.java17Url];
        }

        if (isVersionGreaterOrEqual(gameVersion, globals.java16Snapshot)) {
            return ["16", globals.java16Url];
        }
    }

    if (isVersionGreaterOrEqual(gameVersion, globals.java21Version)
    ) {
        return ["21", globals.java21Url];
    }

    if (isVersionGreaterOrEqual(gameVersion, globals.java17Version)
    ) {
        return ["17", globals.java17Url];
    }

    if (isVersionGreaterOrEqual(gameVersion, globals.java16Version)
    ) {
        return ["16", globals.java16Url];
    }

    return ["8", globals.java8Url];
}

/**
 * @param {string} url
 * @param {string} [method="GET"]
 * @returns {Promise<Response>}
 */
async function fetchCatch(url, method="GET") {
    try {
        const response = await fetch(url, { method: method });
        if (!response.ok) {
            throw new CouldNotFetch(`couldn't fetch ${url}`, response);
        }

        return response;
    } catch (err) {
        // Rethrow the error to be caught by the top most error handler
        throw new SafeError(err.message, { cause: err });
    }
}

/**
 * @param {string} url
 * @param {string} filePath
 */
async function downloadFile(url, filePath) {
    const response = await fetchCatch(url);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(filePath));
}

/**
 * @param {string} gameVersion
 * @returns {Promise<object>}
 */
async function getVersion(gameVersion) {
    gameVersion = gameVersion.toLowerCase();

    const manifestResp = await fetchCatch(globals.manifestUrl);
    const manifest = await manifestResp.json();
    const versionObject = manifest.versions.find((versionObj) => versionObj.id === gameVersion);
    if (!versionObject) {
        throw new InvalidVersion(gameVersion);
    }

    const dataResp = await fetchCatch(versionObject.url);
    const data = await dataResp.json();

    return data;
}

/**
 * @param {object[]} rules
 * @returns {boolean}
 */
function parseRules(rules) {
    // TODO: Make this cover more cases
    const validityChecks = [];

    for (const rule of rules) {
        if (rule.features) {
            // TODO: Support features
            return false;
        }

        const action = rule.action;
        const osName = rule.os?.name;
        const osArch = rule.os?.arch;

        if (action && !osName && !osArch) {
            continue;
        } // Sometimes empty rules occur

        if (osArch !== globals.arch || osName !== globals.os) {
            validityChecks.push((action === "disallow"));
        }

        if (osArch === globals.arch || osName === globals.os) {
            validityChecks.push((action === "allow"));
        }
    }

    if (validityChecks.length === 0) {
        return true; // It's better to install than to not
    }

    return validityChecks.includes(true);
}

/**
 * @param {string} argument
 * @param {object} replacements
 * @returns {string}
 */
function replaceInArgument(argument, replacements) {
    // TODO: Not use regex? Pretty ugly or at least move it to globals
    if (!argument.match(/\$\{(\w+)\}/g)) {
        return argument;
    }

    return argument.replace(/\$\{(\w+)\}/g, (match, key) => {
        return replacements[key] || match; // Return the replacement value or keep the placeholder if key is not found
    });
}

function correctJarFiles(jarFiles) {
    const correctedJarFiles = []
    for (const jarFile of jarFiles) {
        correctedJarFiles.push(normalize(jarFile))
    }

    return correctedJarFiles;
}

function getCpSeparator() {
    if (globals.os === "windows") {
        return ";";
    }

    return ":";
}

export {
    splitRes,
    downloadFile,
    ensureDirExists,
    fetchCatch,
    getJava,
    getVersion,
    parseRules,
    replaceInArgument,
    usesLegacyAssets,
    correctJarFiles,
    getCpSeparator
};
