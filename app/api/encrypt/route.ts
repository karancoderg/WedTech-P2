import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { value } = await request.json();

  if (!value || typeof value !== "string") {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

  return NextResponse.json({ encrypted: encrypt(value) });
}
