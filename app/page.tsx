/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useScroll, useMotionValueEvent } from "framer-motion";
import DetailModal, { DetailData } from "@/components/DetailModal";
import sencyDb from "../public/sency_db.json";

// ============================================
// useCardImages: card ID → 이미지 경로 배열
// ============================================
function useCardImages(cardId: string | undefined) {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    if (!cardId) { setImages([]); return; }
    fetch(`/api/images/${encodeURIComponent(cardId)}`)
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []))
      .catch(() => setImages([]));
  }, [cardId]);
  return { images };
}

export type CardItem = {
  type: string;
  src?: string;
  text?: string;
  detail?: DetailData;
};

// ============================================
// 유틸리티 함수
// ============================================
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// ============================================
// 컬러 블록용 개별 컴포넌트 (프로시미티 효과 로직 처리)
// ============================================
const ColorBlockCard = ({
  card,
  mouseX,
  mouseY,
  onCardClick,
  height
}: {
  card: CardItem,
  mouseX: any,
  mouseY: any,
  onCardClick: (v: CardItem) => void,
  height: string
}) => {
  const { images } = useCardImages(card.detail?.cardId);
  const thumbnailSrc = images[0]; // cardId-1 이미지

  const [avgColor, setAvgColor] = useState<string>("#fdfdfc");

  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // thumbnailSrc가 확정되면 평균 컬러 추출
  useEffect(() => {
    if (!thumbnailSrc) {
      setAvgColor("#fdfdfc");
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = thumbnailSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setAvgColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
  }, [thumbnailSrc]);

  // 그리드 내 자신의 '문서 전체 기준의 절대 좌표'를 파악합니다.
  useEffect(() => {
    const updateBox = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setBox({
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          w: rect.width,
          h: rect.height,
        });
      }
    };

    updateBox();

    const observer = new ResizeObserver(updateBox);
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    window.addEventListener("resize", updateBox);
    return () => {
      window.removeEventListener("resize", updateBox);
      observer.disconnect();
    };
  }, []);

  // Framer Motion을 활용한 마우스 근접도(Proximity) 계산 퍼포먼스 최적화
  const opacity = useTransform([mouseX, mouseY], ([x, y]: number[]) => {
    if (box.w === 0) return 0;
    const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
    const dy = Math.max(box.y - y, 0, y - (box.y + box.h));
    const distFromEdge = Math.hypot(dx, dy);
    return distFromEdge <= 120 ? 1 : 0;
  });

  return (
    <motion.div
      ref={cardRef}
      onClick={() => onCardClick(card)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full cursor-pointer overflow-hidden hover:shadow-2xl transition-shadow"
      style={{
        // 이미지가 있으면 원본 비율, 없으면 랜덤 height 유지
        height: (card.type === "image" && thumbnailSrc) ? "auto" : height,
        backgroundColor: avgColor,
      }}
    >
      <motion.div
        className="w-full relative"
        style={{ opacity }}
        transition={{ duration: 0.3 }}
      >
        {card.type === "image" && thumbnailSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnailSrc}
            alt="Moodboard Art"
            className="w-full h-auto block select-none pointer-events-none"
          />
        ) : card.type === "image" ? (
          <div className="w-full bg-[#f0ede4]" style={{ height }} />
        ) : (
          <div className="w-full p-4 flex items-center justify-center bg-[#fdfdfc] border border-[--color-background]/10" style={{ height }}>
            <p className="text-[#4e0000] font-serif text-[10px] md:text-sm leading-relaxed text-justify break-keep pointer-events-none select-none">
              {card.text ? (card.text.length > 50 ? card.text.slice(0, 50) + "..." : card.text) : ""}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// 1. 공통 데이터 (JSON에서 로드)
const generateCards = () => {
  return sencyDb.map((row: any) => {
    // BOM 처리를 위해 키 순회 등 방어적 접근
    const nameKey = Object.keys(row).find(k => k.includes('이름')) || '이름';
    // 모든 키값과 밸류에 대한 정규화 (BOM 및 공백 제거)
    const normalize = (val: any) => typeof val === 'string' ? val.trim() : val;

    const detail: DetailData = {
      name: normalize(row[nameKey] || ""),
      comment: normalize(row['2025 코멘트'] || ""),
      intensity: normalize(row['강도'] || ""),
      number: normalize(row['번호'] || ""),
      date: normalize(row['생성일'] || ""),
      year: normalize(row['연도'] || ""),
      location: normalize(row['장소'] || ""),
      layer: normalize(row['층위'] || ""),
      cardId: normalize(row['카드 ID'] || ""),
      tags: normalize(row['태그'] || ""),
      type: normalize(row['형식'] || ""),
    };

    const type = row['형식'];
    const textStr = row[nameKey] || "";
    const cardId = detail.cardId;

    // 썸네일: /images/{cardId}-1.jpeg 또는 .png (IMG/MIX/TXT 공통 — 이미지가 있으면 표시)
    // 런타임에 확장자를 모르므로 API 없이 src를 null로 두고 ListCard에서 useCardImages로 처리
    if (type === 'IMG' || type === 'MIX') {
      return {
        type: "image",
        src: undefined, // useCardImages 훅으로 대체
        text: textStr,
        detail
      };
    } else {
      return {
        type: "text",
        text: textStr,
        detail
      };
    }
  }).sort((a, b) => {
    // 연도 내림차순 (2025 → 2013)
    const yearDiff = Number(b.detail?.year || 0) - Number(a.detail?.year || 0);
    if (yearDiff !== 0) return yearDiff;
    // 같은 연도면 번호 오름차순
    return Number(a.detail?.number || 0) - Number(b.detail?.number || 0);
  });
};

// ============================================
// 모바일 전용: 스와이프 카드 — 개별 카드
// ============================================
const MobileCard = ({
  card,
  direction,
  onNext,
  onPrev,
  onOpenModal,
  index,
  total,
}: {
  card: CardItem;
  direction: number;
  onNext: () => void;
  onPrev: () => void;
  onOpenModal: () => void;
  index: number;
  total: number;
}) => {
  const { images } = useCardImages(card.detail?.cardId);
  const thumbnailSrc = images[0];

  const variants = {
    enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const dragStartX = useRef(0);

  const handleDragStart = (_: unknown, info: { point: { x: number } }) => {
    dragStartX.current = info.point.x;
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -55) onNext();
    else if (info.offset.x > 55) onPrev();
  };

  return (
    <motion.div
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 flex flex-col px-6 pt-10 pb-28"
      style={{ touchAction: "pan-y" }}
    >
      {/* 상단: card ID (좌) + view 힌트 (우) — 같은 높이 */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-[9px] tracking-[0.22em] font-mono text-[var(--color-foreground)] uppercase opacity-40 select-none">
          {card.detail?.cardId}
        </span>

        {thumbnailSrc && (
          <motion.div
            className="flex items-center gap-1 pointer-events-none select-none"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: [0.85, 0.85, 0.2] }}
            transition={{ duration: 2.2, times: [0, 0.5, 1], ease: "easeOut", delay: 0.3 }}
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"
              className="text-[var(--color-foreground)]"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            <span className="text-[8px] font-mono tracking-[0.18em] uppercase text-[var(--color-foreground)]">
              view
            </span>
          </motion.div>
        )}
      </div>

      {/* 이미지 영역 — 원본 비율, 화면 중앙 */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onClick={thumbnailSrc ? onOpenModal : undefined}
        style={{ cursor: thumbnailSrc ? "pointer" : "default" }}
      >
        {thumbnailSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnailSrc}
            alt=""
            className="max-w-full max-h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
        ) : card.type === "text" ? (
          <div className="w-full px-2 text-center">
            <p className="text-base font-serif leading-[1.8] text-[var(--color-foreground)] break-keep opacity-80">
              {card.text}
            </p>
          </div>
        ) : (
          <div className="w-full h-40 bg-[var(--color-foreground)]/8 flex items-center justify-center">
            <span className="text-[10px] font-mono opacity-20 tracking-widest text-[var(--color-foreground)]">NO IMAGE</span>
          </div>
        )}
      </div>

      {/* 하단: 이름 + 메타 + 모달 버튼 */}
      <div className="mt-7 mb-5 flex flex-col gap-1.5">
        <button onClick={onOpenModal} className="text-left group">
          <h2 className="text-lg font-serif tracking-tight leading-[1.2] uppercase break-keep text-[var(--color-foreground)] group-active:opacity-70 transition-opacity">
            {card.detail?.name}
          </h2>
        </button>
        <div className="flex gap-2.5 font-mono text-[10px] text-[var(--color-foreground)] opacity-45 uppercase tracking-widest">
          {card.detail?.year && <span>{card.detail.year}</span>}
          {card.detail?.layer && <span>· {card.detail.layer}</span>}
          {card.detail?.intensity && <span>· {card.detail.intensity}</span>}
        </div>
      </div>

      {/* 진행 표시 */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono text-[var(--color-foreground)] opacity-35 tracking-widest select-none">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-mono text-[var(--color-foreground)] opacity-25 tracking-widest select-none">
            ← swipe →
          </span>
        </div>
        <div className="w-full h-px bg-[var(--color-foreground)]/15">
          <motion.div
            className="h-full bg-[var(--color-foreground)]/50"
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// 모바일 전용: 스와이프 카드 — 컨테이너
// ============================================
const MobileListView = ({
  cardsData,
  onCardClick,
}: {
  cardsData: CardItem[];
  onCardClick: (card: CardItem) => void;
}) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const goNext = useCallback(() => {
    if (current < cardsData.length - 1) {
      setDirection(1);
      setCurrent((c) => c + 1);
    }
  }, [current, cardsData.length]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      setDirection(-1);
      setCurrent((c) => c - 1);
    }
  }, [current]);

  const card = cardsData[current];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[var(--color-background)]">
      <AnimatePresence mode="wait" custom={direction}>
        <MobileCard
          key={current}
          card={card}
          direction={direction}
          onNext={goNext}
          onPrev={goPrev}
          onOpenModal={() => onCardClick(card)}
          index={current}
          total={cardsData.length}
        />
      </AnimatePresence>
    </div>
  );
};

