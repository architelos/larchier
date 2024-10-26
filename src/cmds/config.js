import chalk from "chalk";
import prompt from "prompts";
import { oraPromise } from "ora";

import { SafeError } from "../exc.js";
import { splitRes } from "../utils.js";
import { getAllInstances } from "../classes/instance.js";
import { getConfigOfInstance, saveConfig } from "../classes/config.js";

/**
 * @async
 */
async function config() {
    const instanceNames = await getAllInstances();
    if (!instanceNames) {
        throw new SafeError("no instances were found");
    }

    const instanceChoices = []
    for (const instanceName of instanceNames) {
        instanceChoices.push({ title: instanceName, value: instanceName });
    }

    const { toEdit } = await prompt({
        type: "select",
        name: "toEdit",
        message: "instance to edit?",
        choices: instanceChoices,
        initial: 0
    });
    const instanceConfig = await getConfigOfInstance(toEdit);
    const prompts = [
        {
            type: "text",
            name: "resolution",
            message: "resolution? (width x height)",
            initial: `${instanceConfig.width}x${instanceConfig.height}`
        },
        {
            type: "text",
            name: "allocatedMem",
            message: "allocated memory?",
            initial: instanceConfig.allocatedMem
        },
        {
            type: "text",
            name: "javaArgs",
            message: "java arguments? (ignores -Xmx)",
            initial: instanceConfig.javaArgs
        }
    ];

    const { resolution, allocatedMem, javaArgs } = await prompt(prompts);
    console.log();

    await oraPromise(async () => {
        await saveConfig(
            toEdit,
            {
                width: splitRes(resolution)[0],
                height: splitRes(resolution)[1],
                allocatedMem: allocatedMem,
                javaArgs: javaArgs
            }
        );
    }, `${chalk.bold("editing config...")}`);
}

export { config };
