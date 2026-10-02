import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

async function ensureDirectory(path) {
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink() || !entry.isDirectory())
      throw Error(`Refusing a skill path that is not a directory: ${path}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(path);
  }
}

export async function installWatchSkill(cwd, env, userScope = false) {
  const root = userScope ? (env.HOME || homedir()) : cwd;
  const claude = join(root, ".claude");
  const skills = join(claude, "skills");
  const target = join(skills, "komo-watch");
  await ensureDirectory(root);
  await ensureDirectory(claude);
  await ensureDirectory(skills);
  try {
    await lstat(target);
    throw Error(`A komo-watch skill already exists at ${target}. Inspect it before making changes; setup never replaces it.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const source = new URL("../skills/komo-watch/SKILL.md", import.meta.url);
  const content = await readFile(source);
  await mkdir(target);
  await writeFile(join(target, "SKILL.md"), content, { flag: "wx" });
  return { path: target, scope: userScope ? "user" : "project" };
}
