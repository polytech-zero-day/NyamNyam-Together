// ⚠️⚠️ B 소유 영역 임시 브리지(shim) ⚠️⚠️ (CLAUDE.md §0 핸드오프)
// 상태전환(collecting→aggregating→voting)·마감 트리거·votes 원본 집계는 B 소유다.
// B 브랜치가 아직 없어 데모 동작을 위해 상태전환 shim만 둔다.
// **B 병합 시 이 파일은 B 정본으로 교체**하고, 우리 연결점은 recommend() 호출뿐이다.
//
// ⚠️ TEMP: votes 원본 집계(예산 종합·다수결·표수)는 제거됨(B 소유). 여기서는 B가 제공할
//    AggregatedConstraints 대신 **중립 placeholder**로 recommend()를 호출한다.
//    → 실제 그룹 제약(술/예산/카테고리)이 반영되지 않으므로, 그 사실을 런타임 WARN으로 노출한다.

import { supabase } from '../config/supabase';
import { recommend } from './recommend';
import type { AggregatedConstraints, Station } from '../domain/types';

// ── TEMP(B 소유): B 집계 미연동 시 사용할 중립 placeholder 제약 ──────────────
// 술 분포 0,0,0 → compatible+general 허용 / budgetMax=∞ → 예산 필터 사실상 무효 /
// categories 없음 → 카테고리 가점 없음. B가 실제 AggregatedConstraints를 넘기면 이 경로는 사라진다.
const NEUTRAL_CONSTRAINTS: AggregatedConstraints = {
  drink: { drinker: 0, ok: 0, uncomfortable: 0 },
  budgetMin: 0,
  budgetMax: Number.POSITIVE_INFINITY,
  categories: [],
  moodDominant: null,
};
// ── /TEMP(B 소유) ─────────────────────────────────────────────────────────────

/**
 * 집계 실행: collecting → aggregating → voting (B 소유 상태머신, 임시 shim).
 * 우리 연결점은 recommend() 호출 한 곳뿐.
 */
export async function aggregate(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'aggregating' })
    .eq('id', sessionId)
    .eq('status', 'collecting')
    .select('station_id')
    .single();

  if (error || !session) return; // 이미 처리 중이거나 상태 불일치

  const stationId = session.station_id as string;

  try {
    // 역 좌표는 station_places(우리 소유)에서 조회 — Nearby 호출 좌표원
    const { data: stationMeta } = await supabase
      .from('station_places')
      .select('station_lat, station_lng')
      .eq('station_id', stationId)
      .single();
    if (!stationMeta) throw new Error(`station_places not found: ${stationId}`);

    const station: Station = {
      id: stationId,
      lat: Number(stationMeta.station_lat),
      lng: Number(stationMeta.station_lng),
    };

    // ⚠️ TEMP: B 집계 미연동 — 중립 제약으로 추천 생성. B 병합 시 실제 AggregatedConstraints로 교체.
    console.warn(
      `[TEMP][aggregate] B 집계 미연동 → 중립 placeholder 제약으로 추천 생성 ` +
        `(session=${sessionId}, station=${stationId}). 그룹 술/예산/카테고리 미반영.`,
    );

    // ★ 우리(C) 소유 연결점 — B가 산출할 AggregatedConstraints 자리에 중립값을 넣는다(임시).
    await recommend(sessionId, NEUTRAL_CONSTRAINTS, station);

    await supabase
      .from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  } catch (err) {
    // 실패 시 collecting으로 롤백(영구 고착 방지 → 재시도 가능)
    console.error(`aggregate 실패 (${sessionId}) — collecting으로 롤백:`, err);
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  }
}

/** 마감시간 Lazy 체크: now > deadline 이면 집계 트리거 (B 소유, 임시 shim). */
export async function checkDeadlineAndAggregate(sessionId: string): Promise<void> {
  const { data: session } = await supabase
    .from('sessions')
    .select('status, deadline')
    .eq('id', sessionId)
    .single();

  if (!session) return;
  if (session.status !== 'collecting') return;
  if (!session.deadline) return;
  if (new Date() <= new Date(session.deadline as string)) return;

  await aggregate(sessionId);
}
