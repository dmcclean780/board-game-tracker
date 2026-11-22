import { useState } from "react";
import { api, auth, useAuth } from "../auth";
import { Button, Message, Screen } from "../components/ui";

export default function Home() {
  const { session, me } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    const res = await api("/me", session!.access_token, { method: "DELETE" });
    if (res.ok) await auth.signOut();
    else setError("Could not delete the account. Try again.");
  }

  return (
    <Screen title={`Hi, ${me?.display_name}`}>
      <Message text="No games yet." />
      <Button secondary title="Sign out" onPress={() => auth.signOut()} />
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
