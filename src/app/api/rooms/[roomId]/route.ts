import { NextRequest, NextResponse } from "next/server";
import { applyRoomAction, cleanPlayerName, getRoom, joinRoom } from "@/app/api/rooms/store";
import { statKeys, type StatKey } from "@/lib/techTitansDeck";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  const token = request.headers.get("x-player-token") ?? undefined;
  const room = getRoom(roomId, token);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ room });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { token?: string; type?: string; stat?: string; name?: string };

  if (body.type === "join") {
    if (!cleanPlayerName(body.name)) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const joined = joinRoom(roomId, body.name ?? "", body.token);
    if (!joined) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    return NextResponse.json(joined);
  }

  const stat = statKeys.includes(body.stat as StatKey) ? (body.stat as StatKey) : undefined;
  const room = applyRoomAction(roomId, body.token, { type: body.type, stat });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ room });
}
