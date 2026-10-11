import { sendTestMessage } from "@/lib/deliver";
import { errorResponse, guard, json } from "@/lib/api";

export async function POST() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const r = await sendTestMessage();
    return json(r, r.ok ? 200 : 502);
  } catch (e) {
    return errorResponse(e);
  }
}
