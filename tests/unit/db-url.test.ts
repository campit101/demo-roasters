import { describe, expect, it } from "vitest";
import { withVerifiedTls } from "@/db/url";

describe("withVerifiedTls", () => {
  it("upgrades sslmode=require to verify-full and keeps everything else", () => {
    const out = new URL(withVerifiedTls("postgresql://u:p@ep-x.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"));
    expect(out.searchParams.get("sslmode")).toBe("verify-full");
    expect(out.searchParams.get("channel_binding")).toBe("require");
    expect(out.hostname).toBe("ep-x.c-2.eu-west-2.aws.neon.tech");
    expect(out.password).toBe("p");
  });

  it("adds verify-full when no sslmode is given", () => {
    expect(new URL(withVerifiedTls("postgresql://u:p@h/db")).searchParams.get("sslmode")).toBe("verify-full");
  });
});
