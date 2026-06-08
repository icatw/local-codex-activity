import os from "node:os";
import path from "node:path";

import { exportProfileSvg } from "./profile-svg.js";

function parseArguments(argumentsList) {
  const options = {
    outputPath: path.resolve("assets", "codex-activity.svg"),
    sessionsDir: path.join(os.homedir(), ".codex", "sessions"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--output") {
      options.outputPath = path.resolve(argumentsList[index + 1]);
      index += 1;
    } else if (argument === "--sessions-dir") {
      options.sessionsDir = path.resolve(argumentsList[index + 1]);
      index += 1;
    } else if (argument === "--timezone") {
      options.timezone = argumentsList[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const result = await exportProfileSvg(options);
console.log(`Wrote ${result.outputPath}`);
console.log(
  `Published ${result.activeDays} active days from ${result.coverage.tokenEvents} local token events`,
);
