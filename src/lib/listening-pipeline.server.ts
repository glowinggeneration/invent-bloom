/**
 * Shared listening orchestration for every external source family.
 *
 * Individual collectors keep ownership of provider-specific fetching and
 * storage, while this module gives scheduled hooks one stable contract for
 * running lanes and reporting their outcome. That lets Mentions, Overview,
 * alerts and reports reason about listening as one system rather than a set
 * of unrelated cron jobs.
 */

export type ListeningLane = "apify" | "news" | "social";

export type ListeningLaneResult = {
  lane: ListeningLane;
  status: "ok" | "error";
  fetched: number;
  stored: number;
  duplicates: number;
  failed: string[];
  details: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
};

export type ListeningSweepResult = {
  ok: boolean;
  lanes: ListeningLaneResult[];
  totals: {
    fetched: number;
    stored: number;
    duplicates: number;
    failed: number;
  };
  startedAt: string;
  finishedAt: string;
};

type PipelineOptions = {
  lanes?: ListeningLane[];
  apifySources?: string[];
};

const requestedLanes = (lanes?: ListeningLane[]): ListeningLane[] => {
  if (!lanes?.length) return ["apify", "news", "social"];
  return [...new Set(lanes)];
};

async function runLane(
  lane: ListeningLane,
  options: PipelineOptions,
): Promise<ListeningLaneResult> {
  const startedAt = new Date().toISOString();

  try {
    if (lane === "apify") {
      const { runApifySweep } = await import("./apify-mentions.server");
      const result = await runApifySweep(options.apifySources);
      const fetched = result.sources.reduce((sum, source) => sum + source.collected, 0);
      const failed = result.sources
        .filter((source) => source.status !== "ok")
        .map((source) => `${source.label}: ${source.message ?? source.status}`);

      return {
        lane,
        status: failed.length ? "error" : "ok",
        fetched,
        stored: result.stored,
        duplicates: Math.max(
          0,
          result.sources.reduce((sum, source) => sum + source.relevant, 0) - result.stored,
        ),
        failed,
        details: { sources: result.sources },
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }

    if (lane === "news") {
      const { runNewsSweep } = await import("./news.server");
      const result = await runNewsSweep();
      return {
        lane,
        status: result.failedQueries.length ? "error" : "ok",
        fetched: result.fetched,
        stored: result.stored,
        duplicates: result.duplicates,
        failed: result.failedQueries,
        details: {
          newsdata: result.newsdata,
          googleNews: result.googleNews,
          social: result.social,
        },
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }

    const { runSocialSweep } = await import("./news.server");
    const result = await runSocialSweep();
    return {
      lane,
      status: result.failedQueries.length ? "error" : "ok",
      fetched: result.fetched,
      stored: result.stored,
      duplicates: result.duplicates,
      failed: result.failedQueries,
      details: { byProvider: result.byProvider },
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      lane,
      status: "error",
      fetched: 0,
      stored: 0,
      duplicates: 0,
      failed: [error instanceof Error ? error.message : "Listening lane failed"],
      details: {},
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

/** Run one or more source families through one observable listening contract. */
export async function runListeningPipeline(
  options: PipelineOptions = {},
): Promise<ListeningSweepResult> {
  const startedAt = new Date().toISOString();
  const lanes: ListeningLaneResult[] = [];

  // Run sequentially to avoid turning provider quotas and DB writes into a
  // burst when the unified endpoint is used for a full sweep.
  for (const lane of requestedLanes(options.lanes)) {
    lanes.push(await runLane(lane, options));
  }

  return {
    ok: lanes.every((lane) => lane.status === "ok"),
    lanes,
    totals: {
      fetched: lanes.reduce((sum, lane) => sum + lane.fetched, 0),
      stored: lanes.reduce((sum, lane) => sum + lane.stored, 0),
      duplicates: lanes.reduce((sum, lane) => sum + lane.duplicates, 0),
      failed: lanes.reduce((sum, lane) => sum + lane.failed.length, 0),
    },
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
