import chalk from "chalk";
import prompt from "prompts";
import { oraPromise } from "ora";

import {
    Profile,
    getProfile,
    getProfiles,
    getCurrentProfile,
    setCurrentProfile,
    addProfile,
    removeProfile
} from "../classes/profile.js";
import { SafeError } from "../exc.js";

/**
 * @param {boolean} add
 * @param {boolean} remove
 * @param {boolean} use
 * @async
 */
async function profile(add, remove, use) {
    if (add) {
        const { profileName } = await prompt({
            type: "text",
            name: "profileName",
            message: "profile name?"
        });
        const newProfile = new Profile(profileName);

        console.log();
        return await oraPromise(addProfile(newProfile), `${chalk.bold(`adding profile ${profileName}`)}`);
    }

    if (remove) {
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

    if (use) {
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
}

export { profile };
