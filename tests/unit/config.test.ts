import { describe, expect, it } from "vitest";
import { loadConfig, requireDatabaseUrl } from "@/server/config/env";
import { ConfigError } from "@/server/errors";

describe("loadConfig", () => {
  it("reports nothing configured for an empty environment, without throwing", () => {
    const c = loadConfig({});
    expect(c.database.configured).toBe(false);
    expect(c.elevenlabs.configured).toBe(false);
    expect(c.elevenlabs.baseUrl).toBe("https://api.elevenlabs.io");
    expect(c.access.tokenConfigured).toBe(false);
    expect(c.issues).toEqual([]);
  });

  it("treats blank values as unset", () => {
    const c = loadConfig({ ELEVENLABS_API_KEY: "   ", DATABASE_URL: "" });
    expect(c.elevenlabs.configured).toBe(false);
    expect(c.database.configured).toBe(false);
  });

  it("reads configured values and strips a trailing slash from the base URL", () => {
    const c = loadConfig({
      DATABASE_URL: "postgresql://u:p@db:5432/x",
      ELEVENLABS_API_KEY: "k",
      ELEVENLABS_API_BASE_URL: "https://api.eu.residency.elevenlabs.io/",
      VOCAFORGE_ACCESS_TOKEN: "t",
    });
    expect(c.database.configured && c.elevenlabs.configured && c.access.tokenConfigured).toBe(true);
    expect(c.elevenlabs.baseUrl).toBe("https://api.eu.residency.elevenlabs.io");
  });

  it("flags invalid values without echoing them and keeps unrelated settings usable", () => {
    const c = loadConfig({ DATABASE_URL: "mysql://secret-user:secret-pass@h/db", ELEVENLABS_API_KEY: "k", ELEVENLABS_API_BASE_URL: "http://insecure" });
    expect(c.issues.map((i) => i.key).sort()).toEqual(["DATABASE_URL", "ELEVENLABS_API_BASE_URL"]);
    expect(JSON.stringify(c.issues)).not.toContain("secret-pass");
    expect(c.elevenlabs.configured).toBe(true);
    expect(c.database.configured).toBe(false);
  });

  it("configures Groq generation provider automatically when GROQ_API_KEY is provided", () => {
    const c = loadConfig({ GROQ_API_KEY: "gsk_test_key" });
    expect(c.generation.provider).toBe("groq");
    expect(c.generation.configured).toBe(true);
    expect(c.generation.apiKey).toBe("gsk_test_key");
    expect(c.generation.model).toBe("llama-3.3-70b-versatile");
    expect(c.generation.baseUrl).toBe("https://api.groq.com/openai");
  });
});

describe("requireDatabaseUrl", () => {
  it("throws a ConfigError when missing", () => {
    expect(() => requireDatabaseUrl(loadConfig({}))).toThrow(ConfigError);
  });
  it("returns the URL when valid", () => {
    expect(requireDatabaseUrl(loadConfig({ DATABASE_URL: "postgresql://a:b@h/d" }))).toBe("postgresql://a:b@h/d");
  });
});
