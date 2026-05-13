import type {
  LineGateway,
  LineProfile,
  PushRequest,
  ReplyRequest,
} from "@/lib/line";

type FakeLineGatewayFailureMode = boolean | string | Error;

export type FakeLineGatewayCall =
  | {
      method: "replyMessage";
      occurredAt: string;
      request: ReplyRequest;
    }
  | {
      method: "pushMessage";
      occurredAt: string;
      request: PushRequest;
    }
  | {
      method: "getProfile";
      occurredAt: string;
      userId: string;
    };

export type FakeLineGatewayOptions = {
  defaultDisplayName?: string;
  profiles?: Record<string, Partial<LineProfile>>;
  failReplyMessage?: FakeLineGatewayFailureMode;
  failPushMessage?: FakeLineGatewayFailureMode;
  failGetProfile?: FakeLineGatewayFailureMode;
};

function toError(method: string, failureMode?: FakeLineGatewayFailureMode) {
  if (!failureMode) {
    return null;
  }

  if (failureMode instanceof Error) {
    return failureMode;
  }

  if (typeof failureMode === "string" && failureMode.trim()) {
    return new Error(failureMode);
  }

  return new Error(`Fake LINE gateway forced ${method} failure`);
}

export class FakeLineGateway implements LineGateway {
  private readonly options: FakeLineGatewayOptions;
  private readonly calls: FakeLineGatewayCall[] = [];

  constructor(options: FakeLineGatewayOptions = {}) {
    this.options = options;
  }

  getCalls(): FakeLineGatewayCall[] {
    return [...this.calls];
  }

  getReplyCalls() {
    return this.calls.filter(
      (call): call is Extract<FakeLineGatewayCall, { method: "replyMessage" }> =>
        call.method === "replyMessage"
    );
  }

  getPushCalls() {
    return this.calls.filter(
      (call): call is Extract<FakeLineGatewayCall, { method: "pushMessage" }> =>
        call.method === "pushMessage"
    );
  }

  clear() {
    this.calls.length = 0;
  }

  async replyMessage(request: ReplyRequest) {
    this.calls.push({
      method: "replyMessage",
      occurredAt: new Date().toISOString(),
      request,
    });

    const error = toError("replyMessage", this.options.failReplyMessage);
    if (error) {
      throw error;
    }

    return undefined;
  }

  async pushMessage(request: PushRequest) {
    this.calls.push({
      method: "pushMessage",
      occurredAt: new Date().toISOString(),
      request,
    });

    const error = toError("pushMessage", this.options.failPushMessage);
    if (error) {
      throw error;
    }

    return undefined;
  }

  async getProfile(userId: string) {
    this.calls.push({
      method: "getProfile",
      occurredAt: new Date().toISOString(),
      userId,
    });

    const error = toError("getProfile", this.options.failGetProfile);
    if (error) {
      throw error;
    }

    const override = this.options.profiles?.[userId];
    const displayName = override?.displayName ?? this.options.defaultDisplayName ?? "ลูกค้าจำลอง";

    return {
      userId,
      displayName,
      pictureUrl: override?.pictureUrl ?? null,
      statusMessage: override?.statusMessage ?? null,
      language: "th",
    } as LineProfile;
  }
}

export function createFakeLineGateway(options?: FakeLineGatewayOptions) {
  return new FakeLineGateway(options);
}