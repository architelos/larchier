import chalk from "chalk";
import { Command } from "commander";
const program = new Command();

import { existsSync, writeFileSync } from "node:fs";

import {
    CouldNotFetch,
    InvalidArch,
    InvalidInstanceName,
    InvalidInstanceType,
    InvalidOS,
    InvalidVersion,
    SafeError
} from "./exc.js";
import globals from "./globals.js";
import { ensureDirExists } from "./utils.js";

import { instance } from "./cmds/instance.js";
import { profile } from "./cmds/profile.js";
import { launchInstance } from "./cmds/launch.js";
import { config } from "./cmds/config.js";

// https://github.com/tj/commander.js/issues/782
/**
 * @param {Error} error
 */
function errorHandler(error) {
    if (error instanceof InvalidArch
        || error instanceof InvalidOS
        || error instanceof InvalidInstanceType
        || error instanceof CouldNotFetch
        || error.cause instanceof CouldNotFetch
        || error instanceof InvalidInstanceName
        || error instanceof InvalidVersion
        || error instanceof SafeError
    ) {
        console.error(`${chalk.red("error:")} ${error.message}`);
    } else {
        console.error(`${chalk.red("unexpected error:")} ${error}`);
        console.error(chalk.red(error.stack));
    }
}

/**
 * @param {(...args) => Promise<Any>} fn
 */
function commandRunner(fn) {
    return (...args) => { fn(...args).catch(errorHandler); };
}

// Regenerate blank folders/files if they were deleted
await ensureDirExists(globals.basePath);
await ensureDirExists(globals.javaPath);

if (!existsSync(globals.instancesFilePath)) {
    writeFileSync(globals.instancesFilePath, JSON.stringify({}));
}

if (!existsSync(globals.profilesFilePath)) {
    writeFileSync(globals.profilesFilePath, JSON.stringify({}));
}

program
    .name("larchier")
    .description(`Tiny CLI Minecraft launcher with modding support (v${globals.version})`)
    .helpCommand("help [cmd]", "Show help")
    .helpOption(false);

program
    .command("instance")
    .description("Add/remove an instance")
    .option("-a, --add", "Add an instance")
    .option("-r, --remove", "Remove an instance")
    .action(commandRunner(async (options) => {
        if (!options.add && !options.remove) {
            throw new SafeError("no option provided");
        }

        await instance(options.add, options.remove);
    }));

program
    .command("launch")
    .description("Launch an instance")
    .action(commandRunner(async () => {
        await launchInstance();
    }));

program
    .command("config")
    .description("Edit a config's configuration")
    .action(commandRunner(async () => {
        await config();
    }));

program
    .command("profile")
    .description("Add, remove, or use a profile")
    .option("-a, --add", "Add a profile")
    .option("-r, --remove", "Remove a profile")
    .option("-u, --use", "Use a profile")
    .action(commandRunner(async (options) => {
        if (!options.add && !options.remove && !options.use) {
            throw new SafeError("no option provided");
        }

        await profile(options.add, options.remove, options.use);
    }));

await program.parseAsync();
