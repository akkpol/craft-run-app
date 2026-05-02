import test from "node:test";
import assert from "node:assert/strict";

import {
  clampOverviewPage,
  paginateOverviewRows,
} from "../src/lib/admin-overview-pagination.ts";

type TestOverviewRow = {
  id: string;
  sortAt: string;
};

test("clampOverviewPage keeps the requested page inside valid bounds", () => {
  assert.equal(clampOverviewPage(0, 120, 25), 1);
  assert.equal(clampOverviewPage(2, 120, 25), 2);
  assert.equal(clampOverviewPage(99, 120, 25), 5);
  assert.equal(clampOverviewPage(3, 0, 25), 1);
});

test("paginateOverviewRows sorts newest rows first before slicing the page", () => {
  const rows: TestOverviewRow[] = [
    {
      id: "job-1",
      sortAt: "2026-04-27T09:00:00.000Z",
    },
    {
      id: "quote-1",
      sortAt: "2026-04-27T11:00:00.000Z",
    },
    {
      id: "conv-1",
      sortAt: "2026-04-27T10:00:00.000Z",
    },
  ];

  assert.deepEqual(
    paginateOverviewRows(rows, 1, 2).map((row) => row.id),
    ["quote-1", "conv-1"]
  );
  assert.deepEqual(
    paginateOverviewRows(rows, 2, 2).map((row) => row.id),
    ["job-1"]
  );
});