import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { PERSONAS } from "@/lib/personas";

export default defineTool({
  name: "list_personas",
  title: "List personas",
  description:
    "Browse the 100-persona Kenyan synthetic panel used to test messages, optionally filtered by segment or location.",
  inputSchema: {
    segment: z.string().optional().describe("Case-insensitive segment filter, e.g. 'youth'."),
    location: z.string().optional().describe("Case-insensitive location filter, e.g. 'Nairobi'."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("How many personas to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ segment, location, limit }) => {
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const matches = PERSONAS.filter(
      (p) =>
        (!segment || p.segment.toLowerCase().includes(segment.toLowerCase())) &&
        (!location || p.location.toLowerCase().includes(location.toLowerCase())),
    ).slice(0, take);

    const personas = matches.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      role: p.role,
      location: p.location,
      segment: p.segment,
      vibe: p.vibe,
      platforms: p.platforms,
      profile: p.profile,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(personas) }],
      structuredContent: { total: PERSONAS.length, personas },
    };
  },
});
