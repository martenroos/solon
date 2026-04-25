import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requestBackendChatResponse, type BackendChatRequest } from "@/lib/backend";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  let payload: BackendChatRequest;
  try {
    payload = (await request.json()) as BackendChatRequest;
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  try {
    const response = await requestBackendChatResponse(
      {
        email: session.user.email,
        provider: session.user.provider,
      },
      payload,
    );
    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unable to retrieve a chat response right now.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
