import { auth, defineMcp } from "@lovable.dev/mcp-js";
type McpTools = Parameters<typeof defineMcp>[0]["tools"];
import getMessageTest from "./tools/get-message-test";
import listCampaigns from "./tools/list-campaigns";
import listMessageTests from "./tools/list-message-tests";
import listPersonas from "./tools/list-personas";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "fkf-commsiq",
  title: "CommsIQ",
  version: "0.1.0",
  instructions:
    "Tools for CommsIQ, the Football Kenya Federation communications workspace. Use `list_message_tests` and `get_message_test` to read past message tests and their persona-panel verdicts, `list_campaigns` for publishing campaigns, and `list_personas` to inspect the Kenyan persona panel. All data is scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // exactOptionalPropertyTypes: the SDK types omit `outputSchema` rather than allow undefined.
  tools: [listMessageTests, getMessageTest, listCampaigns, listPersonas] as unknown as McpTools,
});
