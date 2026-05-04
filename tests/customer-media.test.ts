/**
 * Customer Media Upload Tests
 * 
 * Tests for the new customer media upload functionality including:
 * - File validation (type, size, count) 
 * - Upload success scenarios
 * - Rollback behavior on failures
 * - Storage path generation
 * - Signed URL creation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { mockR2Send, mockGetSignedUrl } = vi.hoisted(() => ({
  mockR2Send: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mockR2Send;
  },
  PutObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  GetObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import {
  validateCustomerMediaFiles,
  uploadLeadMediaFiles,
  signLeadMediaAssetPaths,
  MAX_CUSTOMER_MEDIA_FILES,
  MAX_CUSTOMER_MEDIA_FILE_SIZE,
} from "../src/lib/customer-media.js";
import { getCustomerMediaStorageRuntimeStatus } from "../src/lib/customer-media-storage.ts";

const R2_ENV_KEYS = [
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
] as const;

function clearR2Env() {
  R2_ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
  delete process.env.CLOUDFLARE_R2_REGION;
}

function setCompleteR2Env() {
  process.env.CLOUDFLARE_R2_BUCKET = "customer-media";
  process.env.CLOUDFLARE_R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "test-access-key";
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "test-secret-key";
}

// Mock Supabase admin client
const mockSupabase = {
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
    })),
  },
  from: vi.fn(() => ({
    insert: vi.fn(),
    delete: vi.fn(() => ({
      in: vi.fn(),
      eq: vi.fn(),
    })),
  })),
} as unknown as SupabaseClient;

// Helper to create mock File objects
function createMockFile(name: string, type: string, size: number): File {
  const file = new File([""], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
}

describe("validateCustomerMediaFiles", () => {
  it("should accept valid files within limits", () => {
    const validFiles = [
      createMockFile("test.jpg", "image/jpeg", 1024 * 1024), // 1MB
      createMockFile("test.png", "image/png", 2 * 1024 * 1024), // 2MB
      createMockFile("test.pdf", "application/pdf", 3 * 1024 * 1024), // 3MB
    ];

    expect(() => validateCustomerMediaFiles(validFiles)).not.toThrow();
  });

  it("should reject files exceeding count limit", () => {
    const tooManyFiles = Array.from({ length: MAX_CUSTOMER_MEDIA_FILES + 1 }, (_, i) =>
      createMockFile(`test${i}.jpg`, "image/jpeg", 1024)
    );

    expect(() => validateCustomerMediaFiles(tooManyFiles)).toThrow(
      `อัปโหลดได้สูงสุด ${MAX_CUSTOMER_MEDIA_FILES} ไฟล์ต่อคำขอ`
    );
  });

  it("should reject files exceeding size limit", () => {
    const oversizedFile = createMockFile("big.jpg", "image/jpeg", MAX_CUSTOMER_MEDIA_FILE_SIZE + 1);

    expect(() => validateCustomerMediaFiles([oversizedFile])).toThrow(
      "ไฟล์ใหญ่เกิน 10MB กรุณาลดขนาดรูปแล้วลองใหม่"
    );
  });

  it("should reject files with missing MIME type", () => {
    const fileWithoutMime = createMockFile("unknown.bin", "", 1024);

    expect(() => validateCustomerMediaFiles([fileWithoutMime])).toThrow(
      "ไฟล์ต้องมีประเภทที่ชัดเจน กรุณาเลือกไฟล์ใหม่"
    );
  });

  it("should reject files with unsupported MIME type", () => {
    const unsupportedFile = createMockFile("test.gif", "image/gif", 1024);

    expect(() => validateCustomerMediaFiles([unsupportedFile])).toThrow(
      "รองรับเฉพาะรูปภาพ PNG, JPG, WEBP, HEIC, HEIF หรือ PDF"
    );
  });

  it("should accept all supported MIME types", () => {
    const supportedFiles = [
      createMockFile("test.png", "image/png", 1024),
      createMockFile("test.jpg", "image/jpeg", 1024),
      createMockFile("test.webp", "image/webp", 1024),
      createMockFile("test.heic", "image/heic", 1024),
      createMockFile("test.heif", "image/heif", 1024),
    ];

    expect(() => validateCustomerMediaFiles(supportedFiles)).not.toThrow();
    expect(() =>
      validateCustomerMediaFiles([
        createMockFile("test.pdf", "application/pdf", 1024),
      ])
    ).not.toThrow();
  });
});

describe("getCustomerMediaStorageRuntimeStatus", () => {
  beforeEach(() => {
    clearR2Env();
  });

  it("reports Supabase fallback when R2 env is incomplete", () => {
    process.env.CLOUDFLARE_R2_BUCKET = "customer-media";

    const status = getCustomerMediaStorageRuntimeStatus();

    expect(status.activeProvider).toBe("supabase");
    expect(status.r2Configured).toBe(false);
    expect(status.requiredR2EnvKeys).toEqual([...R2_ENV_KEYS]);
    expect(status.missingR2EnvKeys).toEqual([
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    ]);
  });

  it("reports R2 as active when all required env keys are present", () => {
    setCompleteR2Env();

    const status = getCustomerMediaStorageRuntimeStatus();

    expect(status.activeProvider).toBe("r2");
    expect(status.r2Configured).toBe(true);
    expect(status.requiredR2EnvKeys).toEqual([...R2_ENV_KEYS]);
    expect(status.missingR2EnvKeys).toEqual([]);
  });
});

describe("uploadLeadMediaFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearR2Env();
  });

  it("should return empty array for no files", async () => {
    const result = await uploadLeadMediaFiles({
      supabase: mockSupabase,
      leadId: "test-lead-id",
      files: [],
    });

    expect(result).toEqual([]);
  });

  it("should upload files and insert database records successfully", async () => {
    const mockFiles = [
      createMockFile("test1.jpg", "image/jpeg", 1024),
      createMockFile("test2.pdf", "application/pdf", 2048),
    ];

    // Mock successful storage upload
    vi.mocked(mockSupabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
    } as never);

    // Mock successful database insert
    vi.mocked(mockSupabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(),
    } as never);

    const result = await uploadLeadMediaFiles({
      supabase: mockSupabase,
      leadId: "test-lead-id",
      files: mockFiles,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      lead_id: "test-lead-id",
      original_file_name: "test1.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: 1024,
    });
    expect(result[1]).toMatchObject({
      lead_id: "test-lead-id",
      original_file_name: "test2.pdf", 
      mime_type: "application/pdf",
      file_size_bytes: 2048,
    });

    // Verify storage calls
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("customer-media");

    // Verify database calls
    expect(mockSupabase.from).toHaveBeenCalledWith("lead_media_assets");
  });

  it("should rollback only newly inserted records on storage failure", async () => {
    const mockFiles = [
      createMockFile("test1.jpg", "image/jpeg", 1024),
      createMockFile("test2.jpg", "image/jpeg", 1024),
    ];

    // First upload succeeds, second fails
    const mockUpload = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error("Storage error"));

    const mockRemove = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(mockSupabase.storage.from).mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
      createSignedUrl: vi.fn(),
    } as never);

    // Mock database cleanup
    const mockDeleteChain = {
      in: vi.fn().mockReturnThis(),
    };
    vi.mocked(mockSupabase.from).mockReturnValue({
      insert: vi.fn(),
      delete: vi.fn().mockReturnValue(mockDeleteChain),
    } as never);

    await expect(
      uploadLeadMediaFiles({
        supabase: mockSupabase,
        leadId: "test-lead-id",
        files: mockFiles,
      })
    ).rejects.toThrow("Storage error");

    // Verify cleanup calls
    expect(mockRemove).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("test-lead-id")])
    );
    expect(mockDeleteChain.in).toHaveBeenCalledWith("id", expect.any(Array));
  });

  it("should rollback on database insert failure", async () => {
    const mockFiles = [createMockFile("test.jpg", "image/jpeg", 1024)];

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockRemove = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(mockSupabase.storage.from).mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
      createSignedUrl: vi.fn(),
    } as never);

    // Mock database insert failure
    const mockDeleteChain = {
      in: vi.fn().mockReturnThis(),
    };
    vi.mocked(mockSupabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ 
        error: { message: "Database error" }
      }),
      delete: vi.fn().mockReturnValue(mockDeleteChain),
    } as never);

    await expect(
      uploadLeadMediaFiles({
        supabase: mockSupabase,
        leadId: "test-lead-id", 
        files: mockFiles,
      })
    ).rejects.toThrow("Database error");

    // Verify cleanup happened
    expect(mockRemove).toHaveBeenCalled();
  });

  it("should validate files before upload", async () => {
    const invalidFile = createMockFile("test.gif", "image/gif", 1024);

    await expect(
      uploadLeadMediaFiles({
        supabase: mockSupabase,
        leadId: "test-lead-id",
        files: [invalidFile],
      })
    ).rejects.toThrow("รองรับเฉพาะรูปภาพ PNG, JPG, WEBP, HEIC, HEIF หรือ PDF");

    // Should not attempt any uploads or database operations
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("should upload files to R2 when R2 env is configured", async () => {
    setCompleteR2Env();

    mockR2Send.mockResolvedValue({});
    vi.mocked(mockSupabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(),
    } as never);

    const result = await uploadLeadMediaFiles({
      supabase: mockSupabase,
      leadId: "test-lead-id",
      files: [createMockFile("test.jpg", "image/jpeg", 1024)],
    });

    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    expect(mockR2Send).toHaveBeenCalledTimes(1);
    expect(result[0]).toMatchObject({
      storage_provider: "r2",
      storage_bucket: "customer-media",
    });
  });
});

describe("signLeadMediaAssetPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearR2Env();
  });

  it("should create signed URLs for valid paths", async () => {
    const paths = ["path1.jpg", "path2.pdf"];
    
    const mockCreateSignedUrl = vi.fn()
      .mockResolvedValueOnce({ 
        data: { signedUrl: "https://example.com/signed1" }, 
        error: null 
      })
      .mockResolvedValueOnce({ 
        data: { signedUrl: "https://example.com/signed2" }, 
        error: null 
      });

    vi.mocked(mockSupabase.storage.from).mockReturnValue({
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: mockCreateSignedUrl,
    } as never);

    const result = await signLeadMediaAssetPaths(mockSupabase, paths);

    expect(result).toEqual({
      "path1.jpg": "https://example.com/signed1",
      "path2.pdf": "https://example.com/signed2",
    });

    expect(mockSupabase.storage.from).toHaveBeenCalledWith("customer-media");
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("should skip failed signed URL creation", async () => {
    const paths = ["valid.jpg", "invalid.jpg"];
    
    const mockCreateSignedUrl = vi.fn()
      .mockResolvedValueOnce({ 
        data: { signedUrl: "https://example.com/valid" }, 
        error: null 
      })
      .mockResolvedValueOnce({ 
        data: null, 
        error: { message: "File not found" }
      });

    vi.mocked(mockSupabase.storage.from).mockReturnValue({
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: mockCreateSignedUrl,
    } as never);

    const result = await signLeadMediaAssetPaths(mockSupabase, paths);

    expect(result).toEqual({
      "valid.jpg": "https://example.com/valid",
      // invalid.jpg should be omitted
    });
  });

  it("should handle empty paths array", async () => {
    const result = await signLeadMediaAssetPaths(mockSupabase, []);
    expect(result).toEqual({});
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  it("should create signed URLs for R2-backed assets", async () => {
    setCompleteR2Env();

    mockGetSignedUrl.mockResolvedValue("https://example.com/r2-signed");

    const result = await signLeadMediaAssetPaths(mockSupabase, [
      {
        storage_path: "path-r2.jpg",
        storage_provider: "r2",
        storage_bucket: "customer-media",
      },
    ]);

    expect(result).toEqual({
      "path-r2.jpg": "https://example.com/r2-signed",
    });
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
  });
});
