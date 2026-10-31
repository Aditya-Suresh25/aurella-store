"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type ReviewImage = { id: string | number; url: string; alt?: string };

export function ReviewImageGallery({ images, label = "Customer photo" }: { images: ReviewImage[]; label?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ReviewImage | null>(null);

  function openImage(image: ReviewImage) {
    setSelected(image);
    dialogRef.current?.showModal();
  }

  return <>
    <div className="review-gallery">{images.map((image, index) => <button
      className="review-image-trigger"
      key={image.id}
      type="button"
      onClick={() => openImage(image)}
      aria-label={`Open ${label.toLowerCase()} ${index + 1}`}
    >
      <span className="review-image"><Image src={image.url} alt={image.alt ?? `${label} ${index + 1}`} fill sizes="(max-width: 640px) 28vw, 8rem" /></span>
    </button>)}</div>
    <dialog
      ref={dialogRef}
      className="review-lightbox"
      aria-label="Expanded review photo"
      onClose={() => setSelected(null)}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
    >
      {selected && <div className="review-lightbox-frame">
        <Image src={selected.url} alt={selected.alt ?? label} fill sizes="100vw" priority />
        <button className="review-lightbox-close" type="button" onClick={() => dialogRef.current?.close()} aria-label="Close photo">×</button>
      </div>}
    </dialog>
  </>;
}
