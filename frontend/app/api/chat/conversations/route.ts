import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBackendConversationList } from "@/lib/backend";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent") ?? "analyst";

  try {
    const response = await getBackendConversationList(
      {
        email: session.user.email,
        provider: session.user.provider,
      },
      agent,
    );
    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unable to retrieve conversations right now.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
