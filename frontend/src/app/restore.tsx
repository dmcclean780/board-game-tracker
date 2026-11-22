import { api, auth, useAuth } from "../auth";
import { Button, Message, Screen } from "../components/ui";

export default function Restore() {
  const { session, me, refreshMe } = useAuth();
  const date = new Date(me!.deletion_scheduled_for!).toLocaleDateString();

  async function restore() {
    await api("/me/restore", session!.access_token, { method: "POST" });
    await refreshMe();
  }

  return (
    <Screen title="Account scheduled for deletion">
      <Message text={`Your account will be permanently deleted on ${date}.`} />
      <Button title="Restore account" onPress={restore} />
      <Button secondary title="Sign out" onPress={() => auth.signOut()} />
    </Screen>
  );
}
