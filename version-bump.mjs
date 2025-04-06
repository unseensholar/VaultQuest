import { readFileSync, writeFileSync } from "fs";

// Read the manifest file
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const currentVersion = manifest.version;

// Read the versions file
let versions = JSON.parse(readFileSync("versions.json", "utf8"));

// Check if the version already exists
if (versions[currentVersion]) {
  console.log(`Version ${currentVersion} already exists in versions.json, skipping`);
} else {
  // Add the new version with the minAppVersion from the manifest
  versions[currentVersion] = manifest.minAppVersion;
  
  // Sort the versions object by version numbers (assuming semver)
  versions = Object.fromEntries(
    Object.entries(versions)
      .sort(([a], [b]) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      })
  );
  
  // Write the versions file back
  writeFileSync("versions.json", JSON.stringify(versions, null, 2));
  console.log(`Added version ${currentVersion} to versions.json`);
}
