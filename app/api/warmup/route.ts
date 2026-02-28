import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export const runtime = "nodejs";

export async function GET() {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret) {
        // Don’t fail the page if warmup isn’t configured
        return NextResponse.json(
            { ok: false, skipped: true, reason: "Missing LiveKit env vars" },
            { status: 200 },
        );
    }

    try {
        const svc = new RoomServiceClient(url, apiKey, apiSecret);
        // Lightweight call that reaches the server and forces it “awake”
        await svc.listRooms();
        console.log('backend warmed up');
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e) {
        // Still return 200 so UX isn't impacted; log in server output if needed
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}