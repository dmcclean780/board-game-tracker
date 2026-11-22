import { expect } from "@playwright/test";

const MAILPIT = "http://localhost:8025/api/v1";

/** Waits for a mail to `to` with `subject` and returns the first link in its body. */
export async function linkFromMail(to: string, subject: string): Promise<string> {
  let link = "";
  await expect(async () => {
    const q = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
    const { messages } = await (await fetch(`${MAILPIT}/search?query=${q}`)).json();
    expect(messages.length).toBeGreaterThan(0);
    const { Text } = await (await fetch(`${MAILPIT}/message/${messages[0].ID}`)).json();
    link = Text.match(/https?:\/\/\S+/)?.[0] ?? "";
    expect(link).not.toBe("");
  }).toPass({ timeout: 15_000 });
  return link;
}
