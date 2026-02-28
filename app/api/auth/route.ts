import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { password } = (await req.json().catch(() => ({}))) as { password?: string };

    const expected = process.env.MVP_PASSWORD ?? "25364888";
    if (!expected) {
        return NextResponse.json(
            { error: "Server is missing MVP_PASSWORD" },
            { status: 500 },
        );
    }

    if (!password || password !== expected) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const cookieName = process.env.MVP_AUTH_COOKIE_NAME ?? "mvp_auth";
    const cookieValue = process.env.MVP_AUTH_COOKIE_VALUE ?? "1";

    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
}