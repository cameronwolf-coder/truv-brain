import { NextRequest, NextResponse } from "next/server";
import { createUser, createBridgeToken } from "@/lib/truv-api";

export async function POST(req: NextRequest) {
  try {
    const { productKey, accountInfo } = await req.json();

    const PRODUCT_TYPE_MAP: Record<string, string> = {
      voie: "income",
      voe: "employment",
      dds: "deposit_switch",
      voa: "assets",
      insurance: "insurance",
      pll: "pll",
      admin: "admin",
    };

    const productType = PRODUCT_TYPE_MAP[productKey];
    if (!productType) {
      return NextResponse.json({ error: "Invalid product key" }, { status: 400 });
    }

    const externalId = `gov-demo-${productKey}-${Date.now()}`;
    const user = await createUser(externalId);
    const token = await createBridgeToken(user.id, productType, accountInfo);

    return NextResponse.json({
      bridge_token: token.bridge_token,
      user_id: user.id,
    });
  } catch (error) {
    console.error("Bridge token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create bridge token" },
      { status: 500 }
    );
  }
}
