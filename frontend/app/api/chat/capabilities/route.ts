import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBackendChatCapabilities } from "@/lib/backend";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  try {
    const response = await getBackendChatCapabilities({
      email: session.user.email,
      provider: session.user.provider,
    });
    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unable to retrieve chat capabilities right now.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
