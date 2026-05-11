import { describe, expect, it, vi } from "vitest";
import { PushClient, EXPO_BATCH_SIZE } from "./push.client";

function makeExpoStub(overrides: any = {}) {
  return {
    sendPushNotificationsAsync: overrides.sendPushNotificationsAsync ?? vi.fn().mockResolvedValue([]),
    isExpoPushToken: overrides.isExpoPushToken ?? vi.fn().mockReturnValue(true),
    chunkPushNotifications: (msgs: unknown[]) => [msgs],
  } as any;
}

describe("PushClient.sendBatch", () => {
  it("returns empty tickets when no tokens provided", async () => {
    const expo = makeExpoStub();
    const client = new PushClient(expo);
    const tickets = await client.sendBatch([], { title: "x", body: "y" });
    expect(tickets).toEqual([]);
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("calls Expo with a properly shaped message per token", async () => {
    const sendMock = vi.fn().mockResolvedValue([{ status: "ok", id: "t1" }]);
    const expo = makeExpoStub({ sendPushNotificationsAsync: sendMock });
    const client = new PushClient(expo);
    await client.sendBatch(["ExponentPushToken[a]", "ExponentPushToken[b]"], {
      title: "T",
      body: "B",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const messages = sendMock.mock.calls[0]?.[0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "T", body: "B" });
  });

  it("filters out invalid tokens via isExpoPushToken", async () => {
    const expo = makeExpoStub({
      isExpoPushToken: vi.fn((t: string) => t.startsWith("ExponentPushToken")),
    });
    const client = new PushClient(expo);
    await client.sendBatch(["ExponentPushToken[a]", "bogus"], { title: "T", body: "B" });
    const messages = expo.sendPushNotificationsAsync.mock.calls[0]?.[0];
    expect(messages).toHaveLength(1);
  });
});

describe("PushClient.pruneTokensFromTickets", () => {
  it("returns tokens whose ticket has DeviceNotRegistered detail", () => {
    const client = new PushClient(makeExpoStub());
    const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
    const tickets = [
      { status: "ok", id: "t1" },
      { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
    ];
    const pruned = client.pruneTokensFromTickets(tokens, tickets as any);
    expect(pruned).toEqual(["ExponentPushToken[b]"]);
  });
});

describe("constants", () => {
  it("EXPO_BATCH_SIZE is 100", () => {
    expect(EXPO_BATCH_SIZE).toBe(100);
  });
});
