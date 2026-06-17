import { chooseStatForState, continueState, createGameState, type GameState, type PlayerId } from "@/lib/gameEngine";
import type { StatKey } from "@/lib/techTitansDeck";

export type Room = {
  id: string;
  state: GameState;
  players: Partial<Record<PlayerId, string>>;
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

function publicRoom(room: Room, token?: string) {
  const role = token && room.players.p1 === token ? "p1" : token && room.players.p2 === token ? "p2" : null;
  return {
    id: room.id,
    role,
    state: room.state,
    playerCount: Number(Boolean(room.players.p1)) + Number(Boolean(room.players.p2)),
  };
}

export function createRoom() {
  let id = makeId();
  while (rooms.has(id)) id = makeId();

  const token = makeToken();
  const room: Room = {
    id,
    state: createGameState(),
    players: { p1: token },
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return { token, room: publicRoom(room, token) };
}

export function getRoom(roomId: string, token?: string) {
  const room = rooms.get(roomId.toUpperCase());
  return room ? publicRoom(room, token) : null;
}

export function joinRoom(roomId: string, token?: string) {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;

  if (token && (room.players.p1 === token || room.players.p2 === token)) {
    return { token, room: publicRoom(room, token) };
  }

  if (!room.players.p2) {
    const nextToken = makeToken();
    room.players.p2 = nextToken;
    return { token: nextToken, room: publicRoom(room, nextToken) };
  }

  return { token: token ?? "", room: publicRoom(room) };
}

export function applyRoomAction(roomId: string, token: string | undefined, action: { type?: string; stat?: StatKey }) {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;

  const role = token && room.players.p1 === token ? "p1" : token && room.players.p2 === token ? "p2" : null;

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
