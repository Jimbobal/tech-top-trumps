import { chooseStatForState, continueState, createGameState, type GameState, type PlayerId } from "@/lib/gameEngine";
import type { StatKey } from "@/lib/techTitansDeck";

export type RoomPlayer = {
  token: string;
  name: string;
};

export type Room = {
  id: string;
  state: GameState;
  players: Partial<Record<PlayerId, RoomPlayer | string>>;
  createdAt: number;
};

const globalRooms = globalThis as typeof globalThis & {
  techTitansRooms?: Map<string, Room>;
};

export const rooms = globalRooms.techTitansRooms ?? new Map<string, Room>();
globalRooms.techTitansRooms = rooms;

function makeId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeToken() {
  return crypto.randomUUID();
}

export function cleanPlayerName(name?: string) {
  const trimmed = name?.trim() ?? "";
  return trimmed.slice(0, 24);
}

function playerToken(player?: RoomPlayer | string) {
  return typeof player === "string" ? player : player?.token;
}

function playerDisplayName(player: PlayerId, room: Room) {
  const record = room.players[player];
  if (typeof record === "string") return player === "p1" ? "Player 1" : "Player 2";
  return record?.name || (player === "p1" ? "Player 1" : "Player 2");
}

function publicRoom(room: Room, token?: string) {
  const role = token && playerToken(room.players.p1) === token ? "p1" : token && playerToken(room.players.p2) === token ? "p2" : null;
  return {
    id: room.id,
    role,
    state: room.state,
    playerCount: Number(Boolean(room.players.p1)) + Number(Boolean(room.players.p2)),
    players: {
      p1: room.players.p1 ? playerDisplayName("p1", room) : undefined,
      p2: room.players.p2 ? playerDisplayName("p2", room) : undefined,
    },
  };
}

export function createRoom(name: string) {
  const playerName = cleanPlayerName(name);
  if (!playerName) return null;

  let id = makeId();
  while (rooms.has(id)) id = makeId();

  const token = makeToken();
  const room: Room = {
    id,
    state: createGameState(),
    players: { p1: { token, name: playerName } },
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return { token, room: publicRoom(room, token) };
}

export function getRoom(roomId: string, token?: string) {
  const room = rooms.get(roomId.toUpperCase());
  return room ? publicRoom(room, token) : null;
}

export function joinRoom(roomId: string, name: string, token?: string) {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;

  const playerName = cleanPlayerName(name);
  if (!playerName) return null;

  if (token && (playerToken(room.players.p1) === token || playerToken(room.players.p2) === token)) {
    const role: PlayerId = playerToken(room.players.p1) === token ? "p1" : "p2";
    room.players[role] = { token, name: playerName };
    return { token, room: publicRoom(room, token) };
  }

  if (!room.players.p2) {
    const nextToken = makeToken();
    room.players.p2 = { token: nextToken, name: playerName };
    return { token: nextToken, room: publicRoom(room, nextToken) };
  }

  return { token: token ?? "", room: publicRoom(room) };
}

export function applyRoomAction(roomId: string, token: string | undefined, action: { type?: string; stat?: StatKey }) {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;

  const role = token && playerToken(room.players.p1) === token ? "p1" : token && playerToken(room.players.p2) === token ? "p2" : null;

  if (action.type === "choose" && action.stat && role === room.state.activePlayer) {
    room.state = chooseStatForState(room.state, action.stat);
  }

  if (action.type === "next" && role) {
    room.state = continueState(room.state);
  }

  if (action.type === "reset" && role === "p1") {
    room.state = createGameState();
  }

  return publicRoom(room, token);
}
