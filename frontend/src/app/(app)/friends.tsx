import { useFocusEffect } from "expo-router";
import { Fragment, useCallback, useState } from "react";
import { View } from "react-native";
import { api, useAuth } from "../../auth";
import { Button, Field, Message, Popup, Screen, Text } from "../../components/ui";
import { useLive } from "../../live";

type Friend = { id: string; display_name: string };

export default function Friends() {
  const { session, me, refreshMe } = useAuth();
  const token = session!.access_token;
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Friend | null>(null);
  // "Show code" popup
  const [showCode, setShowCode] = useState(false);
  const [newCode, setNewCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // "Add friend" popup
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api("/friends", token);
    if (res.ok) {
      setFriends(await res.json());
      setError(null);
    } else setError("Could not load your friends. Try again.");
  }, [token]);
  // On arriving at the screen, and whenever the server says the list changed (also on every socket connect).
  useFocusEffect(useCallback(() => void load(), [load]));
  useLive("friends", load);

  async function add() {
    const res = await api("/friends", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return setAddError(res.status === 422 ? await res.text() : "Could not add the friend. Try again.");
    closeAdd();
    await load();
  }

  function closeAdd() {
    setAdding(false);
    setCode("");
    setAddError(null);
  }

  async function remove(f: Friend) {
    const res = await api(`/friends/${f.id}`, token, { method: "DELETE" });
    setRemoving(null);
    if (res.ok || res.status === 404) await load();
    else setError("Could not remove the friend. Try again.");
  }

  async function regenerate() {
    const res = await api("/me/friend-code", token, { method: "POST" });
    setNewCode(false);
    if (res.ok) {
      await refreshMe();
      setCodeMsg(null);
    } else setCodeMsg({ text: "Could not make a new code. Try again.", error: true });
  }

  const mine = me?.friend_code ?? "";
  const shown = `${mine.slice(0, 4)}-${mine.slice(4)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      setCodeMsg({ text: "Copied." });
    } catch {
      setCodeMsg({ text: "Could not copy the code.", error: true });
    }
  }

  function closeCode() {
    setShowCode(false);
    setNewCode(false);
    setCodeMsg(null);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Button title="Show code" onPress={() => setShowCode(true)} /></View>
        <View style={{ flex: 1 }}><Button secondary title="Add friend" onPress={() => setAdding(true)} /></View>
      </View>
      <Message error text={error} />
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

      <Popup title="Your friend code" visible={showCode} onClose={closeCode}>
        <Text style={{ fontSize: 24, fontWeight: "600" }} selectable>{shown}</Text>
        <Message text={codeMsg?.text ?? null} error={codeMsg?.error} />
        {newCode ? (
          <>
            <Message text="Your old code will stop working. Your friends stay." />
            <Button title="Confirm new code" onPress={regenerate} />
            <Button secondary title="Cancel" onPress={() => setNewCode(false)} />
          </>
        ) : (
          <>
            <Button title="Copy" onPress={copy} />
            <Button secondary title="New code" onPress={() => setNewCode(true)} />
            <Button secondary title="Close" onPress={closeCode} />
          </>
        )}
      </Popup>

      <Popup title="Add a friend" visible={adding} onClose={closeAdd}>
        <Field label="Friend code" autoCapitalize="characters" value={code} onChangeText={setCode} />
        <Message error text={addError} />
        <Button title="Add" onPress={add} disabled={!code.trim()} />
        <Button secondary title="Cancel" onPress={closeAdd} />
      </Popup>
    </Screen>
  );
}
