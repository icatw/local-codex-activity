import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aggregateActivity } from "./activity.js";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

async function serveStatic(response, publicDir, pathname, headOnly) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    notFound(response);
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const absolutePath = path.resolve(publicDir, relativePath);
  const relative = path.relative(publicDir, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    notFound(response);
    return;
  }

  try {
    const file = await stat(absolutePath);
    if (!file.isFile()) {
      notFound(response);
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-cache",
      "content-length": file.size,
      "content-type":
        MIME_TYPES.get(path.extname(absolutePath)) ??
        "application/octet-stream",
    });
    if (headOnly) {
      response.end();
    } else {
      createReadStream(absolutePath).pipe(response);
    }
  } catch {
    notFound(response);
  }
}

export function createAppServer({ sessionsDir, publicDir }) {
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/activity") {
      if (request.method === "HEAD") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const timezone =
        url.searchParams.get("timezone") ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "UTC";
      try {
        const activity = await aggregateActivity({ sessionsDir, timezone });
        sendJson(response, 200, {
          generatedAt: new Date().toISOString(),
          timezone,
          ...activity,
        });
      } catch (error) {
        if (error instanceof RangeError) {
          sendJson(response, 400, { error: "Invalid timezone" });
        } else {
          sendJson(response, 500, { error: "Could not read local activity" });
        }
      }
      return;
    }

    await serveStatic(
      response,
      publicDir,
      url.pathname,
      request.method === "HEAD",
    );
  });
}

function parseCliArguments(argumentsList) {
  const options = {
    port: Number(process.env.PORT ?? 4317),
    sessionsDir:
      process.env.CODEX_SESSIONS_DIR ?? path.join(os.homedir(), ".codex", "sessions"),
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === "--port") {
      options.port = Number(argumentsList[index + 1]);
      index += 1;
    } else if (argumentsList[index] === "--sessions-dir") {
      options.sessionsDir = path.resolve(argumentsList[index + 1]);
      index += 1;
    }
  }

  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error("Port must be an integer between 0 and 65535");
  }
  return options;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] != null && path.resolve(process.argv[1]) === modulePath) {
  const options = parseCliArguments(process.argv.slice(2));
  const publicDir = path.resolve(path.dirname(modulePath), "..", "public");
  const server = createAppServer({
    sessionsDir: options.sessionsDir,
    publicDir,
  });
  server.listen(options.port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`Local Codex Activity: http://127.0.0.1:${address.port}`);
    console.log(`Reading sessions from: ${options.sessionsDir}`);
  });
}
