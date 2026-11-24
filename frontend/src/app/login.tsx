import { useState } from "react";
import { auth, appOrigin } from "../auth";
import { Button, Field, Message, Screen, TextLink } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const { error } = await auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }
  async function google() {
    const { error } = await auth.signInWithOAuth({ provider: "google", options: { redirectTo: appOrigin() } });
    if (error) setError(error.message);
  }

  return (
    <Screen title="Sign in">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Message error text={error} />
      <Button title="Sign in" onPress={signIn} />
      <Button secondary title="Sign in with Google" onPress={google} />
      <TextLink href="/forgot-password">Forgot password?</TextLink>
      <TextLink href="/sign-up">Create an account</TextLink>
    </Screen>
  );
}
