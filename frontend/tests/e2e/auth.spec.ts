import { expect, Page, test } from "@playwright/test";
import { linkFromMail } from "./mail";

const PASSWORD = "correct-horse-9";
const uniqueEmail = () => `ada+${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUpAndVerify(page: Page, email: string, name = "Ada") {
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  // The verification link signs the user in on return.
  await page.goto(await linkFromMail(email, "Confirm Your Email"));
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("signed-out visitors land on the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("sign up, verify email, sign out and sign back in", async ({ page }) => {
  const email = uniqueEmail();
  await signUpAndVerify(page, email);
  await signOut(page);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});

test("unverified email cannot sign in", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("Ada");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await page.goto("/login");
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("Email not confirmed");
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, uniqueEmail());
  await expect(page.getByRole("alert")).toBeVisible();
});

test("reset a forgotten password", async ({ page }) => {
  const email = uniqueEmail();
  await signUpAndVerify(page, email);
  await signOut(page);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  // The stack keeps the login screen mounted underneath, so pick the visible field.
  await page.getByLabel("Email").locator("visible=true").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/reset link is on its way/)).toBeVisible();
  await page.goto(await linkFromMail(email, "Reset Your Password"));
  await page.getByLabel("New password").fill("a-brand-new-pass-1");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await signOut(page);
  await signIn(page, email, "a-brand-new-pass-1");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});

test("delete the account, then restore it on next sign-in", async ({ page }) => {
  const email = uniqueEmail();
  await signUpAndVerify(page, email);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Account scheduled for deletion" })).toBeVisible();
  await page.getByRole("button", { name: "Restore account" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});

test("change the display name on the account screen", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Display name").fill("Grace");
  await page.getByRole("button", { name: "Save display name" }).click();
  await expect(page.getByText("Display name saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "User menu" })).toContainText("Grace");
});

test("the theme choice on the appearance tab is kept after reload", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
});

const next = (page: Page) => page.getByRole("button", { name: "Next" }).click();

test("record a Root session, view it and delete it", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await expect(page.getByText("No sessions yet.")).toBeVisible();
  await page.getByRole("button", { name: "Record session" }).click();
  await page.getByLabel("Game").selectOption("root");
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();
  await page.getByLabel("Map").selectOption("marsh");
  await page.getByLabel("Deck").selectOption("exiles_and_partisans");
  await page.getByLabel("Mousehold").click();
  await next(page);
  await page.getByLabel("Player 1 name").fill("Ada");
  await page.getByLabel("Player 1 score").fill("30");
  await page.getByLabel("Player 1 won").click();
  await page.getByLabel("Player 2 name").fill("Bo");
  await next(page);
  await expect(page.getByText("Players: Ada, Bo")).toBeVisible();
  await page.getByLabel("Notes (optional)").fill("Close game");
  await page.getByRole("button", { name: "Save session" }).click();
  await page.getByText(/· Root · Won by Ada/).click();
  await expect(page.getByText("Marsh map · Exiles and Partisans deck")).toBeVisible();
  await expect(page.getByText("Landmarks: Mousehold")).toBeVisible();
  await expect(page.getByText("30 Points victory")).toBeVisible();
  await expect(page.getByText("Close game")).toBeVisible();
  await page.getByRole("button", { name: "Delete session" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("No sessions yet.")).toBeVisible();
});

test("a Vagabond coalition wins with its partner", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await page.getByRole("button", { name: "Record session" }).click();
  await page.getByLabel("Game").selectOption("root");
  await next(page);
  await page.getByLabel("Dominance").click();
  await next(page);
  await page.getByLabel("Player 1 name").fill("Ada");
  await page.getByLabel("Player 2 name").fill("Bo");
  await page.getByLabel("Player 2 faction").selectOption("vagabond");
  await page.getByLabel("Player 2 coalition with").selectOption({ label: "Ada" });
  await page.getByLabel("Player 1 won").click();
  await expect(page.getByLabel("Player 2 won (with Ada)")).toBeDisabled();
  await next(page);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByText(/· Root · Won by Ada, Bo/)).toBeVisible();
});

test("a faction another player holds cannot be picked", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await page.getByRole("button", { name: "Record session" }).click();
  await page.getByLabel("Game").selectOption("root");
  await next(page);
  await next(page);
  await expect(page.getByLabel("Player 2 faction").locator("option", { hasText: "Marquise de Cat (taken)" })).toBeDisabled();
  await expect(page.getByLabel("Player 2 faction").locator("option", { hasText: /^Vagabond$/ })).toBeEnabled();
});

test("the form explains what is wrong and blocks going on until it is fixed", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail());
  await page.getByRole("button", { name: "Record session" }).click();
  await page.getByLabel("Game").selectOption("root");
  await next(page);
  await next(page);
  await page.getByLabel("Player 1 name").fill("Ada");
  await page.getByLabel("Player 2 name").fill("Bo");
  await expect(page.getByText("exactly one player must win")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.getByLabel("Player 1 won").click();
  await expect(page.getByText(/at least 30 points/)).toBeVisible();
  await page.getByLabel("Player 2 won").click(); // only one player can have won
  await expect(page.getByLabel("Player 1 won")).not.toBeChecked();
  await page.getByLabel("Player 2 score").fill("30");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  await page.getByLabel("Player 2 faction").selectOption("vagabond");
  await expect(page.getByLabel("Player 2 coalition with")).toBeVisible(); // in a points victory too
  await page.getByRole("button", { name: "Back" }).click(); // the setup is kept when moving between steps
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByLabel("Player 1 name")).toHaveValue("Ada");
});
