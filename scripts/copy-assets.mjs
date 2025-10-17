import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function copyAsset(source, target) {
  const destinationDir = dirname(target);
  await mkdir(destinationDir, { recursive: true });
  await copyFile(source, target);
}

async function main() {
  const assets = [
    {
      source: resolve("src", "llm", "prompts", "hypothesis.md"),
      target: resolve("dist", "llm", "prompts", "hypothesis.md"),
    },
  ];

  await Promise.all(assets.map(({ source, target }) => copyAsset(source, target)));
}

main().catch((error) => {
  console.error("Failed to copy build assets", error);
  process.exitCode = 1;
});