// ============================================
// 뷰 컴포넌트 1: 3D 대각선 리스트 뷰 (List View)
// ============================================

const ListView = ({ cardsData, onCardClick }: { cardsData: CardItem[], onCardClick: (card: CardItem) => void }) => {
  const [scrollY, setScrollY] = useState(0);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    // 윈도우 사이즈 측정을 위한 초기화 및 리사이즈 핸들러
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    handleResize(); // 마운트 시 최초 실행
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // 한 사이클(전체 카드 한 바퀴)을 도는데 필요한 스크롤 픽셀
    const cycleHeight = 150 * cardsData.length;
    // 초기에는 중간 즈음의 배수 위치에서 시작합니다. (위/아래 양방향 무한스크롤 가능하도록)
    const midPoint = cycleHeight * 100;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;

          // 위 혹은 아래 극단에 닿을 경우 시각적 차이가 없는 위치(cycleHeight 배수 단위)로 리셋합니다.
          if (y < cycleHeight * 10) {
            window.scrollTo({ top: y + cycleHeight * 50, behavior: "instant" });
          } else if (y > cycleHeight * 190) {
            window.scrollTo({ top: y - cycleHeight * 50, behavior: "instant" });
          } else {
            setScrollY(y);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    // window.scrollTo 제거 (자동 스크롤 모션 삭제)
    // window.scrollTo({ top: midPoint, behavior: "instant" });
    setScrollY(midPoint);

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [cardsData]);

  return (
    <div className="relative w-full text-foreground max-w-[100vw] overflow-x-hidden bg-[#FFFFFF]" style={{ height: "300000px" }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .list-card-hitbox {
          transition: z-index 0s 0.6s;
        }
        .list-card-visual {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.19, 1, 0.22, 1), box-shadow 0.6s ease, filter 0.6s ease;
        }
        .list-card-hitbox:hover {
          z-index: 9999 !important;
          transition: z-index 0s 0s;
        }
        .list-card-hitbox:hover .list-card-visual {
          /* 오른쪽 대신 폴더에서 파일을 꺼내듯 위로 뽑혀 나오는 모션(-Y축 상승, 살짝 회전 및 앞으로 돌출) 
          강도를 대폭 완화시켜 너무 과하게 쏘아올려지지 않는 살짝 손으로 들춰보는 듯한 자연스러운 인터랙션
          */
          transform: translate3d(-5px, -80px, 40px) rotateZ(1deg) rotateY(-1deg) !important;
          box-shadow: 0 16px 40px -4px rgba(0,0,0,0.4);
          filter: brightness(1.05); /* 약간 강조 */
        }
      `}} />

      <div className="fixed top-0 left-0 w-full h-[100dvh] pointer-events-none overflow-hidden">
        <div className="w-full h-full relative" style={{ perspective: "1600px", perspectiveOrigin: "35% 50%" }}>
          <div
            className="absolute top-1/2 left-1/2 w-full h-full"
            style={{
              transformStyle: "preserve-3d",
              // 컨테이너는 더이상 이동하지 않습니다. 내부 카드의 위치(모듈로 연산)가 개별적으로 치환됩니다.
              transform: `translate3d(-50%, -50%, 0px)`,
            }}
          >
            <div className="relative w-full h-full">
              {cardsData.map((card, i) => {
                const total = cardsData.length;
                // 스크롤양 기반 무한 위치 진행도 (기존 150에서 스케일 다운에 맞춰 120으로)
                const offset = scrollY / 120;

                // 음수를 처리하는 안정적 모듈로 연산: 연속적인 소수점이 유지됨.
                let relativePos = (i + offset) % total;
                if (relativePos < 0) relativePos += total;

                // 70% 스케일에 맞춘 카드 간의 절대 거리(밀도)
                const distance = 135;

                // 브라우저의 가로/세로 길이를 통해 좌하단-우상단까지의 완벽한 대각선 라인 각도(theta) 도출
                // h: 0일 경우(마운트 전)를 대비한 방어코드
                const w = windowSize.w || 1920;
                const h = windowSize.h || 1080;
                const theta = Math.atan2(-h, w);

                // 삼각 함수로 대각선 벡터 구하기
                const gapX = distance * Math.cos(theta); // 양수 (+)
                const gapY = distance * Math.sin(theta); // 음수 (-)
                const gapZ = -315; // 깊이감(Z축)은 고정

                // 진행도를 0~n에서 -n/2 ~ +n/2로 옮겨서, 화면 정중앙(0,0)을 대각선 궤적의 중심축으로 만듭니다.
                // relativePos는 음수를 포함한 실수형이 유지되므로 부드러운 이동이 보장됩니다.
                const centeredPos = relativePos - (total / 2);

                const x = centeredPos * gapX;
                const y = centeredPos * gapY;
                // Z축은 가장 앞(relativePos=0)일 때 0이 되어야 시야를 가리지 않으므로, 이전처럼 relativePos 기반으로 계산합니다.
                const z = relativePos * gapZ;

                const zIndex = total - Math.floor(relativePos);

                return (
                  <ListCard
                    key={i}
                    card={card}
                    x={x}
                    y={y}
                    z={z}
                    zIndex={zIndex}
                    onCardClick={onCardClick}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ListView 개별 카드 컴포넌트 (썸네일 이미지 원본 비율)
// ============================================
const ListCard = ({
  card, x, y, z, zIndex, onCardClick
}: {
  card: CardItem;
  x: number; y: number; z: number; zIndex: number;
  onCardClick: (card: CardItem) => void;
}) => {
  const { images } = useCardImages(card.detail?.cardId);
  const thumbnailSrc = images[0]; // cardId-1 이미지 (API에서 정렬된 첫 번째)

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div
        onClick={() => onCardClick(card)}
        className="list-card-hitbox absolute top-1/2 left-1/2 pointer-events-auto cursor-pointer"
        style={{
          transform: `translate3d(${x}px, ${y}px, ${z}px)`,
          zIndex,
          transformStyle: "preserve-3d",
          width: "245px",
          marginLeft: "-122px",
          marginTop: "-122px",
        }}
      >
        {/* card ID — 이미지 상단 바깥, 배경 없이 */}
        <div className="pb-2 pointer-events-none">
          <span className="text-[9px] tracking-[0.18em] font-mono text-[#1a1a1a] uppercase leading-tight opacity-70">
            {card.detail?.cardId}
          </span>
        </div>

        <div
          className="list-card-visual overflow-hidden shadow-[0_12px_36px_-9px_rgba(0,0,0,0.25)] bg-[#fdfdfc] flex flex-col will-change-transform pointer-events-none relative"
          style={{ width: "245px" }}
        >
          {card.type === "image" && thumbnailSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailSrc}
                alt="Art"
                className="w-full h-auto select-none block"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent mix-blend-overlay pointer-events-none" />
            </>
          ) : card.type === "image" ? (
            <div className="w-full aspect-square bg-[#f0ede4] flex items-center justify-center">
              <span className="text-[9px] font-mono text-[#1a1a1a]/30 tracking-widest">{card.detail?.cardId}</span>
            </div>
          ) : (
            <div className="w-full min-h-[180px] p-6 flex items-center justify-center bg-[#fdfdfc] text-[#2a2a2a]">
              <p className="text-sm leading-[1.8] text-justify break-keep font-serif tracking-tight">
                {card.text}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// 모바일 전용: 스크롤 Reveal 무드보드 — 개별 카드
// ============================================
const MobileScrollCard = ({
  card,
  onCardClick,
}: {
  card: CardItem;
  onCardClick: (card: CardItem) => void;
}) => {
  const { images } = useCardImages(card.detail?.cardId);
  const thumbnailSrc = images[0];
  const [isRevealed, setIsRevealed] = useState(false);
  const [avgColor, setAvgColor] = useState("#f0ede4");
  const cardRef = useRef<HTMLDivElement>(null);

  // 뷰포트 진입 시 reveal
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect(); // 한 번 reveal되면 해제
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 이미지 평균 컬러 추출 (플레이스홀더 배경)
  useEffect(() => {
    if (!thumbnailSrc) return;
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = thumbnailSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setAvgColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
  }, [thumbnailSrc]);

  return (
    <div
      ref={cardRef}
      onClick={() => onCardClick(card)}
      className="w-full mb-1.5 cursor-pointer overflow-hidden"
      style={{ backgroundColor: avgColor }}
    >
      {card.type === "image" && thumbnailSrc ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isRevealed ? 1 : 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt=""
            className="w-full h-auto block select-none pointer-events-none"
            draggable={false}
          />
        </motion.div>
      ) : card.type === "image" ? (
        // 이미지 로딩 전 플레이스홀더
        <div className="w-full aspect-[3/4] bg-[#f0ede4]" />
      ) : (
        <div className="w-full p-4 bg-[#fdfdfc] flex items-start" style={{ minHeight: "100px" }}>
          <p className="text-[11px] font-serif leading-[1.75] text-[#4e0000] break-keep line-clamp-5">
            {card.text}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// 모바일 전용: 스크롤 Reveal 무드보드 — 컨테이너
// ============================================
const MobileMoodboardView = ({
  cardsData,
  onCardClick,
}: {
  cardsData: CardItem[];
  onCardClick: (card: CardItem) => void;
}) => {
  // 2열 column layout을 위한 홀수/짝수 분리
  const leftCol = cardsData.filter((_, i) => i % 2 === 0);
  const rightCol = cardsData.filter((_, i) => i % 2 === 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-[#FFFFFF] pt-28 pb-28 px-1.5"
    >
      <div className="flex gap-1.5 items-start">
        {/* 왼쪽 열 */}
        <div className="flex-1 flex flex-col gap-1.5">
          {leftCol.map((card, i) => (
            <MobileScrollCard
              key={card.detail?.cardId || `left-${i}`}
              card={card}
              onCardClick={onCardClick}
            />
          ))}
        </div>
        {/* 오른쪽 열 — 자연스러운 엇갈림을 위해 상단 여백 추가 */}
        <div className="flex-1 flex flex-col gap-1.5 mt-8">
          {rightCol.map((card, i) => (
            <MobileScrollCard
              key={card.detail?.cardId || `right-${i}`}
              card={card}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// 뷰 컴포넌트 2: 자유로운 마우스 드래그 무드보드 (Moodboard View)
// ============================================

const MoodboardView = ({ cardsData, onCardClick }: { cardsData: CardItem[], onCardClick: (card: CardItem) => void }) => {
  const [isMounted, setIsMounted] = useState(false);

  // 글로벌 마우스 포인터 (프로시미티 효과 검출에 사용)
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  useEffect(() => {
    setIsMounted(true);
    // window.scrollTo 제거 (자동 스크롤 모션 삭제)
  }, []);

  if (!isMounted) return null;

  return (
    <div
      onMouseMove={(e) => {
        // e.pageY는 문서 전체 픽셀 기준 절대 스크롤 높이이며 화면상의 모든 중첩 요소를 포함합니다.
        // 리랙트된 ColorBlockCard 의 bounds.top + window.scrollY 값과 정확히 호환됩니다.
        mouseX.set(e.pageX);
        mouseY.set(e.pageY);
      }}
      className="moodboard-container bg-[#FFFFFF] w-full min-h-[100vh] pt-32 pb-32 px-4 sm:px-8 md:px-12"
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url('/analog_art_1.png')", backgroundSize: "cover", mixBlendMode: "multiply" }} />

      <div className="max-w-[1600px] mx-auto w-full relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 items-start" style={{ gap: '10px' }}>
        {cardsData.map((card, i) => {
          // 일정한 인덱스를 시드로 활용해 무작위하지만 고정된 높이를 배정합니다.
          // 최소 250px부터 최대 550px까지 에디토리얼한 가변 높이를 만듭니다.
          const hNum = pseudoRandom(i * 100 + 10);
          const rHeight = 200 + (hNum * 300);

          return (
            <ColorBlockCard
              key={card.detail?.cardId || i}
              card={card}
              mouseX={mouseX}
              mouseY={mouseY}
              onCardClick={onCardClick}
              height={`${rHeight}px`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// 뷰 컴포넌트 3: 랜딩 페이지 (Landing View)
// ============================================

const LandingView = ({ onNavigate }: { onNavigate: (mode: "list" | "moodboard" | "note" | "index") => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const [distance, setDistance] = useState(1000);
  const [ceWidth, setCeWidth] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [ceBlinkState, setCeBlinkState] = useState<"initial" | "blinking" | "hidden">("initial");

  const senceRef = useRef<HTMLDivElement>(null);
  const senRef = useRef<HTMLDivElement>(null);
  const ceRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest > 0.01 && ceBlinkState === "initial") {
      setCeBlinkState("blinking");
    } else if (latest <= 0 && ceBlinkState === "hidden") {
      setCeBlinkState("initial");
    }
  });

  useEffect(() => {
    const measure = () => {
      if (senceRef.current && senRef.current && ceRef.current) {
        const totalW = senceRef.current.offsetWidth;
        const senW = senRef.current.offsetWidth;
        const ceW = ceRef.current.offsetWidth;
        setDistance(totalW - senW - ceW);
        setCeWidth(ceW);
        setIsReady(true);
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const senX = useTransform(scrollYProgress, [0, 0.75, 1], [-distance, 0, ceWidth]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="w-full bg-[--color-background] text-[--color-foreground] relative flex flex-col"
    >
      <div ref={containerRef} className="w-full h-[300vh] relative z-0">
        <div className="sticky top-0 left-0 w-full h-[100dvh] flex flex-col justify-start px-6 sm:px-12 pt-16 sm:pt-8 overflow-hidden bg-transparent">

          <div className="w-full flex justify-between items-start z-10 pointer-events-none text-[var(--color-foreground)]">
            <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] tracking-[0.25em] font-light uppercase pt-1 leading-tight sm:leading-tight">
              <span>ENCYCLOPEDIA OF SEOHEE&apos;S</span>
              <span>TEN-YEAR LIFE SENSATIONS</span>
            </div>
            <div className="flex flex-col items-end gap-0.5 sm:gap-1 pr-1 leading-tight sm:leading-tight">
              <span className="text-[10px] sm:text-[11px] tracking-[0.3em] font-light">
                ( 2014 - 2024 )
              </span>
              <span className="text-[11px] sm:text-xs tracking-[0.3em] font-light">
                백감사전
              </span>
            </div>
          </div>

          <div className="flex-1"></div> {/* 여백 조정 */}

          {/* 거대 타이포그래피 (화면 상단 영역에 밀착) */}
          <div
            className="w-full flex flex-col font-serif transition-opacity duration-300"
            style={{ opacity: isReady ? 1 : 0 }}
          >
            {/* SENCE Row (E is right aligned) */}
            <div ref={senceRef} className="flex justify-end w-full leading-[0.8] text-[13vw] sm:text-[14vw] tracking-normal mb-1">
              <motion.div ref={senRef} style={{ x: senX }} className="select-none">
                SEN
              </motion.div>
              <motion.div
                ref={ceRef}
                initial={{ opacity: 0 }}
                animate={
                  ceBlinkState === "initial" ? { opacity: 0 } :
                    ceBlinkState === "blinking" ? { opacity: [0, 1, 0, 1, 0] } :
                      { opacity: 0 }
                }
                transition={
                  ceBlinkState === "blinking" ? { duration: 0.6, times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut" } :
                    { duration: 0 }
                }
                onAnimationComplete={() => {
                  if (ceBlinkState === "blinking") setCeBlinkState("hidden");
                }}
                className="text-[#E9F056] italic select-none"
              >
                CE
              </motion.div>
            </div>
            {/* CYCLOPEDIA Row (A is right aligned, full width spread) */}
            <div className="flex justify-between w-full leading-[0.8] text-[13vw] sm:text-[14vw] tracking-normal">
              {"CYCLOPEDIA".split("").map((letter, i) => (
                <span key={i} className="select-none">{letter}</span>
              ))}
            </div>
            <div className="w-full h-[20vh]"></div>
          </div>

          <div className="absolute bottom-6 left-0 w-full flex justify-center text-center z-10 opacity-30 pointer-events-none">
            <span className="text-[8px] sm:text-[9px] tracking-widest uppercase">
              &copy; GODFLEA PRESS
            </span>
          </div>

        </div>
      </div>

      {/* 300vh 스크롤 이후 슬라이드업 되는 NOTE 색션 */}
      <NoteSection />

    </motion.div>
  );
};

// ============================================
// 전역 내비게이션 푸터 (Global Navigation)
// ============================================
const NavigationFooter = ({ viewMode, onNavigate }: { viewMode: string, onNavigate: (mode: any) => void }) => {
  return (
    <div
      className="fixed bottom-0 left-0 w-full flex justify-center items-center px-6 sm:px-12 z-[10000] py-6 sm:py-8 bg-[var(--color-background)]/90 backdrop-blur-md border-t border-[var(--color-foreground)]/10 text-[var(--color-foreground)] transition-all duration-700"
    >
      <div className="flex flex-wrap justify-between sm:justify-center items-center gap-6 sm:gap-24 w-full max-w-5xl">
        <button
          onClick={() => {
            if (viewMode !== 'landing') onNavigate("landing");
            setTimeout(() => {
              document.getElementById('note-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className={`group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 transition-opacity ${viewMode === 'note' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
          <span className="text-[8px] sm:text-[10px] tracking-[0.1em]">( I )</span>
          <span className={`text-[10px] sm:text-xs tracking-[0.2em] uppercase border-b pb-0.5 ${viewMode === 'note' ? 'border-current' : 'border-transparent group-hover:border-current transition-colors'}`}>Note</span>
        </button>
        <button
          onClick={() => onNavigate("list")}
          className={`group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 transition-opacity ${viewMode === 'list' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
          <span className="text-[8px] sm:text-[10px] tracking-[0.1em]">( II )</span>
          <span className={`text-[10px] sm:text-xs tracking-[0.2em] uppercase border-b pb-0.5 ${viewMode === 'list' ? 'border-current' : 'border-transparent group-hover:border-current transition-colors'}`}>List</span>
        </button>
        <button
          onClick={() => onNavigate("moodboard")}
          className={`group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 transition-opacity ${viewMode === 'moodboard' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
          <span className="text-[8px] sm:text-[10px] tracking-[0.1em]">( III )</span>
          <span className={`text-[10px] sm:text-xs tracking-[0.2em] uppercase border-b pb-0.5 ${viewMode === 'moodboard' ? 'border-current' : 'border-transparent group-hover:border-current transition-colors'}`}>Board</span>
        </button>
        <button
          onClick={() => onNavigate("index")}
          className={`group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 transition-opacity ${viewMode === 'index' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
          <span className="text-[8px] sm:text-[10px] tracking-[0.1em]">( IV )</span>
          <span className={`text-[10px] sm:text-xs tracking-[0.2em] uppercase border-b pb-0.5 ${viewMode === 'index' ? 'border-current' : 'border-transparent group-hover:border-current transition-colors'}`}>Index</span>
        </button>
      </div>
    </div>
  );
};

// ============================================
// 뷰 컴포넌트 4: 노트 섹션 (Note Section & View)
// ============================================

function NoteSection() {
  const romanNumbers = ["I", "II", "III", "IV", "V", "VI", "VII"];

  // 본문과 주석을 하나의 구조로 묶어 관리 (행간 주석 배치를 위함)
  const items = [
    {
      note: "이 사전은 완성된 적이 없으며, 완성될 수도 없다.",
      side: null
    },
    {
      note: "백감사전(Sencyclopedia)은 감각(Sense)과 백과사전(Encyclopedia)의 합성어로, 2014년부터 2024년까지, 아직 무엇이라고 불리기 이전의 감각을 수집하고 분류한 아카이브다. 편집되지 않았다는 것이 이 사전의 유일한 편집 방침이며, 따라서 과잉된 정동은 여과 없이 포착된다.¹⁾",
      side: "¹⁾ 이 점에서 백감사전은 사전이라기보다 일종의 발굴 보고서에 가깝다. 다만 발굴의 대상이 과거가 아니라 아직 이름 붙여지지 않은 현재라는 점에서 통상적인 고고학과는 다르다. 고고학자가 파편에서 문명을 추론하듯, 이 사전의 편찬자는 감각의 파편에서 한 사람의 삶을 추론한다. 비록 그 사람이 자기 자신이라 할지라도."
    },
    {
      note: "각 항목은 '감각 카드'의 형태를 취한다. 카드는 사진과 텍스트, 그리고 다섯 가지 속성 — 레이어, 연도, 강도, 장소, 형식 — 으로 구성되며, 고유한 감각 코드 ID²⁾로 식별된다. 무한한 도서관에 두 권의 동일한 책이 없듯, 이 사전에서 모든 감각은 고유하다. 반복되는 것은 없으며, 그럼에도 모든 것은 반복된다.",
      side: "²⁾ 예컨대 하나의 카드는 `U-2017-006-M-IMG`와 같은 코드를 부여받는다. 이 체계는 도서관의 청구기호를 닮았으나, 분류하는 것은 책이 아니라 신체가 겪은 사건이다. 어떤 분류 체계든 그것이 분류하는 것의 일부를 반드시 배반한다는 사실은, 이 사전에서도 예외가 아니다."
    },
    {
      note: "이 프로젝트는 \"일상은 예술이 될 수 있을까\"라는 질문에서 출발한다. 개인의 삶 속에 출몰하는 강도를 탐구하고 그것을 드라마화하는 예술적 실험이자, 10년의 삶을 갈무리하는 하나의 의식(ritual)이다. 삶을 기록하는 행위가 삶의 일부가 되고, 그 일부가 다시 기록되어야 한다는 점에서, 이 사전은 자기 자신을 항목으로 포함하는 목록과 같은 종류의 역설에 속한다.",
      side: null
    },
    {
      note: "감각 카드가 포착하는 것은 현행화된 강도뿐이다 — 우리가 인지할 수 있는 것은 오직 현행화된 것뿐이므로.³⁾ 그러나 이 작업은 포착된 것 너머, 강도가 다시 어디로 흘러가는지를 더듬으며, 기관 없는 신체를 어렴풋이 가늠해보려는 시도이기도 하다. 지도가 영토를 대신할 수 없듯, 카드는 감각을 대신하지 못한다. 다만 한 사람의 신체 안에서 끊임없이 발생하고 있는 창조적 순간들을 기념할 수는 있다.",
      side: "³⁾ 들뢰즈의 용법을 따른다. 강도(intensité)는 현행화(actualisation)를 통해서만 경험되지만, 현행화된 순간 이미 그것은 원래의 강도와 같지 않다. 거울이 얼굴을 비추되 얼굴 그 자체는 아닌 것처럼. 이 불가피한 간극이 이 사전의 조건이자 한계이다."
    },
    {
      note: "2025년 4월, 난항 콜렉티브⁴⁾에서 첫 시연이 이루어졌다. 진행은 다음과 같았다:\n(ⅰ) Notion을 활용하여 10년간의 감각 경험을 카드로 제작한다.\n(ⅱ) 2025년의 시점에서 코멘트를 덧붙인다. 과거에 작성되거나 창작된 결과물은 다시 경험되며, 새로운 감각으로 발생한다.⁵⁾\n(ⅲ) 제작된 카드는 워크숍 일주일 전 멤버들에게 공유되며, 각자 각각의 카드에 자유롭게 주석을 단다.\n(ⅳ) 4월 27일, 모여서 백감사전을 공유한다. 어디로 흘러가는지 본다.",
      side: [
        "⁴⁾ 난항(難航) 콜렉티브. 좀처럼 순항하지 않는 모임.",
        "⁵⁾ 여기서 '새로운 감각으로 발생한다'는 말은 수사가 아니다. 2017년에 기록된 카드를 2025년에 다시 읽는 행위는 회고가 아니라 반복이며, 들뢰즈적 의미에서 차이를 생산하는 반복이다. 이 사전의 독자는 결국 이 사전의 편찬자가 되고, 편찬자는 다시 독자가 된다. 이 순환에는 출구가 없으며, 아마도 출구가 필요하지도 않다."
      ]
    },
    {
      note: "이 사전이 유용하다면, 그것은 독자가 이 사전 없이도 자신이 감각하고 있음을 지각할 수 있게 되었을 때일 것이다. 좋은 사전이 으레 그렇듯, 이 사전의 최종 목적은 자기 자신을 불필요하게 만드는 데 있다.",
      side: null
    }
  ];

  return (
    <div id="note-section" className="relative z-10 w-full flex flex-col">
      {/* Existing Note Section Content */}
      <div className="w-full min-h-[100dvh] bg-[var(--color-foreground)] text-[var(--color-background)] px-6 sm:px-12 pt-16 pb-16 sm:pt-8 sm:pb-8 flex flex-col justify-center items-center">
        <div className="w-full flex justify-between tracking-widest text-[10px] sm:text-xs uppercase mb-8 sm:mb-12">
          <span>Chapter 1</span>
          <span>Sencyclopedia Note</span>
        </div>

        <div className="w-full flex flex-col gap-24 sm:gap-6">
          <div className="flex flex-col gap-4 w-full">
            <h2 className="text-[7vw] sm:text-[5vw] leading-[1.15] font-serif tracking-tight break-keep text-left" style={{ wordBreak: 'keep-all' }}>
              “그러니까 그녀는 — 그녀의 깊은 생각 속으로 내려가려고 하지 않는다면 어떤 사람인지 분류할 수 없는데, 그녀가 너무도 재미없는 사람이어서 누구도 그런 생각은 하지 않는다 — 그러니까 묵묵히 모험을 겪었던 한 여인이었다. 이상하게도 영적인 모험을 살고 있었던 것이다.”
            </h2>
            <div className="flex flex-col w-full">
              <div className="flex justify-start sm:justify-end pt-2 sm:pt-4 w-full">
                <span className="text-[12px] sm:text-[12px] tracking-[0.1em] font-light">
                  ‘먼 바다로 떠난 이야기’ 중, &lt;세상의 발견&gt;, 클라리시 리스펙토르
                </span>
              </div>
              <div className="flex justify-center w-full mt-20 sm:mt-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/miro.png" alt="Illustration" className="w-[120px] sm:w-[150px] object-contain opacity-85 mix-blend-multiply mx-auto" />
              </div>
            </div>
          </div>

          <div className="flex-1 text-[14px] text-center items-center leading-6 mt-8">
            <p>
              나는 언제나 투명하게 들여다보이고 싶은<sup className="text-[10px] ml-0.5">1)</sup> 동시에 그것을 두려워했다.
            </p>
            <p>
              살아온 길, 사유해 온 방식, 소박하고 작지만 한 개인을 만들어 온 여정을 공유하는 것은 무의미할 수도 있겠다.<br />
              하지만 어쩌면 삶의 순간들을 축복하는 작은 계기가 될 수도 있지 않을까.<br />
              나는 늘 작은 기대에 많은 것을 걸고, 이번에도 마찬가지다.
            </p>
            <p>
              모두의 묵묵한 모험이 계속 되길 바라며.
            </p>
            <div className="flex flex-col gap-1 mt-8">
              <span>2025. 04. 20.</span>
              <span>서희</span>
            </div>
            <div className="text-[12px] w-full mt-8">
              <p>
                ¹⁾ 김복희, 『희망은 사랑을 한다』 시인의 말 "나는 아주 투명하게 들여다보이고 싶다." 꽤 오래 나의 SNS 프로필 소개글이었다.
              </p>
            </div>
            <div className="w-full h-[15vh]"></div>
          </div>
        </div>
      </div>

      {/* New Editorial Note Section (White Background + Sidenotes Layout) */}
      <div id="editorial-note" className="w-full bg-[#FFFFFF] text-[#4e0000] px-6 sm:px-12 py-8 sm:py-12 flex flex-col items-center">
        <div className="max-w-[1100px] w-full flex flex-col">
          <h3 className="text-[14px] tracking-[0.4em] font-serif uppercase mb-24 text-center lg:text-left">
            일러두기
          </h3>

          <div className="flex flex-col gap-16 sm:gap-20">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 lg:grid-cols-[60px_1fr_300px] gap-6 lg:gap-12 relative items-start">
                {/* 1. 로마자 */}
                <span className="text-xl sm:text-2xl font-serif tracking-tighter text-left lg:text-right leading-[1.2] pt-0.5">
                  {romanNumbers[index]}
                </span>

                {/* 2. 본문 */}
                <div className="flex flex-col">
                  <span className="block text-[13px] sm:text-[14.5px] leading-[1.8] sm:leading-[1.95] font-serif text-justify break-keep whitespace-pre-wrap">
                    {item.note}
                  </span>
                  {/* 모바일에서의 주석 배치 (LG 미만) */}
                  {item.side && (
                    <div className="mt-6 flex flex-col gap-3 lg:hidden p-4 bg-[#4e0000]/[0.03] border-l border-[#4e0000]/20">
                      {Array.isArray(item.side) ? (
                        item.side.map((s, i) => (
                          <p key={i} className="text-[11px] sm:text-[12px] leading-[1.7] font-serif text-justify opacity-80">
                            {s}
                          </p>
                        ))
                      ) : (
                        <p className="text-[11px] sm:text-[12px] leading-[1.7] font-serif text-justify opacity-80">
                          {item.side}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. 데스크탑에서의 행간 주석 (LG 이상) */}
                <div className="hidden lg:flex flex-col gap-4 sticky top-32">
                  {item.side && (
                    <div className="flex flex-col gap-4 pl-8 border-l border-[#4e0000]/10">
                      {Array.isArray(item.side) ? (
                        item.side.map((s, i) => (
                          <p key={i} className="text-[11.5px] leading-[1.7] font-serif text-justify opacity-80 tracking-tight">
                            {s}
                          </p>
                        ))
                      ) : (
                        <p className="text-[11.5px] leading-[1.7] font-serif text-justify opacity-80 tracking-tight">
                          {item.side}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="w-full h-[15vh]"></div>
        </div>
      </div>
    </div>
  );
}


const NoteView = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="w-full bg-[var(--color-background)]"
    >
      <NoteSection />
    </motion.div>
  );
};

// ============================================
// 메인 라우트 (상태에 따라 뷰 전환)
// ============================================
// ============================================
// Index View Component (테이블 뷰)
// ============================================
const IndexView = ({ cardsData }: { cardsData: CardItem[] }) => {
  const [hoveredCard, setHoveredCard] = useState<CardItem | null>(null);
  const [heldCard, setHeldCard] = useState<CardItem | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const handleRowClick = (card: CardItem) => {
    const id = (card.detail?.cardId || "").trim();
    if (!id) return;

    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setHeldCard(card);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-[100dvh] pt-32 pb-12 px-4 sm:px-8 flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]"
    >
      {/* 1. 타이틀 섹션 — 스크롤 시 먼저 밀려 올라감 */}
      <div className="flex flex-col mb-[24px] max-w-[1600px] w-full mx-auto px-4 sm:px-0">
        <h1 className="text-[10vw] sm:text-8xl md:text-9xl font-serif tracking-[0.02em] uppercase mb-8 text-[#FCDE76] leading-[0.85]">
          SENCYCLOPEDIA <br className="sm:hidden" />
          <span className="text-[#845f2a]">INDEX</span>
        </h1>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8 border-b border-[#FCDE76]/30 pb-12">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] sm:text-[11px] tracking-[0.1em] uppercase font-mono leading-normal text-[#FCDE76]">
              └ WORK INDEX
            </p>
            <p className="text-[10px] sm:text-[11px] tracking-[0.05em] uppercase font-mono leading-relaxed text-[#FCDE76] max-w-2xl">
              * A CURATED COLLECTION OF SENSORY DATA → INCLUDING IMAGES, TEXT, IDEAS, <br className="hidden sm:block" />
              AND MEMORIES *
            </p>
          </div>
          <div className="text-[10px] sm:text-[11px] tracking-[0.1em] text-left sm:text-right font-mono text-[#FCDE76] leading-relaxed">
            ┌ LEGEND<br />
            ■ IMG / MIX<br />
            ○ TXT
          </div>
        </div>
      </div>

      {/* 2. 리스트 및 프리뷰 섹션 — 분리된 영역 */}
      <div className="flex flex-col lg:flex-row flex-1 border border-[var(--color-foreground)]/40 relative max-w-[1600px] w-full mx-auto mt-0 bg-[var(--color-background)]">
        {/* Left Table Section */}
        <div className="flex-1 lg:border-r border-[var(--color-foreground)]/40 flex flex-col">
          {/* Table Header */}
          <div className="flex border-b border-[var(--color-foreground)]/40 bg-[var(--color-foreground)]/5 font-mono text-[9px] sm:text-[10px] md:text-xs">
            <div className="w-10 sm:w-16 flex-shrink-0 border-r border-[var(--color-foreground)]/40 flex items-center justify-center py-3">
              ID
            </div>
            <div className="flex-1 border-r border-[var(--color-foreground)]/40 flex px-3 sm:px-4 items-center py-3 uppercase tracking-widest">
              └ TITLE
            </div>
            <div className="w-24 sm:w-32 md:w-48 border-r border-[var(--color-foreground)]/40 px-3 sm:px-4 items-center hidden sm:flex py-3 uppercase tracking-widest">
              └ LAYER
            </div>
            <div className="w-20 sm:w-28 border-r border-[var(--color-foreground)]/40 px-3 sm:px-4 items-center hidden md:flex py-3 uppercase tracking-widest">
              └ TYPE
            </div>
            <div className="w-16 sm:w-24 px-3 sm:px-4 items-center flex py-3 uppercase tracking-widest">
              └ YEAR
            </div>
          </div>

          {/* Table Body - 스크롤 앵커링 오작동 방지를 위해 강력한 차단 적용 */}
          <div className="flex flex-col w-full" style={{ overflowAnchor: 'none', WebkitOverflowScrolling: 'touch' }}>
            {cardsData.map((card, i) => (
              <IndexRow
                key={card.detail?.cardId || i}
                card={card}
                isExpanded={expandedCardIds.has((card.detail?.cardId || "").trim())}
                onRowClick={handleRowClick}
                onHover={setHoveredCard}
              />
            ))}
          </div>
        </div>

        {/* Right Preview Section — 데스크톱 전용 (상단 고정 sticky) */}
        <div className="w-full lg:w-[350px] xl:w-[450px] flex-shrink-0 lg:sticky lg:top-10 max-h-[90vh] overflow-y-auto custom-scrollbar hidden lg:block border-l lg:border-l border-[var(--color-foreground)]/40 bg-[var(--color-background)]">
          {(hoveredCard || heldCard) ? (
            <IndexPreviewPanel card={hoveredCard || (heldCard as CardItem)} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-12 opacity-20">
              <span className="text-lg xl:text-xl tracking-widest mb-4 font-mono">PREVIEW</span>
              <span className="text-[10px] font-mono uppercase tracking-widest">Hover or click an item</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// IndexView 개별 행 컴포넌트 (환경별 최적화)
// ============================================
const IndexRow = ({
  card, isExpanded, onRowClick, onHover
}: {
  card: CardItem;
  isExpanded: boolean;
  onRowClick: (card: CardItem) => void;
  onHover: (card: CardItem | null) => void;
}) => {
  const cardId = card.detail?.cardId || "";

  return (
    <div className="relative border-b border-[var(--color-foreground)]/40 w-full">
      {/* 제목행 (Row) */}
      <div
        onMouseEnter={() => onHover(card)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onRowClick(card)}
        className={`flex w-full transition-colors cursor-pointer group font-mono text-[11px] sm:text-xs md:text-sm
          ${isExpanded ? 'bg-[var(--color-foreground)]/20' : 'hover:bg-[var(--color-foreground)]/10'}`}
      >
        <div className="w-10 sm:w-16 flex-shrink-0 border-r border-[var(--color-foreground)]/40 flex items-center justify-center py-3 sm:py-4">
          {card.type === 'image' ? '■' : '○'}
        </div>
        <div className="flex-1 border-r border-[var(--color-foreground)]/40 flex px-3 sm:px-4 items-center py-3 sm:py-4 font-serif tracking-tight uppercase break-keep text-[#eaddbc]">
          {card.detail?.name}
        </div>
        <div className="w-24 sm:w-32 md:w-48 border-r border-[var(--color-foreground)]/40 px-3 sm:px-4 items-center hidden sm:flex py-3 sm:py-4 uppercase opacity-80">
          {card.detail?.layer}
        </div>
        <div className="w-16 sm:w-24 px-3 sm:px-4 items-center flex py-3 sm:py-4 uppercase opacity-80 relative">
          {card.detail?.year}
          <span className="absolute right-3 transition-transform duration-300 opacity-60 text-[10px]" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            ▼
          </span>
        </div>
      </div>

      {/* 모바일 전용 아코디언 — lg 이상(데스크톱)에서는 숨김 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <div className="w-full bg-[var(--color-foreground)]/5 overflow-hidden lg:hidden">
            <MobileAccordion card={card} cardId={cardId} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// IndexView 우측 프리뷰 패널 (이미지 + 코멘트)
// ============================================
const IndexPreviewPanel = ({ card }: { card: CardItem }) => {
  const { images } = useCardImages(card.detail?.cardId);

  return (
    <motion.div
      key={card.detail?.cardId}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col w-full p-6 sm:p-8 xl:p-10 gap-8"
    >
      {/* 제목 + ID */}
      <div className="pb-4 border-b border-[var(--color-foreground)]/40">
        <h3 className="text-2xl xl:text-3xl font-serif tracking-tight leading-[1.2] uppercase break-keep mb-2">
          {card.detail?.name}
        </h3>
        <span className="text-[10px] xl:text-[11px] opacity-60 font-mono tracking-widest uppercase">
          ID: {card.detail?.cardId}
        </span>
      </div>

      {/* 이미지 수직 1열 */}
      {images.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[9px] uppercase tracking-widest font-mono opacity-40">Images</span>
          {images.map((src) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={src} src={src} alt="" className="w-full h-auto object-contain" style={{ display: "block" }} />
          ))}
        </div>
      )}

      {/* 2025 코멘트 */}
      <div>
        <span className="text-[9px] uppercase opacity-40 tracking-widest font-mono block mb-3">
          2025 Retrospect
        </span>
        <p className="text-sm xl:text-base leading-[1.8] xl:leading-[1.9] break-keep whitespace-pre-wrap font-serif">
          {card.detail?.comment || "No comment provided for this entry."}
        </p>
      </div>
    </motion.div>
  );
};

// ============================================
// 모바일 아코디언 (이미지 + 코멘트)
// ============================================
const MobileAccordion = ({ card, cardId }: { card: CardItem; cardId: string }) => {
  const { images } = useCardImages(card.detail?.cardId);

  return (
    <motion.div
      key={`accordion-${cardId}`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-visible border-b border-[var(--color-foreground)]/40"
      style={{ backgroundColor: "rgba(234, 221, 188, 0.05)" }}
    >
      <div className="px-4 pt-4 pb-12 flex flex-col gap-6">
        {/* 제목 + ID */}
        <div className="pb-3 border-b border-[var(--color-foreground)]/20">
          <h3 className="text-base font-serif tracking-tight leading-[1.2] uppercase break-keep mb-1.5 text-[var(--color-foreground)]">
            {card.detail?.name}
          </h3>
          <span className="text-[9px] opacity-50 font-mono tracking-widest uppercase">
            ID: {card.detail?.cardId}
          </span>
        </div>
        {/* 메타 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] opacity-60 uppercase tracking-widest">
          {card.detail?.year && <span>{card.detail.year}</span>}
          {card.detail?.layer && <span>· {card.detail.layer}</span>}
          {card.detail?.type && <span>· {card.detail.type}</span>}
        </div>
        {/* 이미지 */}
        {images.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[9px] uppercase tracking-widest font-mono opacity-40">Images</span>
            {images.map((src) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={src} src={src} alt="" className="w-full h-auto object-contain" style={{ display: "block" }} />
            ))}
          </div>
        )}
        {/* 2025 코멘트 */}
        <div>
          <span className="block text-[9px] uppercase tracking-widest font-mono opacity-40 mb-2">
            2025 Retrospect
          </span>
          <p className="text-[13px] leading-[1.85] break-keep whitespace-pre-wrap font-serif text-[var(--color-foreground)] opacity-90">
            {card.detail?.comment || "No comment provided for this entry."}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default function Home() {
  const [viewMode, setViewMode] = useState<"landing" | "list" | "moodboard" | "note" | "index">("landing");
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 방대한 카드를 원하셨으므로 CSV 데이터 전체를 매핑합니다.
  const cardsData = useMemo(() => generateCards(), []);

  // 모바일 감지 (768px 미만 = 모바일)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      {/* 랜딩 뷰가 아닐 때만 상단 로고(홈버튼) 렌더링 */}
      {viewMode !== 'landing' && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => setViewMode("landing")}
        >
          <div
            className="w-10 sm:w-12 h-10 sm:h-12 transition-colors duration-300"
            style={{
              backgroundColor: (viewMode === 'index') ? '#FCDE76' : '#4e0000',
              maskImage: 'url(/miro.png)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/miro.png)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
        </div>
      )}

      {/* 전역 내비게이션 (어떤 뷰에서든 최하단 동일하게 고정) */}
      <NavigationFooter viewMode={viewMode} onNavigate={setViewMode} />

      {viewMode === "landing" && <LandingView onNavigate={setViewMode} />}

      {viewMode === "list" && (
        isMobile
          ? <MobileListView cardsData={cardsData} onCardClick={setSelectedCard} />
          : <ListView cardsData={cardsData} onCardClick={setSelectedCard} />
      )}

      {viewMode === "moodboard" && (
        isMobile
          ? <MobileMoodboardView cardsData={cardsData} onCardClick={setSelectedCard} />
          : <MoodboardView cardsData={cardsData} onCardClick={setSelectedCard} />
      )}

      {viewMode === "note" && <NoteView />}

      {viewMode === "index" && (
        <IndexView cardsData={cardsData} />
      )}

      {/* 모달 애니메이션 관리 */}
      <AnimatePresence>
        {selectedCard && (
          <DetailModal
            detail={selectedCard.detail}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
