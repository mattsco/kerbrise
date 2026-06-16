import { NextResponse } from "next/server";
import { fetchSaintMaloTides } from "@/lib/maree-info";

export async function GET() {
  try {
    const data = await fetchSaintMaloTides();

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to load tides",
      },
      {
        status: 500,
      }
    );
  }
}
