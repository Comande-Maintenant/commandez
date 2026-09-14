import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  safeHttpUrl,
} from "../../supabase/functions/_shared/html";

describe("Edge Function HTML safety", () => {
  it("escapes markup and attribute delimiters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> &`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;",
    );
  });

  it("allows only HTTP(S) image URLs", () => {
    const fallback = "https://app.commandeici.com/images/covers/default.jpg";

    expect(safeHttpUrl("https://cdn.example.com/a.jpg", fallback)).toBe(
      "https://cdn.example.com/a.jpg",
    );
    expect(safeHttpUrl("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeHttpUrl(`https://cdn.example.com/" onerror="x`, fallback)).toBe(
      fallback,
    );
  });
});
