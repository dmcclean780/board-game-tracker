import { router } from "expo-router";
import { useState } from "react";
import { auth, useAuth } from "../auth";
import { Button, Field, Message, Screen } from "../components/ui";

export default function ResetPassword() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const { error } = await auth.updateUser({ password });
    if (error) setError(error.message);
    else router.replace("/");
  }

  if (!session) return <Screen title="Reset your password"><Message error text="This reset link is invalid or has expired." /></Screen>;
  return (
    <Screen title="Choose a new password">
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Message error text={error} />
      <Button title="Save password" onPress={save} />
    </Screen>
  );
}
