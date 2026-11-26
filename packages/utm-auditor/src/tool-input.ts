import { z } from "zod";
import { MAX_LIST_INPUT } from "./audit-list.ts";

export const auditListInputSchema = z.object({
  urls: z.array(z.string().max(2048)).min(1).max(MAX_LIST_INPUT),
});
