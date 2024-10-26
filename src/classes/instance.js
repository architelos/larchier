import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

import chalk from "chalk";
import glob from "fast-glob";
import slash from "slash";
import { oraPromise } from "ora";
import { open } from "yauzl-promise";

import globals from "../globals.js";
import {
    correctJarFiles,
    downloadFile,
    ensureDirExists,
    fetchCatch,
    getCpSeparator,
    getJava,
    getVersion,
    parseRules,
    replaceInArgument,
    usesLegacyAssets
} from "../utils.js";
import { SafeError } from "../exc.js";
import { Config, getDefaultConfig, fromJson } from "./config.js";
import { getProfile, getCurrentProfile } from "./profile.js";

class Instance {
    /**
     * @param {string} instanceName
     * @param {string} gameVersion
     * @param {string} [gamePath=""]
     * @param {string} [javaBinary=""]
     * @param {Config} [config=null]
     */
    constructor(instanceName, gameVersion, gamePath="", javaBinary="", config=null) {
        this.instanceName = instanceName;
        this.gameVersion = gameVersion.toLowerCase();
        this.javaBinary = javaBinary;

        this.gamePath = gamePath;
        if (!gamePath) {
            this.gamePath = `${globals.instancesPath}/${this.instanceName}`;
            if (!existsSync(this.gamePath)) {
                mkdirSync(this.gamePath, { recursive: true });
            } // Constructor doesn't support async functions
            // TODO: There's def a better way to do this though
        }
        this.clientPath = join(this.gamePath, "versions", this.gameVersion);
        this.librariesPath = join(this.gamePath, "libraries");
        this.nativesPath = join(this.clientPath, "natives");
        this.assetsPath = join(this.gamePath, "assets");

        this.versionData = "";

        this.config = config;
        if (!this.config) {
            this.config = getDefaultConfig();
        }
    }

    /**
     * @async
     */
    async saveToInstancesFile() {
        const jsonObj = {
            gameVersion: this.gameVersion,
            resolution: this.screenResolution,
            gamePath: this.gamePath,
            javaBinary: this.javaBinary,
            config: this.config
        }

        let fileContents = await readFile(globals.instancesFilePath);
        fileContents = JSON.parse(fileContents);
        fileContents[this.instanceName] = jsonObj;

        await writeFile(globals.instancesFilePath, JSON.stringify(fileContents, null, 2));
    }

    // TODO: Support Mojang auth
    /**
     * @async
     */
    async launch() {
        if (!this.versionData) {
            this.versionData = await oraPromise(getVersion(this.gameVersion), "fetching version data...");
        }

        const currentProfile = await getCurrentProfile();
        if (!currentProfile) {
            throw new SafeError("no profile in use");
        }
        const profileData = await getProfile(currentProfile);

        const jarFiles = await glob(`${slash(this.librariesPath)}/**/*.jar`);
        jarFiles.push(join(this.clientPath, `${this.gameVersion}.jar`));
        const correctedJarFiles = correctJarFiles(jarFiles);

        // TODO: Not hardcode this
        const replacements = {
            "auth_player_name": profileData.username,
            "version_name": this.gameVersion,
            "game_directory": this.gamePath,
            "assets_root": this.assetsPath,
            "assets_index_name": this.versionData.assetIndex.id,
            "auth_uuid": profileData.uuid,
            "auth_access_token": "''",
            "clientid": Buffer.from(randomUUID()).toString("base64"),
            "auth_xuid": "''",
            "user_type": "''",
            "version_type": this.versionData.type || "unknown", // A few vers don't have a type specified
            "natives_directory": this.nativesPath,
            "launcher_name": "Larchier",
            "launcher_version": globals.version,
            "classpath": correctedJarFiles.join(getCpSeparator()),
            "user_properties": "{}"
        }

        const cmdArgs = [
            "-Dfml.ignoreInvalidMinecraftCertificates=true", // For Forge to work with offline MC
        ];

        for (const configJavaArg of this.config.javaArgs.split(" ")) {
            cmdArgs.push(configJavaArg);
        }
        cmdArgs.push(`-Xmx${this.config.allocatedMem}`);

        if (this.versionData.arguments?.jvm) {
            for (let jvmArg of this.versionData.arguments.jvm) {
                if (jvmArg.rules && !parseRules(jvmArg.rules)) {
                    continue;
                }

                jvmArg = jvmArg.value ? jvmArg.value : jvmArg;
                if (Array.isArray(jvmArg)) {
                    for (const arrJvmArg of jvmArg) {
                        arrJvmArg.match(/\$\{(\w+)\}/)
                        ? cmdArgs.push(replaceInArgument(arrJvmArg, replacements))
                        : cmdArgs.push(arrJvmArg);
                    }
                } else {
                    jvmArg.match(/\$\{(\w+)\}/)
                    ? cmdArgs.push(replaceInArgument(jvmArg, replacements))
                    : cmdArgs.push(jvmArg);
                }
            }
        } else { // Push the bare minimums
            cmdArgs.push(`-Djava.library.path=${replacements.natives_directory}`);
            cmdArgs.push(...["-cp", replacements.classpath]);
        }
        cmdArgs.push(this.versionData.mainClass);

        cmdArgs.push(...["--width", this.config.width]);
        cmdArgs.push(...["--height", this.config.height]);
        const gameArgs = this.versionData.arguments?.game || this.versionData.minecraftArguments.split(" ");
        for (const gameArg of gameArgs) {
            if (gameArg.rules && !parseRules(gameArg.rules)) {
                continue;
            }

            const toReplace = gameArg.value ? gameArg.value : gameArg;
            cmdArgs.push(replaceInArgument(toReplace, replacements));
        }

        console.log();

        const command = spawn(this.javaBinary, cmdArgs);
        // Capture output
        command.stdout.on("data", (data) => {
            const cleanedData = data.toString().replace(/\n$/, "");
            console.log(cleanedData);
          });

        command.stderr.on("data", (data) => {
            const cleanedData = data.toString().replace(/\n$/, "");
            console.error(`${chalk.red(cleanedData)}`);
        });

        command.on("close", (code) => {
            console.log();
            console.log(`${chalk.bold("exited!")} exit code: ${chalk.bold(code)}`);
        });
    }

