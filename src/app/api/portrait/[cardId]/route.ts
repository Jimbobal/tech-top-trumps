import { NextResponse } from "next/server";
import { cardFromId } from "@/lib/gameEngine";

type RouteContext = {
  params: Promise<{ cardId: string }>;
};

function escapeSvg(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function fallbackPortrait(name: string, organisation: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="${escapeSvg(name)} portrait">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ff2d55"/>
      <stop offset="0.48" stop-color="#161616"/>
      <stop offset="1" stop-color="#f8c84d"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="45%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect x="28" y="28" width="584" height="584" rx="18" fill="none" stroke="#f7f2db" stroke-width="12"/>
  <circle cx="320" cy="230" r="118" fill="#f7f2db"/>
  <path d="M126 598c20-142 103-220 194-220s174 78 194 220" fill="#111"/>
  <circle cx="320" cy="230" r="90" fill="#171717"/>
  <text x="320" y="258" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="900" fill="#ff2d55">${escapeSvg(initials)}</text>
  <rect x="72" y="424" width="496" height="112" rx="8" fill="#f7f2db" stroke="#111" stroke-width="8"/>
  <text x="320" y="470" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#111">${escapeSvg(name)}</text>
  <text x="320" y="512" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111">${escapeSvg(organisation)}</text>
  <rect width="640" height="640" fill="url(#glow)"/>
</svg>`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { cardId } = await context.params;
  const card = cardFromId(cardId);
  if (!card) return NextResponse.json({ error: "Portrait not found" }, { status: 404 });

  const imageResponse = await fetch(card.portraitUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": "ProjectFluxTechTitansArena/1.0 (local prototype)",
    },
    next: { revalidate: 60 * 60 * 24 * 7 },
  }).catch(() => null);

  if (imageResponse?.ok) {
    return new NextResponse(await imageResponse.arrayBuffer(), {
      headers: {
        "cache-control": "public, max-age=604800, immutable",
        "content-type": imageResponse.headers.get("content-type") ?? "image/jpeg",
      },
    });
  }

  return new NextResponse(fallbackPortrait(card.name, card.organisation), {
    headers: {
      "cache-control": "public, max-age=604800, immutable",
      "content-type": "image/svg+xml; charset=utf-8",
    },
  });
}
