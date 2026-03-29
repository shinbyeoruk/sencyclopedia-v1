"use client";

import { useState, useEffect } from "react";

/** card ID에 해당하는 이미지 경로 목록을 반환 (빈 배열이면 이미지 없음) */
export function useCardImages(cardId: string | undefined) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cardId) {
      setImages([]);
      return;
    }
    setLoading(true);
    fetch(`/api/images/${encodeURIComponent(cardId)}`)
      .then((r) => r.json())
      .then((data) => setImages(data.images ?? []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, [cardId]);

  return { images, loading };
}
