import { useState } from "react";
import { auth, appOrigin } from "../auth";
import { Button, Field, Message, Screen, TextLink } from "../components/ui";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signUp() {
    setError(null);
    if (!name.trim()) return setError("Enter a display name");
    const { error } = await auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: appOrigin() } });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <Screen title="Check your email">
        <Message text={`We sent a verification link to ${email}. Open it to finish creating your account.`} />
        <TextLink href="/login">Back to sign in</TextLink>
      </Screen>
    );
  }
  return (
    <Screen title="Create an account">
      <Field label="Display name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Message error text={error} />
      <Button title="Create account" onPress={signUp} />
      <TextLink href="/login">Already have an account? Sign in</TextLink>
    </Screen>
  );
}
