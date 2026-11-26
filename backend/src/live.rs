//! Live updates: `GET /ws` tells a signed-in User's open tabs that something they show has changed.
//! The messages carry no data (`{"type":"friends"}`, `{"type":"me"}`); the tab refetches over HTTP.
use crate::auth::{verify, AppState, AuthUser};
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use chrono::Utc;
use serde::Deserialize;
use sqlx::{postgres::PgListener, PgPool};
use std::{collections::HashMap, sync::{Arc, Mutex}, time::Duration};
use tokio::sync::mpsc;
use uuid::Uuid;

/// How long a new socket may stay silent before it is closed; its first message must be the access token.
const FIRST_MESSAGE: Duration = Duration::from_secs(5);

/// The open sockets of this backend instance, by User.
#[derive(Clone, Default)]
pub struct Hub(Arc<Mutex<HashMap<Uuid, Vec<mpsc::UnboundedSender<String>>>>>);

#[derive(Deserialize)]
struct Event {
    user: Uuid,
    #[serde(rename = "type")]
    kind: String,
}

impl Hub {
    /// Starts listening to the database's `bgt_events` channel and relaying it to the sockets.
    /// Returns once the listener is attached, so no change after this point is missed.
    pub async fn start(db: &PgPool) -> Result<Hub, sqlx::Error> {
        let mut listener = PgListener::connect_with(db).await?;
        listener.listen("bgt_events").await?;
        let hub = Hub::default();
        let relay = hub.clone();
        tokio::spawn(async move {
            loop {
                match listener.recv().await {
                    Ok(n) => {
                        if let Ok(e) = serde_json::from_str::<Event>(n.payload()) {
                            relay.send(e.user, &e.kind);
                        }
                    }
                    // The listener reconnects by itself on the next call; wait a moment so a dead database is not spun on.
                    Err(e) => {
                        eprintln!("live: {e}");
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        });
        Ok(hub)
    }

    fn subscribe(&self, user: Uuid) -> mpsc::UnboundedReceiver<String> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.0.lock().unwrap().entry(user).or_default().push(tx);
        rx
    }

    /// Tells every open socket of `user`; sockets that have closed are dropped here.
    fn send(&self, user: Uuid, kind: &str) {
        let mut sockets = self.0.lock().unwrap();
        if let Some(txs) = sockets.get_mut(&user) {
            txs.retain(|tx| tx.send(kind.to_owned()).is_ok());
            if txs.is_empty() {
                sockets.remove(&user);
            }
        }
    }
}

/// Upgrade to a WebSocket. Not in OpenAPI, which cannot describe it.
pub async fn ws(State(s): State<AppState>, up: WebSocketUpgrade) -> Response {
    up.on_upgrade(move |mut socket| async move {
        run(&mut socket, &s).await;
        let _ = socket.send(Message::Close(None)).await;
    })
}

async fn authenticate(socket: &mut WebSocket, s: &AppState) -> Option<(AuthUser, u64)> {
    let first = tokio::time::timeout(FIRST_MESSAGE, socket.recv()).await.ok()??.ok()?;
    match first {
        Message::Text(token) => verify(token.as_str(), &s.auth).ok(),
        _ => None,
    }
}

/// Serves one socket until it closes, errors, or its token expires.
async fn run(socket: &mut WebSocket, s: &AppState) {
    let Some((user, exp)) = authenticate(socket, s).await else { return };
    let mut events = s.hub.subscribe(user.id);
    // Tell the tab it is subscribed: it refetches now, so a change made just before is not missed.
    if socket.send(message("ready")).await.is_err() {
        return;
    }
    let expiry = tokio::time::sleep(Duration::from_secs((exp as i64 - Utc::now().timestamp()).max(0) as u64));
    tokio::pin!(expiry);
    loop {
        tokio::select! {
            Some(kind) = events.recv() => {
                if socket.send(message(&kind)).await.is_err() {
                    return;
                }
            }
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => return,
                Some(Ok(_)) => {}
            },
            _ = &mut expiry => return,
        }
    }
}

fn message(kind: &str) -> Message {
    Message::text(format!(r#"{{"type":"{kind}"}}"#))
}
