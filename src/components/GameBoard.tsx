"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  cardFromId,
  chooseStatForState,
  continueState,
  createGameState,
  getRoundCards,
  getWinner,
  isGameOver,
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
  players: Partial<Record<PlayerId, string>>;
};

type RoomResponse = {
  token?: string;
  room: RoomPayload;
};

function opponent(player: PlayerId): PlayerId {
  return player === "p1" ? "p2" : "p1";
}

function fallbackName(player: PlayerId) {
  return player === "p1" ? "Player 1" : "Player 2";
}

function storageKey(roomId: string) {
  return `project-flux-room-${roomId}`;
}

function cleanName(name: string) {
  return name.trim().slice(0, 24);
}

export function GameBoard() {
  const initialState = useMemo(() => createGameState(), []);
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [logoMissing, setLogoMissing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [setupError, setSetupError] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<PlayerId | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [roomPlayers, setRoomPlayers] = useState<Partial<Record<PlayerId, string>>>({});
  const [onlineStatus, setOnlineStatus] = useState("Enter your name to create or join a room.");
  const [localMode, setLocalMode] = useState(false);

  const online = Boolean(roomId);
  const gameVisible = online || localMode;
  const winner = getWinner(gameState);
  const gameOver = isGameOver(gameState);
  const localName = cleanName(nameInput) || "You";
  const playerNames: Record<PlayerId, string> = {
    p1: roomPlayers.p1 ?? localName,
    p2: roomPlayers.p2 ?? (online ? "Waiting for opponent" : "Guest"),
  };
  const viewerPlayer = online && onlineRole ? onlineRole : gameState.activePlayer;
  const opponentPlayer = opponent(viewerPlayer);
  const roundCards = getRoundCards(gameState);
  const viewerCard = cardFromId(roundCards[viewerPlayer] ?? undefined);
  const opponentCard = cardFromId(roundCards[opponentPlayer] ?? undefined);
  const activeCard = cardFromId(roundCards[gameState.activePlayer] ?? undefined);
  const canChoose = !gameOver && !gameState.selectedStat && (!online || onlineRole === gameState.activePlayer);
  const shareUrl = roomId && typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}` : "";
  const activeName = playerNames[gameState.activePlayer] || fallbackName(gameState.activePlayer);
  const opponentName = playerNames[opponentPlayer] || fallbackName(opponentPlayer);

  useEffect(() => {
    const savedName = window.localStorage.getItem("project-flux-player-name");
    if (savedName) setNameInput(savedName.slice(0, 24));

    const params = new URLSearchParams(window.location.search);
    const requestedRoom = params.get("room");
    if (requestedRoom) {
      setPendingRoomId(requestedRoom.toUpperCase());
      setOnlineStatus(`Enter your name to join room ${requestedRoom.toUpperCase()}.`);
    }
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
      setRoomPlayers(payload.room.players);
    }, 1200);

    return () => window.clearInterval(interval);
  }, [playerToken, roomId]);

  function requireName() {
    const name = cleanName(nameInput);
    if (!name) {
      setSetupError("Enter your name first.");
      return null;
    }
    setSetupError("");
    return name;
  }

  function applyRoom(payload: RoomResponse, name: string) {
    setRoomId(payload.room.id);
    setPlayerToken(payload.token ?? null);
    setOnlineRole(payload.room.role);
    setPlayerCount(payload.room.playerCount);
    setRoomPlayers(payload.room.players);
    setGameState(payload.room.state);
    setLocalMode(false);
    setPendingRoomId(null);
    if (payload.token) window.localStorage.setItem(storageKey(payload.room.id), payload.token);
    window.localStorage.setItem("project-flux-player-name", name);
    window.history.replaceState(null, "", `?room=${payload.room.id}`);
  }

  async function createOnlineRoom(event?: FormEvent) {
    event?.preventDefault();
    const name = requireName();
    if (!name) return;

    setOnlineStatus("Creating room...");
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setSetupError("Could not create a room. Try again.");
      return;
    }
    const payload = (await response.json()) as RoomResponse;
    applyRoom(payload, name);
    setOnlineStatus("Room created. Copy the link for your opponent.");
  }

  async function joinOnlineRoom(event?: FormEvent) {
    event?.preventDefault();
    const name = requireName();
    if (!name) return;

    const id = (pendingRoomId ?? roomCodeInput).trim().toUpperCase();
    if (!id) {
      setSetupError("Open a room link or enter a room code first.");
      return;
    }

    const existingToken = window.localStorage.getItem(storageKey(id)) ?? undefined;
    setOnlineStatus(`Joining room ${id}...`);
    const response = await fetch(`/api/rooms/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "join", token: existingToken, name }),
    });
    if (!response.ok) {
      setSetupError("Room not found, full, or unavailable.");
      return;
    }
    const payload = (await response.json()) as RoomResponse;
    applyRoom(payload, name);
    setOnlineStatus(payload.room.role ? `Joined as ${name}.` : "Room is full. Watching as spectator.");
  }

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
    setRoomPlayers(payload.room.players);
  }

  function startLocalGame() {
    const name = requireName();
    if (!name) return;

    setLocalMode(true);
    setRoomId(null);
    setPlayerToken(null);
    setOnlineRole(null);
    setPlayerCount(0);
    setRoomPlayers({ p1: name, p2: "Guest" });
    setGameState(createGameState());
    window.localStorage.setItem("project-flux-player-name", name);
    window.history.replaceState(null, "", window.location.pathname);
    setOnlineStatus("Local demo game.");
  }

  function leaveOnlineRoom() {
    setRoomId(null);
    setPlayerToken(null);
    setOnlineRole(null);
    setPlayerCount(0);
    setRoomPlayers({});
    setLocalMode(false);
    setGameState(createGameState());
    window.history.replaceState(null, "", window.location.pathname);
    setOnlineStatus("Enter your name to create or join a room.");
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

  const turnTitle = gameOver && winner
    ? `${playerNames[winner] || fallbackName(winner)} wins`
    : gameState.selectedStat
      ? "Round result"
      : online && onlineRole
        ? onlineRole === gameState.activePlayer
          ? "Your turn: choose a category"
          : `Waiting for ${activeName}`
        : `${activeName}'s turn: choose a category`;

  const turnBody = gameOver && winner
    ? "All cards have been captured. Start a new game when you are ready."
    : gameState.selectedStat
      ? gameState.roundResult.body
      : "Pick the strongest category on the visible card. The opponent card reveals after you choose.";

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
          {gameVisible ? (
            <>
              <div>
                <span>{playerNames.p1 || "Player 1"}</span>
                <strong>{gameState.p1Deck.length}</strong>
              </div>
              <div>
                <span>Pot</span>
                <strong>{gameState.pendingPot.length}</strong>
              </div>
              <div>
                <span>{playerNames.p2 || "Waiting"}</span>
                <strong>{gameState.p2Deck.length}</strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Step 1</span>
                <strong>Name</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>Online</strong>
              </div>
              <div>
                <span>Deck</span>
                <strong>24</strong>
              </div>
            </>
          )}
        </div>
      </section>

      {!gameVisible ? (
        <section className="setup-panel">
          <div>
            <span className="console-label">Online Setup</span>
            <h2>{pendingRoomId ? `Join room ${pendingRoomId}` : "Create a room for testing"}</h2>
            <p>{onlineStatus}</p>
          </div>
          <form className="setup-form" onSubmit={pendingRoomId ? joinOnlineRoom : createOnlineRoom}>
            <label>
              Your name
              <input
                autoComplete="name"
                maxLength={24}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="Enter your name"
                value={nameInput}
              />
            </label>
            {pendingRoomId ? (
              <button type="submit">Join Room</button>
            ) : (
              <>
                <button type="submit">Create Room</button>
                <label>
                  Room code
                  <input
                    maxLength={8}
                    onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                    placeholder="Optional code"
                    value={roomCodeInput}
                  />
                </label>
                <button type="button" onClick={() => void joinOnlineRoom()}>
                  Join Room From Code
                </button>
              </>
            )}
            <button className="secondary-action" type="button" onClick={startLocalGame}>
              Play Local Demo
            </button>
            {setupError ? <p className="setup-error">{setupError}</p> : null}
          </form>
        </section>
      ) : (
        <>
          <section className="online-panel">
            <div>
              <span className="console-label">{online ? "Online Room" : "Local Demo"}</span>
              <h2>{online ? `Room ${roomId}` : `${playerNames.p1} vs ${playerNames.p2}`}</h2>
              <p>{online ? `${playerCount}/2 players connected. ${onlineStatus}` : "Pass the device between turns."}</p>
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
                </>
              ) : null}
              <button type="button" onClick={leaveOnlineRoom}>
                Leave
              </button>
            </div>
          </section>

          <section className="match-panel">
            <div className="round-console">
              <div>
                <span className="console-label">{gameState.selectedStat ? "Result" : "Turn"}</span>
                <h2>{turnTitle}</h2>
                <p>{turnBody}</p>
              </div>
              <div className={`result-pill ${gameState.roundResult.tone}`}>{gameOver && winner ? "Game Over" : gameState.roundResult.title}</div>
            </div>

            <div className="battle-grid">
              <div className="player-column">
                <div className="column-header">
                  <span>{online ? `You: ${playerNames[viewerPlayer]}` : `Current: ${playerNames[viewerPlayer]}`}</span>
                  <strong>Your Card</strong>
                </div>
                <TitanCard card={viewerCard} selectedStat={gameState.selectedStat} />
              </div>

              <div className="selector-column">
                <div className="category-panel">
                  <span className="console-label">{gameState.selectedStat ? "Round Control" : "Choose Category"}</span>
                  <p className="action-hint">
                    {gameState.selectedStat
                      ? "Opponent card revealed. Use Next Card to continue."
                      : canChoose
                        ? "Choose one category from your visible card."
                        : `Waiting for ${activeName}.`}
                  </p>
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
                    <button className="primary-action" disabled={!gameState.selectedStat || gameOver} onClick={continueRound} type="button">
                      Next Card
                    </button>
                    <button onClick={resetGame} type="button">
                      Shuffle New Game
                    </button>
                  </div>
                </div>

                <details className="rules-panel">
                  <summary>Rules</summary>
                  <p>Pick one category. Highest score wins both cards.</p>
                  <p>Draws move both cards into the pot. The next winner takes the pot.</p>
                </details>
              </div>

              <div className="player-column">
                <div className="column-header">
                  <span>{online ? `Opponent: ${opponentName}` : `Opponent: ${playerNames[opponentPlayer]}`}</span>
                  <strong>{gameState.revealed || gameOver ? "Revealed Card" : "Hidden Card"}</strong>
                </div>
                <TitanCard card={opponentCard} hidden={!gameState.revealed && !gameOver} selectedStat={gameState.selectedStat} />
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
