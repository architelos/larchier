import chalk from "chalk";
import prompt from "prompts";
import { oraPromise } from "ora";

import { InvalidInstanceName, InvalidVersion, SafeError } from "../exc.js";
import {
    Instance,
    removeInstance,
    deleteInstanceData,
    getAllInstances
} from "../classes/instance.js";
import { getVersion } from "../utils.js";
import { existsSync } from "node:fs";

/**
 * @async
 */
async function instanceAdd() {
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
                // { title: "Fabric", value: "Fabric" }
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

    console.log(`${chalk.bold("⸺⸺ downloading objects (may take a while)")}`);
    await instance.downloadAssets();
    console.log();

    await instance.saveToInstancesFile();
    console.log(`${chalk.bold("done!")}`);
}

/**
 * @async
 */
async function instanceRemove() {
    const instanceNames = await getAllInstances();
    if (!instanceNames) {
        throw new SafeError("no instances were found");
    }

    const instanceChoices = []
    for (const instanceName of instanceNames) {
        instanceChoices.push({ title: instanceName, value: instanceName });
    }

    const { toRemove } = await prompt({
        type: "select",
        name: "toRemove",
        message: "instance to remove?",
        choices: instanceChoices,
        initial: 0
    });
    const { confirmation } = await prompt({
        type: "confirm",
        name: "confirmation",
        message: "are you sure?",
        initial: false
    });
    console.log();

    if (!confirmation) {
        return console.log(`${chalk.bold("stopping")}`);
    }

    console.log(`${chalk.bold(`⸺⸺ removing instance: ${toRemove}`)}`);
    await oraPromise(deleteInstanceData(toRemove), "deleting instance data...");
    await oraPromise(removeInstance(toRemove), "removing instance...");
}

/**
 * @param {boolean} add
 * @param {boolean} remove
 * @async
 */
async function instance(add, remove) {
    if (add) {
        return await instanceAdd();
    }

    if (remove) {
        return await instanceRemove();
    }
}

export { instance };