    /**
     * @async
     */
    async downloadJava() {
        if (!this.gameVersion) {
            throw new Error("no game version specified");
        }

        const [javaVersion, javaUrl] = getJava(this.gameVersion);

        const javaPath = join(globals.javaPath, javaVersion);
        if (existsSync(javaPath)) {
            // Java binaries already exist, no need to download
            console.log(`jdk ${javaVersion} already exists; no need to download`);
            this.javaBinary = join(javaPath, "bin", "javaw.exe");

            return;
        }

        await mkdir(javaPath, { recursive: true });

        const filePath = join(javaPath, `jdk-${javaVersion}.zip`);
        await oraPromise(downloadFile(javaUrl, filePath), `downloading jdk ${javaVersion}...`);
        await oraPromise(async () => {
            const zip = await open(filePath);
            try {
                for await (const entry of zip) {
                    let fileName = entry.filename;
                    if (entry.filename.endsWith("/")) {
                        fileName = entry.filename.slice(0, -1);
                    }

                    const pathParts = fileName.split("/");
                    pathParts.shift();
                    const path = join(javaPath, ...pathParts); // No need for sep, as join automatically handles path separators based on the platform

                    if (entry.filename.endsWith("/")) {
                        if (pathParts.length === 0) {
                            // Don't create the base path
                            continue;
                        }

                        await mkdir(path);
                    } else {
                        await ensureDirExists(dirname(path));
                        await pipeline(await entry.openReadStream(), createWriteStream(path));
                    }
                }
            } catch (err) {
                await zip.close();
                await rm(javaPath, { force: true, recursive: true });

                throw new Error(err.message, { cause: err });
            }

            await zip.close();
            await rm(filePath);
        }, "extracting archive...");

        this.javaBinary = join(javaPath, "bin", "javaw.exe"); // TODO: support other OSes
    }

    /**
     * @async
     */
    async downloadClient() {
        if (!this.versionData) {
            this.versionData = await oraPromise(getVersion(this.gameVersion), "fetching version data...");
        }

        await ensureDirExists(this.clientPath);

        if (this.versionData.downloads.client_mappings) {
            await oraPromise(downloadFile(
                this.versionData.downloads.client_mappings.url,
                join(this.clientPath, "client.txt")),
                "downloading client mappings..."
            );
        } else {
            console.log(`no client mappings found`);
        }

        await oraPromise(downloadFile(
                this.versionData.downloads.client.url,
                join(this.clientPath, `${this.gameVersion}.jar`)),
                "downloading client .jar..."
            );
    }

    /**
     * @async
     */
    async downloadLibrariesAndNatives() {
        if (!this.versionData) {
            this.versionData = await oraPromise(getVersion(this.gameVersion), "fetching version data...");
        }

        await ensureDirExists(this.librariesPath);

        const libraries = this.versionData.libraries;
        for (const library of libraries) {
            if (library.rules && !parseRules(library.rules)) {
                continue;
            }

            const classifiers = library.downloads.classifiers || library.classifiers || {};
            let nativeClassifier = globals.natives;
            // Twitch lib is goofy
            if (globals.os === "windows" && !classifiers[globals.natives]) {
                nativeClassifier = `${globals.natives}-${globals.archNumber}`;
            }

            if (library.natives) {
                const nativePath = join(this.librariesPath, classifiers[nativeClassifier].path);
                await ensureDirExists(dirname(nativePath));
                await oraPromise(downloadFile(classifiers[nativeClassifier].url, nativePath), `${library.name} (natives)`);
            }

            if (library.downloads.artifact?.path) { // net.java.jinput:jinput-platform:2.0.5
                let path = library.downloads.artifact?.path;
                if (!library.downloads.artifact?.path) {
                    const urlToExtract = library.downloads.artifact?.url || classifiers[nativeClassifier].url;
                    path = urlToExtract.replace(globals.librariesUrl, "");
                }

                if (library.downloads.artifact?.url) { // Again, net.java.jinput:jinput-platform:2.0.5
                    const jarPath = join(this.librariesPath, path);
                    await ensureDirExists(dirname(jarPath));
                    await oraPromise(downloadFile(library.downloads.artifact?.url, jarPath), library.name);
                }
            }
        }
    }

