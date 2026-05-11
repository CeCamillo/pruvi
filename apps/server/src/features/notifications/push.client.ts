import type { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import type { PushPayload } from "./templates";

export const EXPO_BATCH_SIZE = 100;

/**
 * Minimal Expo client interface to allow easy stubbing in tests.
 * The real expo-server-sdk Expo class satisfies this via static + instance methods,
 * but tests can inject a plain object with the same shape.
 */
interface ExpoLike {
  sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  isExpoPushToken(token: unknown): boolean;
}

export class PushClient {
  constructor(private expo: ExpoLike) {}

  async sendBatch(
    tokens: string[],
    payload: PushPayload,
    data?: Record<string, unknown>,
  ): Promise<ExpoPushTicket[]> {
    if (tokens.length === 0) return [];

    const valid = tokens.filter((t) => this.expo.isExpoPushToken(t));
    if (valid.length === 0) return [];

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data,
      sound: "default" as const,
    }));

    return this.expo.sendPushNotificationsAsync(messages);
  }

  pruneTokensFromTickets(tokens: string[], tickets: ExpoPushTicket[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];
      if (ticket && ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" && token) {
        out.push(token);
      }
    }
    return out;
  }
}
