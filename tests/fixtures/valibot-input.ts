import * as v from "valibot";

const AccountSchema = v.object({
  id: v.string(),
  balance: v.number(),
  labels: v.array(v.string()),
  note: v.optional(v.string()),
  status: v.picklist(["active", "blocked"]),
  deletedAt: v.nullable(v.date()),
});

export type Account = v.InferOutput<typeof AccountSchema>;
