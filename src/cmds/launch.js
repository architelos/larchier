import { randomUUID } from "node:crypto";
import { chdir } from "node:process";

import chalk from "chalk";
import prompt from "prompts";

import { fromInstancesFile, getAllInstances } from "../classes/instance.js";
import { SafeError } from "../exc.js";

// TODO: Support config
/**
 * @async
 */
async function launchInstance() {
    const instanceNames = await getAllInstances();
    if (!instanceNames) {
        throw new SafeError("no instances were found");
    }

    const instanceChoices = []
    for (const instanceName of instanceNames) {
        instanceChoices.push({ title: instanceName, value: instanceName });
    }

    const { toLaunch } = await prompt({
        type: "select",
        name: "toLaunch",
        message: "instance to launch?",
        choices: instanceChoices,
        initial: 0
    });
    const instance = await fromInstancesFile(toLaunch);
    chdir(instance.gamePath);

    console.log()

    console.log(`${chalk.bold(`⸺⸺ launching ${toLaunch}`)}`);
    await instance.launch("architelos", randomUUID());
}

export { launchInstance };
