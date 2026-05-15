import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockDeleteInstallProofFile,
  mockIsAllowedInstallProofMime,
  mockLogHumanAction,
  mockUploadInstallProofFile,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockDeleteInstallProofFile: vi.fn(),
  mockIsAllowedInstallProofMime: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockUploadInstallProofFile: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

vi.mock("@/lib/install-proof-storage", () => ({
  deleteInstallProofFile: mockDeleteInstallProofFile,
  INSTALL_PROOF_MAX_BYTES: 10 * 1024 * 1024,
  isAllowedInstallProofMime: mockIsAllowedInstallProofMime,
  uploadInstallProofFile: mockUploadInstallProofFile,
}));

type InstallProofClientOptions = {
  install?: Record<string, unknown> | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
};

function createInstallProofClient(options: InstallProofClientOptions = {}) {
  const install = options.install ?? {
    id: "install-1",
    public_token: "token-12345",
    status: "scheduled",
    job_id: "job-1",
  };

  return {
    rpc: vi.fn().mockResolvedValue({
      data:
        options.rpcData ??
        [
          {
            id: "install-1",
            job_id: "job-1",
            status: "done",
            photo_count: 2,
          },
        ],
      error: options.rpcError ?? null,
    }),
    from: vi.fn((table: string) => {
      if (table !== "installations") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: install,
              error: null,
            }),
          })),
        })),
      };
    }),
  };
}

function createProofRequest(markDone = true) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array([1])], "proof.png", { type: "image/png" })
  );
  if (markDone) {
    formData.set("markDone", "1");
  }

  return new NextRequest("http://localhost/api/install/token-12345/proof", {
    method: "POST",
    body: formData,
  });
}

async function callProofRoute(markDone = true) {
  const { POST } = await import("../src/app/api/install/[token]/proof/route.ts");
  return POST(createProofRequest(markDone), {
    params: Promise.resolve({ token: "token-12345" }),
  });
}

describe("install proof upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAllowedInstallProofMime.mockReturnValue(true);
    mockUploadInstallProofFile.mockResolvedValue({
      storagePath: "installations/install-1/proof.png",
      size: 1,
      mimeType: "image/png",
      originalFileName: "proof.png",
    });
    mockDeleteInstallProofFile.mockResolvedValue(undefined);
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("appends proof paths through the atomic RPC instead of read-modify-write update", async () => {
    const supabase = createInstallProofClient();
    mockCreateAdminClient.mockReturnValue(supabase);

    const response = await callProofRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: "done",
      photoCount: 2,
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "append_installation_proof",
      expect.objectContaining({
        p_public_token: "token-12345",
        p_storage_path: "installations/install-1/proof.png",
        p_mark_done: true,
      })
    );
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        entityType: "job",
        entityId: "job-1",
        actionType: "installation.completed",
        payload: expect.objectContaining({ photo_count: 2 }),
      })
    );
  });

  it("removes the uploaded object when the installation closes before the DB append", async () => {
    const supabase = createInstallProofClient({ rpcData: [] });
    mockCreateAdminClient.mockReturnValue(supabase);

    const response = await callProofRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("INSTALLATION_NOT_OPEN");
    expect(mockDeleteInstallProofFile).toHaveBeenCalledWith(
      "installations/install-1/proof.png"
    );
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });
});
