import { Fragment, useCallback, useEffect, useState } from "react";
import { api, useAuth } from "../../auth";
import { Button, Field, Heading, Message, Screen, Text } from "../../components/ui";

type Friend = { id: string; display_name: string };

export default function Friends() {
  const { session, me, refreshMe } = useAuth();
  const token = session!.access_token;
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [newCode, setNewCode] = useState(false);
  const [removing, setRemoving] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    const res = await api("/friends", token);
    if (res.ok) setFriends(await res.json());
    else setMsg({ text: "Could not load your friends. Try again.", error: true });
  }, [token]);
  useEffect(() => void load(), [load]);

  async function add() {
    const res = await api("/friends", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return setMsg({ text: res.status === 422 ? await res.text() : "Could not add the friend. Try again.", error: true });
    setCode("");
    setMsg(null);
    await load();
  }

  async function remove(f: Friend) {
    const res = await api(`/friends/${f.id}`, token, { method: "DELETE" });
    setRemoving(null);
    if (res.ok || res.status === 404) await load();
    else setMsg({ text: "Could not remove the friend. Try again.", error: true });
  }

  async function regenerate() {
    const res = await api("/me/friend-code", token, { method: "POST" });
    setNewCode(false);
    if (res.ok) await refreshMe();
    else setMsg({ text: "Could not make a new code. Try again.", error: true });
  }

  const mine = me?.friend_code ?? "";
  const shown = `${mine.slice(0, 4)}-${mine.slice(4)}`;
  return (
    <Screen>
      <Heading text="Your friend code" />
      <Text style={{ fontSize: 24, fontWeight: "600" }} selectable>{shown}</Text>
      <Button secondary title="Copy" onPress={() => void navigator.clipboard?.writeText(shown)} />
      {newCode ? (
        <>
          <Message text="Your old code will stop working. Your friends stay." />
          <Button title="Confirm new code" onPress={regenerate} />
          <Button secondary title="Cancel" onPress={() => setNewCode(false)} />
        </>
      ) : (
        <Button secondary title="New code" onPress={() => setNewCode(true)} />
      )}
      <Heading text="Add a friend" />
      <Field label="Friend code" autoCapitalize="characters" value={code} onChangeText={setCode} />
      <Message text={msg?.text ?? null} error={msg?.error} />
      <Button title="Add friend" onPress={add} disabled={!code.trim()} />
      <Heading text="Friends" />
      {friends?.length === 0 && <Message text="No friends yet. Share your friend code or enter a friend's code above." />}
      {friends?.map((f) => (
        <Fragment key={f.id}>
          <Text>{f.display_name}</Text>
          {removing?.id === f.id ? (
            <>
              <Message text={`Remove ${f.display_name}? You will no longer be friends with each other.`} />
              <Button title="Confirm remove" onPress={() => remove(f)} />
              <Button secondary title="Cancel" onPress={() => setRemoving(null)} />
            </>
          ) : (
            <Button secondary title="Remove" onPress={() => setRemoving(f)} />
          )}
        </Fragment>
      ))}
    </Screen>
  );
}
