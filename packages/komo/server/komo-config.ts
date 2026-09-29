import type { KomoServerConfig } from "../src/server-config.js";
import { sitePattern } from "./validation";

function configObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function configError(field: string): never {
  throw new Error(`Invalid komo backend config: ${field}`);
}

/** Validate backend policy before serving requests; never include values in errors. */
export function validateKomoServerConfig(
  value: unknown,
): asserts value is KomoServerConfig {
  if (!configObject(value)) configError("expected a default-exported object");
  const fields = [
    "projects",
    "googleClientId",
    "githubClientId",
    "publicUrl",
    "port",
    "proxyHops",
  ];
  if (Object.keys(value).some((key) => !fields.includes(key)))
    configError("unknown setting; secrets must use environment variables");
  if (!configObject(value.projects)) configError("projects must be an object");
  for (const [key, project] of Object.entries(value.projects)) {
    if (
      !key.trim() ||
      key.trim() !== key ||
      key.length > 100 ||
      key === "_komo" ||
      ["__proto__", "constructor", "prototype"].includes(key)
    )
      configError("invalid or reserved project key");
    if (!configObject(project)) configError("project must be an object");
    const projectFields = [
      "repo",
      "origins",
      "allowGuests",
      "allowGuestResolve",
      "requireOwner",
      "bootstrapHash",
      "suspended",
      "writesPerDay",
      "retainedCommentsPerUser",
    ];
    if (Object.keys(project).some((field) => !projectFields.includes(field)))
      configError("unknown project setting");
    if (
      typeof project.repo !== "string" ||
      !project.repo.trim() ||
      project.repo.length > 200
    )
      configError("project.repo must be a nonempty repository name");
    if (!Array.isArray(project.origins))
      configError("project.origins must be an array");
    for (const origin of project.origins) {
      if (origin === "http://localhost:*" || origin === "http://127.0.0.1:*")
        continue;
      try {
        if (sitePattern(origin) !== origin)
          configError("project.origins must contain canonical site origins");
      } catch {
        configError(
          "project.origins must contain HTTPS sites or local development origins",
        );
      }
    }
    for (const field of [
      "allowGuests",
      "allowGuestResolve",
      "requireOwner",
      "suspended",
    ])
      if (project[field] !== undefined && typeof project[field] !== "boolean")
        configError(`project.${field} must be a boolean`);
    for (const field of ["writesPerDay", "retainedCommentsPerUser"])
      if (
        project[field] !== undefined &&
        (!Number.isSafeInteger(project[field]) || Number(project[field]) < 0)
      )
        configError(`project.${field} must be a nonnegative integer`);
    if (
      project.bootstrapHash !== undefined &&
      (typeof project.bootstrapHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(project.bootstrapHash))
    )
      configError("project.bootstrapHash must be a SHA-256 hash");
  }
  for (const field of ["googleClientId", "githubClientId"])
    if (value[field] !== undefined && typeof value[field] !== "string")
      configError(`${field} must be a string`);
  if (value.publicUrl !== undefined) {
    try {
      if (typeof value.publicUrl !== "string") configError("publicUrl");
      const url = new URL(value.publicUrl);
      if (
        url.origin !== value.publicUrl ||
        (url.protocol !== "https:" &&
          !(
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname)
          ))
      )
        configError("publicUrl");
    } catch {
      configError("publicUrl must be an HTTPS origin or HTTP localhost");
    }
  }
  if (
    value.port !== undefined &&
    (!Number.isInteger(value.port) ||
      Number(value.port) < 1 ||
      Number(value.port) > 65535)
  )
    configError("port must be an integer from 1 to 65535");
  if (
    value.proxyHops !== undefined &&
    (!Number.isInteger(value.proxyHops) ||
      Number(value.proxyHops) < 0 ||
      Number(value.proxyHops) > 8)
  )
    configError("proxyHops must be an integer from 0 to 8");
}

/** Serialize validated backend projects and public provider defaults for Worker bindings. */
export function komoConfigEnvironment(config: KomoServerConfig) {
  validateKomoServerConfig(config);
  return {
    PROJECTS: JSON.stringify(config.projects),
    GOOGLE_CLIENT_ID: config.googleClientId ?? "",
    GITHUB_CLIENT_ID: config.githubClientId ?? "",
  };
}
