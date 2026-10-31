import Link from "next/link";
import { ReviewImageGallery } from "@/app/review-image-gallery";
import type { ReviewSort } from "@/lib/review-service";
import { ReviewForm } from "@/app/products/[slug]/review-form";

type ReviewData = Awaited<ReturnType<typeof import("@/lib/review-service").getProductReviewData>>;
type CustomerReview = { rating: number; title: string; comment: string; status: string; images: { url: string; publicId: string }[] } | null;

function stars(value: number) { return "★".repeat(value) + "☆".repeat(5 - value); }

export function ReviewsPanel({ productSlug, data, review, userId, eligible, filters }: {
  productSlug: string; data: ReviewData; review: CustomerReview; userId: string | null; eligible: boolean;
  filters: { rating?: number; photosOnly: boolean; verifiedOnly: boolean; sort: ReviewSort; page: number };
}) {
  const urlForPage = (page: number) => {
    const params = new URLSearchParams();
    if (filters.rating) params.set("rating", String(filters.rating));
    if (filters.photosOnly) params.set("photos", "1");
    if (filters.verifiedOnly) params.set("verified", "1");
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    params.set("page", String(page));
    return `/products/${productSlug}?${params.toString()}#product-reviews`;
  };
  return <section id="product-reviews" className="product-reviews page-shell" aria-labelledby="reviews-title">
    <div className="review-section-heading">
      <div><p className="eyebrow">Customer notes</p><h2 id="reviews-title" className="type-heading">Reviews</h2></div>
      <a className="review-score-link" href="#review-list"><strong>{data.totalApproved ? data.average.toFixed(1) : "—"}</strong><span className="review-stars" aria-label={`${data.average.toFixed(1)} out of 5 stars`}>{data.totalApproved ? stars(Math.round(data.average)) : "☆☆☆☆☆"}</span><small>{data.totalApproved} {data.totalApproved === 1 ? "review" : "reviews"}</small></a>
    </div>
    <div className="review-layout">
      <aside className="review-summary">
        <div className="review-average"><strong>{data.totalApproved ? data.average.toFixed(1) : "—"}</strong><span className="review-stars">{data.totalApproved ? stars(Math.round(data.average)) : "☆☆☆☆☆"}</span><small>Based on {data.totalApproved} approved reviews</small></div>
        <div className="review-breakdown">{[...data.histogram].reverse().map((row) => <div className="review-breakdown-row" key={row.rating}><span>{row.rating} stars</span><span className="review-meter"><i style={{ width: `${data.totalApproved ? (row.count / data.totalApproved) * 100 : 0}%` }} /></span><small>{row.count}</small></div>)}</div>
        <div className="review-write-box"><p className="eyebrow">Share your experience</p>
          {eligible ? <ReviewForm productSlug={productSlug} review={review} /> : !userId ? <><p>Sign in and purchase this piece to leave a verified review.</p><Link className="button button--outline" href={`/sign-in?returnTo=${encodeURIComponent(`/products/${productSlug}#product-reviews`)}`}>Sign in</Link></> : <p>Reviews are reserved for customers with a completed paid order for this piece.</p>}
        </div>
      </aside>
      <div className="review-list-column" id="review-list">
        <form className="review-filters" method="get" action={`/products/${productSlug}#product-reviews`}>
          <label>Rating<select name="rating" defaultValue={filters.rating ?? ""}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></label>
          <label>Sort<select name="sort" defaultValue={filters.sort}><option value="newest">Newest</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select></label>
          <label className="review-check-filter"><input type="checkbox" name="photos" value="1" defaultChecked={filters.photosOnly} /> With photos</label>
          <label className="review-check-filter"><input type="checkbox" name="verified" value="1" defaultChecked={filters.verifiedOnly} /> Verified buyers</label>
          <button className="button button--outline" type="submit">Apply</button>
        </form>
        {data.reviews.length ? <div className="review-list">{data.reviews.map((item) => <article className="review-card" key={item.id}>
          <header><div><span className="review-stars" aria-label={`${item.rating} out of 5 stars`}>{stars(item.rating)}</span><h3>{item.title}</h3></div><time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time></header>
          <p className="review-byline">By {item.reviewer} <span>·</span> <span className="verified-badge">✓ Verified buyer</span></p>
          <p className="review-comment">{item.comment}</p>
          {item.images.length > 0 && <ReviewImageGallery images={item.images.map((image, index) => ({ ...image, alt: `Customer photo ${index + 1}` }))} />}
        </article>)}</div> : <p className="review-empty">{data.totalApproved ? "No reviews match these filters." : "No reviews yet. Purchase this piece and share the first note."}</p>}
        {data.pageCount > 1 && <nav className="review-pagination" aria-label="Review pages"><span>Page {data.page} of {data.pageCount}</span><div>{data.page > 1 && <Link href={urlForPage(data.page - 1)}>← Previous</Link>}{data.page < data.pageCount && <Link href={urlForPage(data.page + 1)}>Next →</Link>}</div></nav>}
      </div>
    </div>
  </section>;
}
