/**
 * Inlined subset of @psm/mcp-core-ts error utilities.
 *
 * The full @psm/mcp-core-ts package uses a local `file:` reference that is
 * unavailable in CI / Render builds. Only the symbols actually consumed by
 * solmail-mcp are duplicated here so the project stays self-contained.
 */

export type PsmMcpErrorKind =
  | "InputValidation"
  | "ShellExec"
  | "PolicyViolation"
  | "Timeout"
  | "Sandbox"
  | "Config"
  | "RateLimited"
  | "NotFound"
  | "PermissionDenied"
  | "Internal";

const ERROR_CODES: Record<PsmMcpErrorKind, number> = {
  InputValidation: -32602,
  ShellExec: -32603,
  PolicyViolation: -32604,
  Timeout: -32605,
  Sandbox: -32606,
  Config: -32607,
  RateLimited: -32608,
  NotFound: -32609,
  PermissionDenied: -32610,
  Internal: -32603,
};

export class PsmMcpError extends Error {
  readonly kind: PsmMcpErrorKind;
  readonly code: number;

  constructor(kind: PsmMcpErrorKind, message: string) {
    super(message);
    this.name = "PsmMcpError";
    this.kind = kind;
    this.code = ERROR_CODES[kind];
  }

  static inputValidation(msg: string): PsmMcpError {
    return new PsmMcpError("InputValidation", `input validation failed: ${msg}`);
  }

  static shellExec(msg: string): PsmMcpError {
    return new PsmMcpError("ShellExec", `shell execution failed: ${msg}`);
  }

  static policyViolation(msg: string): PsmMcpError {
    return new PsmMcpError("PolicyViolation", `policy violation: ${msg}`);
  }

  static timeout(ms: number): PsmMcpError {
    return new PsmMcpError("Timeout", `timeout after ${ms}ms`);
  }

  static sandbox(msg: string): PsmMcpError {
    return new PsmMcpError("Sandbox", `sandbox error: ${msg}`);
  }

  static config(msg: string): PsmMcpError {
    return new PsmMcpError("Config", `configuration error: ${msg}`);
  }

  static rateLimited(retryAfterSecs: number): PsmMcpError {
    return new PsmMcpError("RateLimited", `rate limited: retry after ${retryAfterSecs}s`);
  }

  static notFound(msg: string): PsmMcpError {
    return new PsmMcpError("NotFound", `not found: ${msg}`);
  }

  static permissionDenied(msg: string): PsmMcpError {
    return new PsmMcpError("PermissionDenied", `permission denied: ${msg}`);
  }

  static internal(msg: string): PsmMcpError {
    return new PsmMcpError("Internal", msg);
  }
}

const PATH_RE = /(?:\/[a-zA-Z0-9._\-]+){3,}/g;

/**
 * Strip file paths, truncate to maxLen chars, redact tokens longer than 40 chars.
 */
export function sanitizeError(msg: string, maxLen = 300): string {
  const stripped = msg.replace(PATH_RE, "[PATH]");
  const words = stripped.split(/\s+/);
  let out = "";
  for (const word of words) {
    const part = word.length > 40 ? "[REDACTED]" : word;
    if (out.length + part.length + 1 >= maxLen) {
      return out.slice(0, maxLen) + "...";
    }
    out += (out ? " " : "") + part;
  }
  return out;
}
