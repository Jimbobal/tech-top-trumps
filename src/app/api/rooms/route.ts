import { NextResponse } from "next/server";
import { createRoom } from "@/app/api/rooms/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const created = createRoom(body.name ?? "");
  if (!created) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  return NextResponse.json(created);
}
