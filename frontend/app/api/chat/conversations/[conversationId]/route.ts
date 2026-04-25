import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBackendConversation } from "@/lib/backend";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  const { conversationId } = await context.params;

  try {
    const response = await getBackendConversation(
      {
        email: session.user.email,
        provider: session.user.provider,
      },
      conversationId,
    );
    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unable to retrieve the conversation right now.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
