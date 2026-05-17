import { POST as proofExportPost } from "@/app/api/proof/export/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proofExportPost(request);
}
