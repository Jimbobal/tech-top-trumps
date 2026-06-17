"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cardFromId,
  chooseStatForState,
  continueState,
  createGameState,
  getWinner,
  isGameOver,
  playerName,
  type GameState,
  type PlayerId,
} from "@/lib/gameEngine";
import { TitanCard } from "@/components/TitanCard";
import { statKeys, statLabels, type StatKey } from "@/lib/techTitansDeck";

type RoomPayload = {
  id: string;
  role: PlayerId | null;
  state: GameState;
  playerCount: number;
};

type RoomResponse = {
  token?: string;
  room: RoomPayload;
};

function opponent(player: PlayerId): PlayerId {
  return player === "p1" ? "p2" : "p1";
}

function storageKey(roomId: string) {
  return `project-flux-room-${roomId}`;
}

export function GameBoard() {
  const initialState = useMemo(() => createGameState(), []);
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [logoMissing, setLogoMissing] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<PlayerId | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [onlineStatus, setOnlineStatus] = useState("Local pass-and-play mode.");

  const online = Boolean(roomId);
  const winner = getWinner(gameState);
  const gameOver = isGameOver(gameState);
  const viewerPlayer = onlineRole ?? gameState.activePlayer;
  const opponentPlayer = opponent(viewerPlayer);
  const viewerDeck = viewerPlayer === "p1" ? gameState.p1Deck : gameState.p2Deck;
  const opponentDeck = opponentPlayer === "p1" ? gameState.p1Deck : gameState.p2Deck;
  const activeDeck = gameState.activePlayer === "p1" ? gameState.p1Deck : gameState.p2Deck;
  const viewerCard = cardFromId(viewerDeck[0]);
  const opponentCard = cardFromId(opponentDeck[0]);
  const activeCard = cardFromId(activeDeck[0]);
  const canChoose = !gameOver && !gameState.selectedStat && (!online || onlineRole === gameState.activePlayer);
  const shareUrl = roomId && typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}` : "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRoom = params.get("room");
    if (requestedRoom) {
      void joinOnlineRoom(requestedRoom.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roomId || !playerToken) return;

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/rooms/${roomId}`, {
        headers: { "x-player-token": playerToken },
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = (await response.json()) as { room: RoomPayload };
      setGameState(payload.room.state);
      setOnlineRole(payload.room.role);
      setPlayerCount(payload.room.playerCount);
    }, 1200);

    return () => window.clearInterval(interval);
  }, [playerToken, roomId]);

  async function syncRoomAction(action: { type: "choose"; stat: StatKey } | { type: "next" } | { type: "reset" }) {
    if (!roomId || !playerToken) return;
    const response = await fetch(`/api/rooms/${roomId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: playerToken, ...action }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { room: RoomPayload };
    setGameState(payload.room.state);
    setOnlineRole(payload.room.role);
    setPlayerCount(payload.room.playerCount);
  }

  async function createOnlineRoom() {
    setOnlineStatus("Creating online room...");
    const response = await fetch("/api/rooms", { method: "POST" });
    const payload = (await response.json()) as RoomResponse;
    setRoomId(payload.room.id);
    setPlayerToken(payload.token ?? null);
    setOnlineRole(payload.room.role);
    setPlayerCount(payload.room.playerCount);
    setGameState(payload.room.state);
    window.localStorage.setItem(storageKey(payload.room.id), payload.token ?? "");
    window.history.replaceState(null, "", `?room=${payload.room.id}`);
    setOnlineStatus("Room created. Send the link to Player 2.");
  }

  async function joinOnlineRoom(id: string) {
    const existingToken = window.localStorage.getItem(storageKey(id)) ?? undefined;
    setOnlineStatus("Joining online room...");
    const response = await fetch(`/api/rooms/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "join", token: existingToken }),
    });
    if (!response.ok) {
      setOnlineStatus("Room not found. Ask Player 1 for a fresh link.");
      return;
    }
    const payload = (await response.json()) as RoomResponse;
    setRoomId(payload.room.id);
    setPlayerToken(payload.token ?? existingToken ?? null);
    setOnlineRole(payload.room.role);
    setPlayerCount(payload.room.playerCount);
    setGameState(payload.room.state);
    if (payload.token) window.localStorage.setItem(storageKey(payload.room.id), payload.token);
    window.history.replaceState(null, "", `?room=${payload.room.id}`);
    setOnlineStatus(payload.room.role ? `Joined as ${playerName(payload.room.role)}.` : "Room is full. Watching as spectator.");
  }

  function leaveOnlineRoom() {
    setRoomId(null);
    setPlayerToken(null);
    setOnlineRole(null);
    setPlayerCount(0);
    setGameState(createGameState());
    window.history.replaceState(null, "", window.location.pathname);
    setOnlineStatus("Local pass-and-play mode.");
  }

  function chooseStat(stat: StatKey) {
    if (!canChoose) return;
    if (online) {
      void syncRoomAction({ type: "choose", stat });
      return;
    }
    setGameState((state) => chooseStatForState(state, stat));
  }

  function continueRound() {
    if (online) {
      void syncRoomAction({ type: "next" });
      return;
    }
    setGameState((state) => continueState(state));
  }

  function resetGame() {
    if (online) {
      void syncRoomAction({ type: "reset" });
      return;
    }
    setGameState(createGameState());
  }

  return (
    <main className="arena-shell">
      <section className="hero">
        <div className="brand-lockup">
          {!logoMissing ? (
            <img
              src="/project-flux-logo.png"
              alt="Project Flux"
              onError={() => {
                setLogoMissing(true);
              }}
            />
          ) : (
            <div className="fallback-logo" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          <div>
            <p>Project Flux Presents</p>
            <h1>Tech Titans Arena</h1>
          </div>
        </div>
        <div className="arena-status">
          <div>
            <span>Player 1</span>
            <strong>{gameState.p1Deck.length}</strong>
          </div>
          <div>
            <span>Pending Pot</span>
            <strong>{gameState.pendingPot.length}</strong>
          </div>
          <div>
            <span>Player 2</span>
            <strong>{gameState.p2Deck.length}</strong>
          </div>
        </div>
      </section>

      <section className="online-panel">
        <div>
          <span className="console-label">Internet Play</span>
          <h2>{online ? `Room ${roomId}` : "Play locally or create an online room"}</h2>
          <p>
            {online
              ? `${onlineStatus} ${playerCount}/2 players connected.`
              : "Create a room, send the link, and both players will share the same server-side game state."}
          </p>
        </div>
        <div className="online-actions">
          {online ? (
            <>
              <input readOnly value={shareUrl} aria-label="Room share link" />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(shareUrl);
                  setOnlineStatus("Room link copied.");
                }}
              >
                Copy Link
              </button>
              <button type="button" onClick={leaveOnlineRoom}>
                Leave Room
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void createOnlineRoom()}>
              Create Online Room
            </button>
          )}
        </div>
      </section>

      <section className="match-panel">
        <div className="round-console">
          <div>
            <span className="console-label">{online ? "Online Turn" : "Active Selector"}</span>
            <h2>
              {gameOver && winner
                ? `${playerName(winner)} wins the arena`
                : online && onlineRole
                  ? onlineRole === gameState.activePlayer
                    ? "Your turn to choose"
                    : `${playerName(gameState.activePlayer)} is choosing`
                  : `${playerName(gameState.activePlayer)} choose a stat`}
            </h2>
            <p>{gameOver && winner ? "All cards have been captured. Shuffle again to start a new match." : gameState.roundResult.body}</p>
          </div>
          <div className={`result-pill ${gameState.roundResult.tone}`}>{gameOver && winner ? "Game Over" : gameState.roundResult.title}</div>
        </div>

        <div className="battle-grid">
          <div className="player-column">
            <div className="column-header">
              <span>{online && onlineRole ? `You are ${playerName(onlineRole)}` : playerName(gameState.activePlayer)}</span>
              <strong>{online ? "Your Card" : "Current Card"}</strong>
            </div>
            <TitanCard card={viewerCard} selectedStat={gameState.selectedStat} />
          </div>

          <div className="selector-column">
            <div className="category-panel">
              <span className="console-label">Category Matrix</span>
              <div className="stat-buttons">
                {statKeys.map((stat) => (
                  <button
                    className={gameState.selectedStat === stat ? "active" : ""}
                    disabled={!activeCard || !canChoose}
                    key={stat}
                    onClick={() => chooseStat(stat)}
                    type="button"
                  >
                    <span>{statLabels[stat]}</span>
                    <strong>{activeCard?.stats[stat] ?? "--"}</strong>
                  </button>
                ))}
              </div>
              <div className="controls">
                <button disabled={!gameState.selectedStat || gameOver} onClick={continueRound} type="button">
                  Next Card
                </button>
                <button onClick={resetGame} type="button">
                  Shuffle New Game
                </button>
              </div>
            </div>

            <div className="rules-panel">
              <h2>Rules</h2>
              <p>Shuffle 24 cards, deal 12 each, choose one stat, highest score takes both cards.</p>
              <p>Draws move both cards into the pending pot. The next winner captures the full pot.</p>
              <p>Online rooms work by sharing server state through the room link.</p>
            </div>
          </div>

          <div className="player-column">
            <div className="column-header">
              <span>{online ? playerName(opponentPlayer) : playerName(opponent(gameState.activePlayer))}</span>
              <strong>{gameState.revealed || gameOver ? "Revealed Card" : "Hidden Card"}</strong>
            </div>
            <TitanCard card={opponentCard} hidden={!gameState.revealed && !gameOver} selectedStat={gameState.selectedStat} />
          </div>
        </div>
      </section>
    </main>
  );
}
