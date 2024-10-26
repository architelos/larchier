import chalk from "chalk";
import prompt from "prompts";
import { oraPromise } from "ora";

import {
    Profile,
    getProfiles,
    setCurrentProfile,
    addProfile,
    removeProfile
} from "../classes/profile.js";
import { SafeError } from "../exc.js";

/**
 * @async
 */
async function profileAdd() {
    const { profileName } = await prompt({
        type: "text",
        name: "profileName",
        message: "profile name?"
    });
    const newProfile = new Profile(profileName);

    console.log();
    return await oraPromise(addProfile(newProfile), `${chalk.bold(`adding profile ${profileName}`)}`);
}

/**
 * @async
 */
async function profileRemove() {
    const profiles = await getProfiles();
    if (!profiles) {
        throw new SafeError("no profiles found");
    }

    const profileChoices = []
    for (const profile of profiles) {
        profileChoices.push({ title: profile.username, value: profile.username });
    }
    const { toRemove } = await prompt({
        type: "select",
        name: "toRemove",
        message: "profile to remove?",
        choices: profileChoices,
        initial: 0
    });

    console.log();
    return await oraPromise(removeProfile(toRemove), `${chalk.bold(`removing profile ${toRemove}`)}`);
}

async function profileUse() {
    const profiles = await getProfiles();
    if (profiles.length === 0) {
        throw new SafeError("no profiles found");
    }

    const profileChoices = []
    for (const profile of profiles) {
        profileChoices.push({ title: profile.username, value: profile.username });
    }
    const { toUse } = await prompt({
        type: "select",
        name: "toUse",
        message: "profile to remove?",
        choices: profileChoices,
        initial: 0
    });

    console.log();
    return await oraPromise(setCurrentProfile(toUse), `${chalk.bold(`using profile: ${toUse}`)}`);
}

/**
 * @param {boolean} add
 * @param {boolean} remove
 * @param {boolean} use
 * @async
 */
async function profile(add, remove, use) {
    if (add) {
        return await profileAdd();
    }

    if (remove) {
        return await profileRemove();
    }

    if (use) {
        return await profileUse();
    }
}

export { profile };