    /**
     * @async
     */
    // Download both the natives .jar in the libraries and extract it to the natives dir for redundancy
    async extractNatives() {
        await ensureDirExists(this.nativesPath, { recursive: true });

        const jarEntries = await glob(`${slash(this.librariesPath)}/**/*.jar`); // Get all .jar files
        for (const jarEntry of jarEntries) {
            if (!basename(jarEntry).includes("natives")) {
                continue;
            }

            await oraPromise(async () => {
                const zipEntries = await open(jarEntry);
                for await (const zipEntry of zipEntries) {
                    if (!zipEntry.filename.endsWith(".dll")
                        && !zipEntry.filename.endsWith(".so")
                        && !zipEntry.filename.endsWith(".dylib")
                    ) {
                        continue;
                    }

                    const path = join(this.nativesPath, basename(zipEntry.filename));
                    await pipeline(await zipEntry.openReadStream(), createWriteStream(path));
                }
            }, basename(jarEntry));
        }
    }

    /**
     * @async
     */
    async downloadAssets() {
        if (!this.versionData) {
            this.versionData = await oraPromise(getVersion(this.gameVersion), "fetching version data...");
        }

        await ensureDirExists(this.assetsPath);

        const objectsPath = join(this.assetsPath, "objects");
        const indexesPath = join(this.assetsPath, "indexes");
        const logConfigPath = join(this.assetsPath, "log_configs");
        const virtualPath = join(this.assetsPath, "virtual", "legacy");

        await ensureDirExists(objectsPath);
        await ensureDirExists(indexesPath);
        await ensureDirExists(logConfigPath);

        const assetsUrl = this.versionData.assetIndex.url;
        const assetsDataResp = await fetchCatch(assetsUrl);
        const assetsData = await assetsDataResp.json();
        await writeFile(join(indexesPath, basename(assetsUrl)), JSON.stringify(assetsData, null, 2), { encoding: "utf-8" });

        const isLegacy = assetsData.virtual || usesLegacyAssets(this.gameVersion);
        if (isLegacy) {
            await ensureDirExists(virtualPath);
        }

        const logConfigFile = this.versionData.logging.client.file.url;
        await oraPromise(downloadFile(logConfigFile, join(logConfigPath, basename(logConfigFile))), "downloading log config...");

        await oraPromise(async () => {
            for (const assetKey in assetsData.objects) {
                const assetData = assetsData.objects[assetKey];
                const firstHashes = assetData.hash.substring(0, 2);
                const fullHashes = `${firstHashes}/${assetData.hash}`;
                const fileUrl = `${globals.assetsUrl}/${fullHashes}`;

                const dirPath = !isLegacy
                    ? join(objectsPath, firstHashes)
                    : dirname(assetKey) !== "."
                        ? join(virtualPath, dirname(assetKey))
                        : virtualPath;
                await ensureDirExists(dirPath);

                const fileName = isLegacy ? basename(assetKey) : assetData.hash;
                const filePath = isLegacy
                    ? join(dirPath, fileName)
                    : join(dirPath, assetData.hash);
                await downloadFile(fileUrl, filePath);
            }
        }, "downloading assets...");
    }
}

/**
 * @param {string} instanceName
 * @returns {Promise<Instance>}
 */
async function fromInstancesFile(instanceName) {
    const fileContents = await readFile(globals.instancesFilePath, { encoding: "utf-8" });
    const instanceData = JSON.parse(fileContents)[instanceName];
    if (!instanceData) {
        throw new SafeError(`${instanceName} does not exist`);
    }

    return new Instance(
        instanceName,
        instanceData.gameVersion,
        instanceData.gamePath,
        instanceData.javaBinary,
        fromJson(instanceData.config)
    );
}

/**
 * @returns {Promise<string[]>}
 */
async function getAllInstances() {
    const fileContents = await readFile(globals.instancesFilePath, { encoding: "utf-8" });
    const instancesData = JSON.parse(fileContents);

    return Object.keys(instancesData);
}

/**
 * @param {string} instanceName
 * @async
 */
async function removeInstance(instanceName) {
    let fileContents = await readFile(globals.instancesFilePath, { encoding: "utf-8" });

    const instancesData = JSON.parse(fileContents);
    delete instancesData[instanceName];

    fileContents = JSON.stringify(instancesData, null, 2);
    await writeFile(globals.instancesFilePath, fileContents);
}

/**
 * @param {string} instanceName
 * @async
 */
async function deleteInstanceData(instanceName) {
    await rm(join(globals.instancesPath, instanceName), { recursive: true });
}

export {
    fromInstancesFile,
    getAllInstances,
    removeInstance,
    deleteInstanceData,
    Instance
};
