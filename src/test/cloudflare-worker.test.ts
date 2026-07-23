import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../../public/_worker.js";

function environment(assetResponse = new Response("spa")) {
  return {
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(assetResponse),
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cloudflare social metadata worker", () => {
  it("leaves normal browser navigation on the existing SPA", async () => {
    const env = environment();
    const request = new Request("https://app.commandeici.com/demo", {
      headers: { "user-agent": "Mozilla/5.0" },
    });

    const response = await worker.fetch(request, env);

    expect(await response.text()).toBe("spa");
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
  });

  it("does not intercept reserved application routes", async () => {
    const env = environment();
    const request = new Request("https://app.commandeici.com/admin/demo", {
      headers: { "user-agent": "Twitterbot/1.0" },
    });

    await worker.fetch(request, env);

    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
  });

  it("serves restaurant metadata as HTML to social crawlers", async () => {
    const env = environment();
    const upstreamFetch = vi.fn().mockResolvedValue(new Response("<title>Antalya</title>", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await worker.fetch(new Request(
      "https://app.commandeici.com/moneteau-antalya-kebab",
      { headers: { "user-agent": "facebookexternalhit/1.1" } },
    ), env);

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("vary")).toBe("User-Agent");
    expect(await response.text()).toContain("Antalya");
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("slug=moneteau-antalya-kebab"),
      { redirect: "manual" },
    );
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the SPA for an unknown restaurant", async () => {
    const env = environment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://app.commandeici.com/unknown" },
    })));

    const request = new Request("https://app.commandeici.com/unknown", {
      headers: { "user-agent": "Slackbot-LinkExpanding 1.0" },
    });
    const response = await worker.fetch(request, env);

    expect(await response.text()).toBe("spa");
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
  });
});
