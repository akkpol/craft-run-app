import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

function buildSelectQuery(
  data: unknown,
  capture?: {
    eq?: Array<[string, unknown]>;
    gte?: Array<[string, string]>;
  }
) {
  const query = {
    eq: vi.fn((field: string, value: unknown) => {
      capture?.eq?.push([field, value]);
      return query;
    }),
    gte: vi.fn((field: string, value: string) => {
      capture?.gte?.push([field, value]);
      return Promise.resolve({ data, error: null });
    }),
  };

  return {
    select: vi.fn(() => query),
  };
}

describe("getDashboardTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T03:30:00.000Z"));
  });

  it("queries completed jobs using the canonical uppercase status", async () => {
    const completedJobsCapture = {
      eq: [] as Array<[string, unknown]>,
      gte: [] as Array<[string, string]>,
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return buildSelectQuery([]);
        }

        if (table === "quotes") {
          return buildSelectQuery([]);
        }

        if (table === "jobs") {
          const selectCount = supabase.from.mock.calls.filter(
            ([calledTable]: [string]) => calledTable === "jobs"
          ).length;

          return selectCount === 1
            ? buildSelectQuery([])
            : buildSelectQuery([], completedJobsCapture);
        }

        if (table === "commercial_documents") {
          return buildSelectQuery([]);
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase);

    const { getDashboardTrends } = await import("../src/lib/dashboard-trends.ts");
    await getDashboardTrends(7);

    expect(completedJobsCapture.eq).toEqual([["status", "COMPLETED"]]);
  });

  it("uses Bangkok midnight as the lookback boundary and buckets rows by Bangkok day", async () => {
    const completedJobsCapture = {
      eq: [] as Array<[string, unknown]>,
      gte: [] as Array<[string, string]>,
    };
    const boundaryCapture = {
      gte: [] as Array<[string, string]>,
    };

    let jobsSelectCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return buildSelectQuery(
            [{ created_at: "2026-05-13T18:30:00.000Z" }],
            boundaryCapture
          );
        }

        if (table === "quotes") {
          return buildSelectQuery(
            [{ created_at: "2026-05-15T15:30:00.000Z" }],
            boundaryCapture
          );
        }

        if (table === "jobs") {
          jobsSelectCount += 1;

          return jobsSelectCount === 1
            ? buildSelectQuery(
                [{ created_at: "2026-05-14T02:00:00.000Z" }],
                boundaryCapture
              )
            : buildSelectQuery(
                [{ updated_at: "2026-05-14T17:30:00.000Z", status: "COMPLETED" }],
                completedJobsCapture
              );
        }

        if (table === "commercial_documents") {
          return buildSelectQuery(
            [{ issued_at: "2026-05-13T23:00:00.000Z" }],
            boundaryCapture
          );
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase);

    const { getDashboardTrends } = await import("../src/lib/dashboard-trends.ts");
    const trends = await getDashboardTrends(2);

    expect(boundaryCapture.gte[0]).toEqual([
      "created_at",
      "2026-05-13T17:00:00.000Z",
    ]);
    expect(completedJobsCapture.gte[0]).toEqual([
      "updated_at",
      "2026-05-13T17:00:00.000Z",
    ]);
    expect(trends).toEqual([
      {
        date: "2026-05-14",
        newLeads: 1,
        newQuotes: 0,
        newJobs: 1,
        completedJobs: 0,
        issuedDocuments: 1,
      },
      {
        date: "2026-05-15",
        newLeads: 0,
        newQuotes: 1,
        newJobs: 0,
        completedJobs: 1,
        issuedDocuments: 0,
      },
    ]);
  });
});
