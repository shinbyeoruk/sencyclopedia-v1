/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
            <p className="text-[--color-background] font-serif text-[10px] md:text-sm leading-relaxed text-justify break-keep pointer-events-none select-none">
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
    const detail: DetailData = {
      name: row[nameKey] || "",
      comment: row['2025 코멘트'] || "",
      intensity: row['강도'] || "",
      number: row['번호'] || "",
      date: row['생성일'] || "",
      year: row['연도'] || "",
      location: row['장소'] || "",
      layer: row['층위'] || "",
      cardId: row['카드 ID'] || "",
      tags: row['태그'] || "",
      type: row['형식'] || "",
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
  });
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

    window.scrollTo({ top: midPoint, behavior: "instant" });
    setScrollY(midPoint);
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [cardsData]);

  return (
    <div className="relative w-full text-foreground max-w-[100vw] overflow-x-hidden bg-[#faf9f6]" style={{ height: "300000px" }}>
      <style dangerouslySetInnerHTML={{__html: `
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
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 text-[9px] tracking-widest font-mono text-[#1a1a1a] border border-black/5 shadow-sm">
                {card.detail?.cardId}
              </div>
            </>
          ) : card.type === "image" ? (
            // 이미지 로딩 중 플레이스홀더
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
// 뷰 컴포넌트 2: 자유로운 마우스 드래그 무드보드 (Moodboard View)
// ============================================

const MoodboardView = ({ cardsData, onCardClick }: { cardsData: CardItem[], onCardClick: (card: CardItem) => void }) => {
  const [isMounted, setIsMounted] = useState(false);

  // 글로벌 마우스 포인터 (프로시미티 효과 검출에 사용)
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  useEffect(() => {
    setIsMounted(true);
    window.scrollTo({ left: 0, top: 0, behavior: "instant" });
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
      className="moodboard-container bg-[#f7f4e9] w-full min-h-[100vh] py-20 px-4 sm:px-8 md:px-12 pb-32"
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
        <div className="sticky top-0 left-0 w-full h-[100dvh] flex flex-col justify-start px-6 sm:px-12 pt-10 sm:pt-16 overflow-hidden bg-transparent">
          
          <div className="w-full flex justify-between items-start z-10 pointer-events-none text-[var(--color-foreground)]">
            <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] tracking-[0.25em] font-light uppercase opacity-80 pt-1 leading-tight sm:leading-tight">
              <span>ENCYCLOPEDIA OF SEOHEE&apos;S</span>
              <span>TEN-YEAR LIFE SENSATIONS</span>
            </div>
            <div className="flex flex-col items-end gap-1.5 sm:gap-2 pr-1 leading-tight sm:leading-tight">
              <span className="text-[10px] sm:text-[11px] tracking-[0.3em] font-light opacity-60">
                ( 2014 - 2024 )
              </span>
              <span className="text-[11px] sm:text-xs tracking-[0.3em] font-light opacity-80 mt-0.5">
                백감사전
              </span>
            </div>
          </div>

          <div className="w-full h-[10vh] sm:h-[12vh]"></div> {/* 여백 조정 */}

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
                className="text-[#A6E8F7] italic select-none"
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
  return (
    <div id="note-section" className="relative z-10 w-full min-h-[100dvh] bg-[var(--color-foreground)] text-[var(--color-background)] px-6 sm:px-12 pt-16 pb-32 sm:pt-24 sm:pb-48 flex flex-col justify-center items-center">
      <div className="w-full flex justify-between tracking-widest text-[10px] sm:text-xs opacity-50 uppercase mb-16 sm:mb-24 mt-8 sm:mt-12">
        <span>Chapter 1</span>
        <span>Sencyclopedia Note</span>
      </div>

      <div className="w-full flex flex-col gap-24 sm:gap-32">
        
        {/* 인용구 영역 (화면을 가득 채우는 거대 서체) */}
        <div className="flex flex-col gap-8 w-full">
          <h2 className="text-[7vw] sm:text-[5vw] leading-[1.15] font-serif tracking-tight break-keep text-left" style={{ wordBreak: 'keep-all' }}>
            “그러니까 그녀는 — 그녀의 깊은 생각 속으로 내려가려고 하지 않는다면 어떤 사람인지 분류할 수 없는데, 그녀가 너무도 재미없는 사람이어서 누구도 그런 생각은 하지 않는다 — 그러니까 묵묵히 모험을 겪었던 한 여인이었다. 이상하게도 영적인 모험을 살고 있었던 것이다.”
          </h2>
          <div className="flex flex-col w-full">
            <div className="flex justify-start sm:justify-end pt-2 sm:pt-4 w-full">
              <span className="text-[13px] sm:text-[14px] tracking-[0.1em] font-light opacity-80">
                ‘먼 바다로 떠난 이야기’ 중, &lt;세상의 발견&gt;, 클라리시 리스펙토르
              </span>
            </div>
            {/* 인용구 하단 공간 및 miro 일러스트 가운데 정렬 */}
            <div className="flex justify-center w-full mt-16 sm:mt-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/miro.png" alt="Illustration" className="w-[120px] sm:w-[150px] object-contain opacity-85 mix-blend-multiply mx-auto" />
            </div>
          </div>
        </div>

        {/* 본문 편지 영역 */}
        <div className="flex flex-col gap-8 text-sm sm:text-base leading-[1.8] break-keep max-w-2xl mx-auto w-full font-serif pb-12 mt-12 sm:mt-0 text-center items-center">
          <p>
            나는 언제나 투명하게 들여다보이고 싶은(1) 동시에 그것을 두려워했다.
          </p>
          <p>
            살아온 길, 사유해 온 방식, 소박하고 작지만 한 개인을 만들어 온 여정을 공유하는 것은 <br />
            무의미할 수도 있겠다.<br />
            하지만 어쩌면 삶의 순간들을 축복하는 작은 계기가 될 수도 있지 않을까.<br />
            나는 늘 작은 기대에 많은 것을 걸고, 이번에도 마찬가지다.
          </p>
          <p>
            모두의 묵묵한 모험이 계속 되길 바라며.
          </p>
          <div className="w-full mt-8">
            <p>
              (1) 김복희, 『희망은 사랑을 한다』 시인의 말 "나는 아주 투명하게 들여다보이고 싶다." 꽤 오래 나의 SNS 프로필 소개글이었다.
            </p>
          </div>
          <div className="flex flex-col gap-1 mt-8">
            <span>2025. 04. 20.</span>
            <span>서희</span>
          </div>
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
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const handleRowClick = (card: CardItem) => {
    const id = card.detail?.cardId || null;
    setExpandedCardId(prev => (prev === id ? null : id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-[100dvh] pt-32 pb-24 px-4 sm:px-8 flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]"
    >
      <div className="flex flex-col mb-12 border-b border-[var(--color-foreground)]/40 pb-6 max-w-[1600px] w-full mx-auto">
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-sans tracking-widest uppercase mb-4 text-[var(--color-foreground)]">
          SENCYCLOPEDIA <span className="opacity-40">INDEX</span>
        </h1>
        <div className="flex justify-between items-end mt-4">
          <p className="text-[10px] sm:text-xs tracking-widest uppercase font-mono leading-relaxed opacity-70">
            └ WORK INDEX <br />
            * a curated collection of sensory data → including images, text, ideas, and memories *
          </p>
          <div className="text-[9px] sm:text-[10px] tracking-widest text-right font-mono opacity-60">
            ┌ LEGEND<br/>
            ■ IMG / MIX<br/>
            ○ TXT
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 border border-[var(--color-foreground)]/40 relative max-w-[1600px] w-full mx-auto">
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

          {/* Table Body */}
          <div className="flex flex-col">
            {cardsData.map((card, i) => {
              const cardId = card.detail?.cardId || String(i);
              const isExpanded = expandedCardId === cardId;

              return (
                <React.Fragment key={cardId}>
                  {/* 행 */}
                  <div
                    onMouseEnter={() => setHoveredCard(card)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onClick={() => handleRowClick(card)}
                    className={`flex border-b border-[var(--color-foreground)]/40 transition-colors cursor-pointer group font-mono text-[11px] sm:text-xs md:text-sm ${isExpanded ? 'bg-[var(--color-foreground)]/15' : 'hover:bg-[var(--color-foreground)]/10'}`}
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
                    <div className="w-20 sm:w-28 border-r border-[var(--color-foreground)]/40 px-3 sm:px-4 items-center hidden md:flex py-3 sm:py-4 uppercase opacity-80">
                      {card.detail?.type}
                    </div>
                    <div className="w-16 sm:w-24 px-3 sm:px-4 items-center flex py-3 sm:py-4 uppercase opacity-80 relative">
                      {card.detail?.year}
                      {/* 모바일: 열림/닫힘 인디케이터 / 데스크톱: 화살표 */}
                      <span className="absolute right-3 transition-all duration-300 lg:hidden opacity-60 text-[10px]">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                      <span className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block">→</span>
                    </div>
                  </div>

                  {/* 모바일 전용 아코디언 — lg 이상에서는 숨김 */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <MobileAccordion card={card} cardId={cardId} />
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </div>
          <div className="h-12 bg-transparent border-b border-[var(--color-foreground)]/40 border-dashed opacity-50"></div>
        </div>

        {/* Right Preview Section — 데스크톱 전용 */}
        <div className="w-full lg:w-[350px] xl:w-[450px] flex-shrink-0 lg:sticky lg:top-32 max-h-[80vh] overflow-y-auto custom-scrollbar hidden lg:block">
          {hoveredCard ? (
            <IndexPreviewPanel card={hoveredCard} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-12 opacity-20">
              <span className="text-lg xl:text-xl tracking-widest mb-4 font-mono">PREVIEW</span>
              <span className="text-[10px] font-mono uppercase tracking-widest">Hover over an item</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
      className="overflow-hidden lg:hidden border-b border-[var(--color-foreground)]/40"
      style={{ backgroundColor: "rgba(234, 221, 188, 0.08)" }}
    >
      <div className="px-4 py-5 flex flex-col gap-4">
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
  
  // 방대한 카드를 원하셨으므로 CSV 데이터 전체를 매핑합니다.
  const cardsData = useMemo(() => generateCards(), []);

  return (
    <>
      {/* 랜딩 뷰가 아닐 때만 상단 로고(홈버튼) 렌더링 */}
      {viewMode !== 'landing' && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => setViewMode("landing")}
        >
          <h2
            className={`text-lg sm:text-xl tracking-[0.2em] uppercase select-none ${viewMode === 'index' ? 'text-[#f7f4e9]' : 'text-[#4A151C]'}`}
            style={{ fontFamily: "'Playfair Display SC Bold', serif" }}
          >
            SENCYCLOPEDIA
          </h2>
        </div>
      )}

      {/* 전역 내비게이션 (어떤 뷰에서든 최하단 동일하게 고정) */}
      <NavigationFooter viewMode={viewMode} onNavigate={setViewMode} />

      {viewMode === "landing" && <LandingView onNavigate={setViewMode} />}
      
      {viewMode === "list" && (
        <ListView cardsData={cardsData} onCardClick={setSelectedCard} />
      )}
      
      {viewMode === "moodboard" && (
        <MoodboardView cardsData={cardsData} onCardClick={setSelectedCard} />
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
