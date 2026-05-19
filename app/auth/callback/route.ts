import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // En implicit flow, le token est dans le hash (#access_token=...)
  // qui n'est pas envoyé au serveur. On délègue à une page client.
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/process`);
}