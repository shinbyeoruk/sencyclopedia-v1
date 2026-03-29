"use client";

import { motion } from "framer-motion";

export type DetailData = {
  name: string;
  comment: string;
  intensity: string;
  number: string;
  date: string;
  year: string;
  location: string;
  layer: string;
  cardId: string;
  tags: string;
  type: string;
};

type Props = {
  detail?: DetailData;
  onClose: () => void;
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] items-baseline py-1.5">
      <span className="text-[13px] sm:text-[14px] font-sans text-[#1a1a1a] opacity-80">{label}:</span>
      <span className="text-[13px] sm:text-[14px] font-sans text-[#1a1a1a] break-keep font-medium">{value}</span>
    </div>
  );
}

export default function DetailModal({ detail, onClose }: Props) {
  const data = detail || {
    name: "Sample Data",
    comment: "This is a sample comment for preview...",
    intensity: "M",
    number: "1",
    date: "2025",
    year: "2025",
    location: "Seoul",
    layer: "Study",
    cardId: "S-2025-001-M-IMG",
    tags: "Test",
    type: "IMG"
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/20 backdrop-blur-[2px] sm:px-12 pt-12"
    >
      <motion.div
        initial={{ y: "100%", scale: 0.8 }}
        animate={{ y: 0, scale: 0.8 }}
        exit={{ y: "100%", scale: 0.8 }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        style={{ transformOrigin: "bottom center" }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1440px] h-[85vh] sm:h-[90vh] bg-[#f7f4e9] text-[#1a1a1a] shadow-[0_-10px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col rounded-t-lg sm:rounded-t-xl"
      >
        {/* 상단 닫기 헤더 영역 */}
        <div className="flex justify-between items-center px-6 sm:px-10 py-5 sm:py-6 border-b border-[#1a1a1a]/10 shrink-0">
          <span className="text-xs sm:text-sm tracking-widest uppercase font-sans">
            Sencyclopedia Archive
          </span>
          <button 
            onClick={onClose} 
            className="text-2xl opacity-40 hover:opacity-100 transition-opacity font-light leading-none"
          >
            ×
          </button>
        </div>
        
        {/* 2단 레이아웃 콘텐츠 영역 */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* 좌측: 정보 영역 */}
          <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col p-6 sm:p-10 md:p-12 border-b md:border-b-0 md:border-r border-[#1a1a1a]/10 overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight leading-[1.1] mb-10 sm:mb-16 text-[#1a1a1a] break-keep">
              {data.name}
            </h2>
            
            <div className="flex flex-col w-full">
              <InfoRow label="Year" value={data.year} />
              <InfoRow label="Date" value={data.date} />
              <InfoRow label="Location" value={data.location} />
              <InfoRow label="Layer" value={data.layer} />
              <InfoRow label="Intensity" value={data.intensity} />
              <InfoRow label="Type" value={data.type} />
              <InfoRow label="Tags" value={data.tags} />
              <InfoRow label="Card ID" value={data.cardId} />
            </div>

            {/* Inquire about this piece (장식용 레퍼런스 차용) */}
            <div className="mt-16 pt-6 border-t border-[#1a1a1a]/10">
              <span className="text-[11px] sm:text-xs font-sans underline underline-offset-4 opacity-60 hover:opacity-100 cursor-pointer transition-opacity uppercase tracking-widest text-[#1a1a1a]">
                View more references
              </span>
            </div>
          </div>
          
          {/* 우측: 2025 코멘트 배경(스크롤 가능) */}
          <div className="w-full md:w-[55%] lg:w-[60%] p-6 sm:p-10 md:p-16 overflow-y-auto bg-[#f4f0df] custom-scrollbar">
            <div className="max-w-3xl">
              <span className="block text-xs sm:text-sm tracking-widest uppercase mb-6 sm:mb-10 font-sans opacity-40">
                2025 Retrospect
              </span>
              <div 
                className="text-base sm:text-lg md:text-xl leading-[1.8] md:leading-[1.9] font-serif tracking-tight text-[#2a2a2a] whitespace-pre-wrap break-keep"
                style={{ wordBreak: 'keep-all' }}
              >
                {data.comment || "No comment provided for this entry."}
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
