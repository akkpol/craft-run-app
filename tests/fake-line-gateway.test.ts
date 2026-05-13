import { describe, expect, it } from "vitest";

import { createFakeLineGateway } from "@/lib/fake-line-gateway";

describe("FakeLineGateway", () => {
  it("records reply, push, and profile calls", async () => {
    const gateway = createFakeLineGateway({
      defaultDisplayName: "ลูกค้าทดสอบ",
    });

    await gateway.replyMessage({
      replyToken: "reply-1",
      messages: [{ type: "text", text: "hello" }],
    });
    await gateway.pushMessage({
      to: "user-1",
      messages: [{ type: "text", text: "status" }],
    });
    const profile = await gateway.getProfile("user-1");

    expect(profile.displayName).toBe("ลูกค้าทดสอบ");
    expect(gateway.getReplyCalls()).toHaveLength(1);
    expect(gateway.getPushCalls()).toHaveLength(1);
    expect(gateway.getCalls()).toEqual([
      expect.objectContaining({ method: "replyMessage" }),
      expect.objectContaining({ method: "pushMessage" }),
      expect.objectContaining({ method: "getProfile", userId: "user-1" }),
    ]);
  });

  it("can simulate transport failures", async () => {
    const gateway = createFakeLineGateway({
      failPushMessage: "push failed",
    });

    await expect(
      gateway.pushMessage({
        to: "user-1",
        messages: [{ type: "text", text: "status" }],
      })
    ).rejects.toThrow("push failed");
  });
});