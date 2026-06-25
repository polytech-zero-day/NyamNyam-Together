// 백엔드 Edge Function 호출용 fetch 래퍼.
//  - base URL/쿼리 조립, JWT(Authorization) 및 apikey 헤더 자동 첨부
//  - 타임아웃(AbortController), 에러 응답을 ApiError로 정규화
//  - 응답 본문은 JSON 파싱(2xx면 그대로 반환, 202 NOT_READY 포함)
import { API_BASE_URL, SUPABASE_ANON_KEY, API_TIMEOUT_MS } from "../config/env";
import { getToken } from "./tokenStore";

/** 백엔드 공통 에러 본문 형태({ code, message }). */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  status?: string;
}

/** 모든 API 실패(HTTP 4xx/5xx·네트워크·타임아웃)는 이 타입으로 던진다. */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly body: unknown;

  constructor(httpStatus: number, code: string, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Authorization 헤더 첨부 여부(기본 true). 로그인/익명 토큰 발급은 false. */
  auth?: boolean;
  signal?: AbortSignal;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, signal } = options;

  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (SUPABASE_ANON_KEY) headers["apikey"] = SUPABASE_ANON_KEY;
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new ApiError(0, "TIMEOUT", "요청 시간이 초과됐어요");
    throw new ApiError(0, "NETWORK", "네트워크 연결을 확인해주세요");
  }
  clearTimeout(timer);

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const errBody = (data ?? {}) as ApiErrorBody;
    throw new ApiError(
      res.status,
      errBody.code ?? "ERROR",
      errBody.message ?? `요청에 실패했어요 (${res.status})`,
      data,
    );
  }

  return data as T;
}
