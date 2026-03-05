import { NextRequest, NextResponse } from "next/server";
import { exchangeToken } from "@/lib/truv-api";

export async function POST(req: NextRequest) {
  try {
    const { public_token } = await req.json();

    if (!public_token) {
      return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
    }

    const result = await exchangeToken(public_token);

    return NextResponse.json({
      access_token: result.access_token,
      link_id: result.link_id,
    });
  } catch (error) {
    console.error("Exchange token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to exchange token" },
      { status: 500 }
    );
  }
}
