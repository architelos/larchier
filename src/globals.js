import { join } from "node:path";

import { InvalidArch, InvalidOS } from "./exc.js";

const globals = {};
globals.version = "1.0.0-beta";
globals.os = (process.platform === "win32")
                    ? "windows"
                    : (process.platform === "darwin")
                    ? "osx"
                    : (process.platform === "linux")
                    ? "linux"
                    : "unsupported"
if (globals.os === "unsupported") {
    throw new InvalidOS(process.platform);
}
globals.natives = `natives-${globals.os}`;

globals.arch = (process.arch === "x64")
                    ? "x64"
                    : (process.arch === "ia32")
                    ? "x86"
                    : "unsupported"
if (globals.arch === "unsupported") {
    throw new InvalidArch(process.arch);
}
globals.archNumber = globals.arch.replace("x", "");

globals.manifestUrl = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
globals.assetsUrl = "https://resources.download.minecraft.net/";

// TODO: This doesn't support OSX/Linux yet
globals.basePath = join(process.env.LOCALAPPDATA, "larchier");
globals.javaPath = join(globals.basePath, "java");
globals.profilesFilePath = join(globals.basePath, "profiles.json");
globals.instancesFilePath = join(globals.basePath, "instances.json");
globals.instancesPath = join(globals.basePath, "instances");

// TODO: Nor does this
// Oracle doesn't support jdk 8 anymore? Couldn't find a .zip file for download
globals.java8Url = `https://builds.openlogic.com/downloadJDK/openlogic-openjdk/8u422-b05/openlogic-openjdk-8u422-b05-windows-${globals.arch === "x86" ? "x32" : globals.arch}.zip`;
globals.java16Url = `https://download.oracle.com/java/16/latest/jdk-16_windows-${globals.arch}_bin.zip`;
globals.java17Url = `https://download.oracle.com/java/17/latest/jdk-17_windows-${globals.arch}_bin.zip`;
globals.java21Url = `https://download.oracle.com/java/21/latest/jdk-21_windows-${globals.arch}_bin.zip`;

// https://minecraft.fandom.com/wiki/Tutorials/Update_Java
globals.java16Version = "1.18-pre1";
globals.java16Snapshot = "21w19a";
globals.java17Version = "1.18-pre2";
globals.java17Snapshot = "22w03a";
globals.java21Version = "1.20.5-pre1";
globals.java21Snapshot = "24w14a";

globals.legacyAssetVersion = "1.7.2";
globals.legacyAssetSnapshot = "13w48b";

export default globals;
