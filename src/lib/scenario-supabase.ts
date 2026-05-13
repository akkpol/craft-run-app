type ScenarioError = { message: string };

export type ScenarioRow = Record<string, unknown>;

type QueryResult<T> = {
  data: T;
  error: ScenarioError | null;
};

type Filter = {
  column: string;
  operator: "eq" | "neq" | "is" | "in";
  value: unknown;
};

type Order = {
  column: string;
  ascending: boolean;
};

type UpsertOptions = {
  onConflict?: string;
};

let globalSequence = 0;

function cloneRow<T>(row: T): T {
  return { ...(row as Record<string, unknown>) } as T;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(table: string) {
  globalSequence += 1;
  const prefix = table.endsWith("s") ? table.slice(0, -1) : table;
  return `${prefix}-${globalSequence}`;
}

function getValue(row: ScenarioRow, column: string) {
  return row[column];
}

function normalizeRows(input: ScenarioRow | ScenarioRow[]) {
  return Array.isArray(input) ? input : [input];
}

function normalizeConflictColumns(options?: UpsertOptions) {
  return (options?.onConflict || "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

class ScenarioQueryBuilder implements PromiseLike<QueryResult<unknown>> {
  private operation: "select" | "insert" | "update" | "upsert" = "select";
  private filters: Filter[] = [];
  private orderBy: Order | null = null;
  private limitCount: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private mutationRows: ScenarioRow[] = [];
  private updateValues: ScenarioRow = {};
  private upsertOptions: UpsertOptions | undefined;

  constructor(
    private readonly db: ScenarioSupabase,
    private readonly tableName: string
  ) {}

  select(_columns?: string) {
    void _columns;
    return this;
  }

  insert(row: ScenarioRow | ScenarioRow[]) {
    this.operation = "insert";
    this.mutationRows = normalizeRows(row);
    return this;
  }

  update(values: ScenarioRow) {
    this.operation = "update";
    this.updateValues = values;
    return this;
  }

  upsert(row: ScenarioRow | ScenarioRow[], options?: UpsertOptions) {
    this.operation = "upsert";
    this.mutationRows = normalizeRows(row);
    this.upsertOptions = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: "is", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, operator: "in", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this.execute();
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this.execute();
  }

  then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<QueryResult<unknown>> {
    let rows: ScenarioRow[];

    if (this.operation === "insert") {
      rows = this.mutationRows.map((row) => this.db.insertRow(this.tableName, row));
    } else if (this.operation === "upsert") {
      rows = this.mutationRows.map((row) =>
        this.db.upsertRow(this.tableName, row, normalizeConflictColumns(this.upsertOptions))
      );
    } else if (this.operation === "update") {
      rows = this.applyReadShape(this.db.table(this.tableName));
      rows.forEach((row) => {
        Object.assign(row, this.updateValues, { updated_at: nowIso() });
      });
    } else {
      rows = this.applyReadShape(this.db.table(this.tableName));
    }

    const data = this.singleMode ? rows[0] ?? null : rows.map((row) => cloneRow(row));
    return Promise.resolve({ data, error: null });
  }

  private applyReadShape(rows: ScenarioRow[]) {
    let result = rows.filter((row) =>
      this.filters.every((filter) => {
        const value = getValue(row, filter.column);
        if (filter.operator === "eq") {
          return value === filter.value;
        }
        if (filter.operator === "neq") {
          return value !== filter.value;
        }
        if (filter.operator === "is") {
          return value === filter.value;
        }
        return Array.isArray(filter.value) && filter.value.includes(value);
      })
    );

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result = [...result].sort((left, right) => {
        const leftValue = String(getValue(left, column) ?? "");
        const rightValue = String(getValue(right, column) ?? "");
        return ascending
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }
}

export class ScenarioSupabase {
  private readonly tables = new Map<string, ScenarioRow[]>();

  from(tableName: string) {
    this.ensureTable(tableName);
    return new ScenarioQueryBuilder(this, tableName);
  }

  table<T extends ScenarioRow = ScenarioRow>(tableName: string): T[] {
    this.ensureTable(tableName);
    return this.tables.get(tableName) as T[];
  }

  snapshot() {
    return Object.fromEntries(
      [...this.tables.entries()].map(([tableName, rows]) => [
        tableName,
        rows.map((row) => cloneRow(row)),
      ])
    );
  }

  insertRow(tableName: string, row: ScenarioRow) {
    const table = this.table(tableName);
    const nextRow: ScenarioRow = {
      ...row,
      id: row.id ?? createId(tableName),
      created_at: row.created_at ?? nowIso(),
      updated_at: row.updated_at ?? nowIso(),
    };

    if (tableName === "action_log") {
      nextRow.action_ref = nextRow.action_ref ?? `ACT-SIM-${String(table.length + 1).padStart(4, "0")}`;
    }

    table.push(nextRow);
    return cloneRow(nextRow);
  }

  upsertRow(tableName: string, row: ScenarioRow, conflictColumns: string[]) {
    const table = this.table(tableName);
    const existing =
      conflictColumns.length > 0
        ? table.find((candidate) =>
            conflictColumns.every((column) => candidate[column] === row[column])
          )
        : null;

    if (existing) {
      Object.assign(existing, row, { updated_at: nowIso() });
      return cloneRow(existing);
    }

    return this.insertRow(tableName, row);
  }

  private ensureTable(tableName: string) {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }
  }
}

export function createScenarioSupabase() {
  return new ScenarioSupabase();
}
