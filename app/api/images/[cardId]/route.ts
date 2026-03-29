import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  if (!cardId) {
    return NextResponse.json({ images: [] });
  }

  const imagesDir = path.join(process.cwd(), "public", "images");

  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch {
    return NextResponse.json({ images: [] });
  }

  // cardId 로 시작하고, 그 다음이 -숫자. 으로 끝나는 파일만 추출
  const pattern = new RegExp(`^${escapeRegex(cardId)}-(\\d+)\\.(jpeg|jpg|png|webp|gif)$`, "i");

  const matched = files
    .map((f) => {
      const m = f.match(pattern);
      if (!m) return null;
      return { filename: f, index: parseInt(m[1], 10) };
    })
    .filter(Boolean) as { filename: string; index: number }[];

  matched.sort((a, b) => a.index - b.index);

  const images = matched.map((m) => `/images/${m.filename}`);

  return NextResponse.json({ images });
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
