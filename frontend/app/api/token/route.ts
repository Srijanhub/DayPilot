import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET() {
  try {
    const tokenPath = path.join(os.homedir(), "daypilot", "token");
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, "utf-8").trim();
      if (token) {
        return NextResponse.json({ token });
      }
    }
  } catch (e) {}

  const envToken = process.env.DAYPILOT_API_TOKEN || process.env.NEXT_PUBLIC_DAYPILOT_API_TOKEN || "";
  return NextResponse.json({ token: envToken });
}
