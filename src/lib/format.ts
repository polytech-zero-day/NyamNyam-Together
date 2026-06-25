// 표시용 포맷 헬퍼.

// store deadline("YYYY-MM-DD HH:MM") → 좁은 칸에서 한 줄로 들어가는 간결 표기 "M/D HH:MM".
// 값이 없거나 형식이 안 맞으면 "마감 미정".
export function compactDeadline(deadline: string | null | undefined): string {
  if (!deadline) return "마감 미정";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?$/.exec(deadline.trim());
  if (!m) return deadline;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const time = m[4] ? ` ${m[4]}` : "";
  return `${month}/${day}${time}`;
}
