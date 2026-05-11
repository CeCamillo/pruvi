import { randomInt } from "node:crypto";

export const INVITE_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return out;
}
