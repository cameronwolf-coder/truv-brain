import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/truv-api";

export async function POST(req: NextRequest) {
  try {
    const { link_id, productKey } = await req.json();

    if (!link_id || !productKey) {
      return NextResponse.json({ error: "Missing link_id or productKey" }, { status: 400 });
    }

    const report = await getReport(link_id, productKey);

    return NextResponse.json(report);
  } catch (error) {
    console.error("Get report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get report" },
      { status: 500 }
    );
  }
}
