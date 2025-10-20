#!/usr/bin/env node
/* eslint-disable no-console */
import process from "node:process";
import { start, SERVER_VERSION } from "./server.js";
import { logger } from "./logger.js";

function parseArguments(args: string[]) {
  let showHelp = false;
  let showVersion = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    }

    if (arg === "--version" || arg === "-v") {
      showVersion = true;
    }
  }

  return { showHelp, showVersion };
}

function printHelp(): void {
  console.log(
    `mcp-rca v${SERVER_VERSION}\n\n` +
      `Usage: mcp-rca [options]\n\n` +
      `Options:\n` +
      `  --help, -h     Show this help message\n` +
      `  --version, -v  Print the current version`,
  );
}

async function main(): Promise<void> {
  const cliOptions = parseArguments(process.argv.slice(2));

  if (cliOptions.showVersion) {
    console.log(`mcp-rca v${SERVER_VERSION}`);
    return;
  }

  if (cliOptions.showHelp) {
    printHelp();
    return;
  }

  try {
    await start();
  } catch (error) {
    logger.error("Failed to start mcp-rca server", "cli", { error });
    process.exitCode = 1;
  }
}

void main();
