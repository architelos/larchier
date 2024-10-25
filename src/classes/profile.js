import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { SafeError } from "../exc.js";
import globals from "../globals.js";

// TODO: Support Mojang auth
class Profile {
    /**
     * @type {string}
     */
    username = "";

    /**
     * @type {string}
     */
    uuid = ""

    /**
     * @param {string} username
     * @param {string} [uuid=""]
     */
    constructor(username, uuid="") {
        this.username = username;
        this.uuid = uuid;
        if (!uuid) {
            this.uuid = randomUUID();
        }
    }

    /**
     * @returns {string}
     */
    toJson() {
        const obj = {
            username: this.username,
            uuid: this.uuid
        }

        return JSON.stringify(obj, null, 2);
    }
}

/**
 * @param {string} profileName
 * @returns {Promise<Profile>}
 */
async function getProfile(profileName) {
    let fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    fileContents = JSON.parse(fileContents);

    const profiles = fileContents.profiles || [];
    const profileIndex = profiles.findIndex(user => user.username === profileName);
    if (profileIndex === -1) {
        throw new SafeError(`profile ${profileName} doesn't exist`);
    }
    const profile = profiles[profileIndex];

    return new Profile(profile.username, profile.uuid);
}

/**
 * @returns {Promise<object[]>}
 */
async function getProfiles() {
    const fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    const profilesData = JSON.parse(fileContents);

    return profilesData.profiles;
}

/**
 * @returns {Promise<string>}
 */
async function getCurrentProfile() {
    const fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    const currentProfile = JSON.parse(fileContents).current || "";

    return currentProfile;
}

/**
 * @param {string} profileName
 * @async
 */
async function setCurrentProfile(profileName) {
    let fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    fileContents = JSON.parse(fileContents);
    fileContents.current = profileName;

    await writeFile(globals.profilesFilePath, JSON.stringify(fileContents, null, 2));
}

/**
 * @param {Profile} profile
 * @async
 */
async function addProfile(profile) {
    let fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    fileContents = JSON.parse(fileContents);

    const profiles = fileContents.profiles || [];
    const newProfiles = [...profiles, { username: profile.username, uuid: profile.uuid }];

    fileContents.profiles = newProfiles;

    await writeFile(globals.profilesFilePath, JSON.stringify(fileContents, null, 2));
}

/**
 * @param {string} profileName
 * @async
 */
async function removeProfile(profileName) {
    let fileContents = await readFile(globals.profilesFilePath, { encoding: "utf-8" });
    fileContents = JSON.parse(fileContents);

    const profiles = fileContents.profiles || [];
    const profileIndex = profiles.findIndex(user => user.username === profileName);

    if (profileIndex !== -1) { // If it was found
        profiles.splice(profileIndex, 1);
    }

    fileContents.profiles = profiles;
    await writeFile(globals.profilesFilePath, JSON.stringify(fileContents, null, 2));
}

export { Profile, getProfile, getProfiles, getCurrentProfile, setCurrentProfile, addProfile, removeProfile };
