import { useState } from "react";
import { auth, appOrigin } from "../auth";
import { Button, Field, Message, Screen, TextLink } from "../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setError(null);
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/reset-password` });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <Screen title="Reset your password">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Message error text={error} />
      <Message text={sent ? "If that email has an account, a reset link is on its way." : null} />
      <Button title="Send reset link" onPress={send} />
      <TextLink href="/login">Back to sign in</TextLink>
    </Screen>
  );
}
