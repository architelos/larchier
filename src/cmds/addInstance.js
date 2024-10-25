import chalk from "chalk";
import prompt from "prompts";

import { InvalidInstanceName, InvalidVersion, SafeError } from "../exc.js";
import { Instance } from "../classes/instance.js";
import { getVersion } from "../utils.js";
import { existsSync } from "node:fs";

/**
 * @async
 */
async function addInstance() {
    const prompts = [
        {
            type: "text",
            name: "instanceName",
            message: "instance name?"
        },
        {
            type: "text",
            name: "instanceVersion",
            message: "minecraft version?"
        },
        {
            type: "select",
            name: "instanceType",
            message: "instance type?",
            choices: [
                { title: "Vanilla", value: "vanilla" },
                { title: "Fabric", value: "Fabric" }
            ],
            initial: 0
        },
        {
            type: "text",
            name: "gamePath",
            message: "game directory? (leave blank for default)",
            initial: "",
        },
        {
            type: "text",
            name: "javaBinary",
            message: "java binary? (leave blank for default)",
            initial: ""
        }
    ]
    let { instanceName, instanceVersion, instanceType, gamePath, javaBinary } = await prompt(prompts);
    console.log();

    if (!instanceName) {
        throw new InvalidInstanceName();
    }

    if (!existsSync(gamePath) && gamePath) {
        throw new SafeError(`${gamePath} does not exist`);
    }

    if (!existsSync(javaBinary) && javaBinary) {
        throw new SafeError(`${javaBinary} does not exist`);
    }

    console.log(`adding ${chalk.bold(instanceType)} instance: ${chalk.bold(instanceName)}`);
    console.log();

    instanceType = instanceType.toLowerCase();
    const instance = new Instance(instanceName, instanceVersion, gamePath, javaBinary);

    if (!await getVersion(instanceVersion.toLowerCase())) {
        throw new InvalidVersion(instanceVersion);
    }

    console.log(`${chalk.bold("⸺⸺ downloading java")}`);

    if (javaBinary) {
        console.log("java binary specified; no need to download java");
    } else {
        await instance.downloadJava();
    }

    console.log();

    console.log(`${chalk.bold("⸺⸺ downloading client files")}`);
    await instance.downloadClient();
    console.log();

    console.log(`${chalk.bold("⸺⸺ downloading libraries")}`);
    await instance.downloadLibrariesAndNatives();
    console.log();

    console.log(`${chalk.bold("⸺⸺ extracting natives")}`);
    await instance.extractNatives();
    console.log();

    console.log(`${chalk.bold("⸺⸺ downloading objects")}`);
    await instance.downloadAssets();
    console.log();

    await instance.saveToInstancesFile();
    console.log(`${chalk.bold("done!")}`);
}

export { addInstance };
