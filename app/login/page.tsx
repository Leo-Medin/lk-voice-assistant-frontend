"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const nextPath = useMemo(() => sp.get("next") ?? "/", [sp]);

    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                setError(data?.error ?? "Invalid password");
                return;
            }

            router.replace(nextPath);
            router.refresh();
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-black text-white px-6">
            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border border-white/10 rounded-xl p-6 bg-white/5">
                <h1 className="text-xl font-semibold">Enter password</h1>

                <label className="block text-sm text-white/70">
                    Password
                    <input
                        className="mt-2 w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                </label>

                {error ? <p className="text-sm text-red-300">{error}</p> : null}

                <button
                    type="submit"
                    disabled={loading || password.length === 0}
                    className="w-full rounded-md bg-white text-black px-3 py-2 disabled:opacity-60"
                >
                    {loading ? "Checking..." : "Unlock"}
                </button>

                <p className="text-xs text-white/50">
                    This is an MVP preview protected by a shared password.
                </p>
            </form>
        </main>
    );
}