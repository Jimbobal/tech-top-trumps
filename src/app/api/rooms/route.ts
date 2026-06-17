import { NextResponse } from "next/server";
import { createRoom } from "@/app/api/rooms/store";

export async function POST() {
  return NextResponse.json(createRoom());
}
