"use client";

import { useActionState } from "react";
import Image from "next/image";
import { saveProductReviewAction, type ReviewFormState } from "@/app/products/[slug]/review-actions";

type ExistingReview = {
  rating: number;
  title: string;
  comment: string;
  status: string;
  images: { url: string; publicId: string }[];
};

export function ReviewForm({ productSlug, review }: { productSlug: string; review: ExistingReview | null }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(saveProductReviewAction, {});
  return <form action={action} className="review-form">
    <input type="hidden" name="productSlug" value={productSlug} />
    {review && <p className="review-status-note">Your review is {review.status}. Saving changes sends it for approval again.</p>}
    <fieldset className="review-rating-field">
      <legend className="eyebrow">Your rating</legend>
      <div className="review-star-picker">
        {[5, 4, 3, 2, 1].map((value) => <label key={value} aria-label={`${value} ${value === 1 ? "star" : "stars"}`}>
          <input type="radio" name="rating" value={value} defaultChecked={review?.rating === value || (!review && value === 5)} required />
          <span aria-hidden="true">★</span>
        </label>)}
      </div>
    </fieldset>
    <label className="review-field">Title<input name="title" type="text" minLength={3} maxLength={120} defaultValue={review?.title} required /></label>
    <label className="review-field">Your experience<textarea name="comment" minLength={10} maxLength={3000} rows={5} defaultValue={review?.comment} required /></label>
    {review?.images.length ? <fieldset className="review-photo-keep">
      <legend className="eyebrow">Keep existing photos</legend>
      <div className="review-photo-grid">{review.images.map((image) => <label key={image.publicId}>
        <Image src={image.url} alt="Previously uploaded review" width={96} height={120} sizes="96px" />
        <span><input type="checkbox" name="keepImage" value={image.publicId} defaultChecked /> Keep photo</span>
      </label>)}</div>
    </fieldset> : null}
    <label className="review-field">Add photos <span className="review-field-hint">JPEG or PNG · up to 3 total · 5 MB each</span>
      <input name="photos" type="file" accept="image/jpeg,image/png" multiple />
    </label>
    {state.error && <p className="review-message review-message--error" role="alert">{state.error}</p>}
    {state.success && <p className="review-message" role="status">{state.success}</p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Submitting…" : review ? "Save review" : "Submit review"}</button>
    <p className="review-form-note">Reviews are checked by our team before they appear publicly.</p>
  </form>;
}
