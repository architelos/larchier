import { readFile, writeFile } from "node:fs/promises";

import globals from "../globals.js";
import { splitRes } from "../utils.js";

// TODO: Support mods
class Config {
    /**
     * @type {string}
     */
    height = "";

    /**
     * @type {string}
     */
    width = "";

    /**
     * @type {string}
     */
    allocatedMem = "";

    /**
     * @type {string}
     */
    javaArgs = "";

    /**
     * @param {string} resolution
     * @param {string} allocatedMem
     * @param {string} javaArgs
     */

    constructor(resolution, allocatedMem, javaArgs) {
        this.width = splitRes(resolution)[0];
        this.height = splitRes(resolution)[1];

        this.allocatedMem = allocatedMem;
        this.javaArgs = javaArgs;
    }

    /**
     * @returns {string}
     */
    toJson() {
        const obj = {
            height: this.height,
            width: this.width,
            allocatedMem: this.allocatedMem,
            javaArgs: this.javaArgs
        }

        console.log(JSON.stringify(obj, null, 2))
        return JSON.stringify(obj, null, 2);
    }
}

/**
 * @returns {Config}
 */
function getDefaultConfig() {
    const defaultRes = "854x480";
    const defaultMaxMem = "2G";
    const defaultJavaArgs = "-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M";

    return new Config(defaultRes, defaultMaxMem, defaultJavaArgs);
}

/**
 * @param {object} configData
 * @returns {Config}
 */
function fromJson(configData) {
    return new Config(
        `${configData.width}x${configData.height}`,
        configData.allocatedMem,
        configData.javaArgs
    );
}

/**
 * @param {string} instanceName
 * @returns {Promise<object>}
 */
async function getConfigOfInstance(instanceName) {
    const fileContents = await readFile(globals.instancesFilePath, { encoding: "utf-8" });
    const instanceData = JSON.parse(fileContents)[instanceName];
    const configData = instanceData.config;

    return configData;
}

/**
 * @param {string} instanceName
 * @param {object} config
 * @async
 */
async function saveConfig(instanceName, config) {
    let fileContents = await readFile(globals.instancesFilePath, { encoding: "utf-8" });
    fileContents = JSON.parse(fileContents);
    fileContents[instanceName]["config"] = config;

    await writeFile(globals.instancesFilePath, JSON.stringify(fileContents, null, 2));
}

export { Config, getDefaultConfig, fromJson, getConfigOfInstance, saveConfig };
