import { useState } from "react";
import { api, appOrigin, auth, useAuth } from "../../../auth";
import { Button, Field, Heading, Message, Screen } from "../../../components/ui";

export default function Account() {
  const { session, me, refreshMe } = useAuth();
  const [name, setName] = useState(me?.display_name ?? "");
  const [nameMsg, setNameMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const res = await api("/me", session!.access_token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name }) });
    if (!res.ok) return setNameMsg({ text: "Could not save the display name. Try again.", error: true });
    await refreshMe();
    setNameMsg({ text: "Display name saved." });
  }

  async function saveEmail() {
    const { error } = await auth.updateUser({ email }, { emailRedirectTo: appOrigin() });
    setEmailMsg(error ? { text: error.message, error: true } : { text: `Check ${email} to confirm the change.` });
  }

  async function deleteAccount() {
    const res = await api("/me", session!.access_token, { method: "DELETE" });
    if (res.ok) await auth.signOut();
    else setError("Could not delete the account. Try again.");
  }

  return (
    <Screen>
      <Heading text="Display name" />
      <Field label="Display name" autoCapitalize="words" value={name} onChangeText={setName} />
      <Message text={nameMsg?.text ?? null} error={nameMsg?.error} />
      <Button title="Save display name" onPress={saveName} disabled={!name.trim()} />
      <Heading text="Email" />
      <Message text={`Current email: ${me?.email}`} />
      <Field label="New email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Message text={emailMsg?.text ?? null} error={emailMsg?.error} />
      <Button title="Change email" onPress={saveEmail} disabled={!email.trim()} />
      <Heading text="Delete account" />
      {confirming ? (
        <>
          <Message text="Your account will be deleted in 30 days. Sign in before then to restore it." />
          <Button title="Confirm delete" onPress={deleteAccount} />
          <Button secondary title="Cancel" onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button secondary title="Delete account" onPress={() => setConfirming(true)} />
      )}
      <Message error text={error} />
    </Screen>
  );
}
