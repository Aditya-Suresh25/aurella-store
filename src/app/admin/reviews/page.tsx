import Link from "next/link";
import { moderateProductReview } from "@/app/admin/actions";
import { ReviewImageGallery } from "@/app/review-image-gallery";
import { getAdminReviews } from "@/lib/review-service";

export const dynamic = "force-dynamic";
const statuses = ["pending", "approved", "hidden"] as const;
type Status = typeof statuses[number];

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; notice?: string }> }) {
  const query = await searchParams;
  const status: Status = statuses.includes(query.status as Status) ? query.status as Status : "pending";
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await getAdminReviews(status, page);
  const pageCount = result.pageCount;
  const pageHref = (value: number) => `/admin/reviews?status=${status}&page=${value}`;
  return <>
    <header className="admin-page-heading"><div><p className="eyebrow">Customer feedback</p><h1 className="admin-title">Reviews</h1></div><span>{result.total} {status}</span></header>
    {query.notice && <p className="admin-notice" role="status">{query.notice}</p>}
    <nav className="review-admin-tabs" aria-label="Review moderation status">{statuses.map((value) => <Link key={value} href={`/admin/reviews?status=${value}`} aria-current={value === status ? "page" : undefined}>{value} reviews</Link>)}</nav>
    {result.rows.length ? <div className="admin-review-list">{result.rows.map((review) => <article className="admin-review-card" key={review.id}>
      <header><div><p className="eyebrow">{review.rating} of 5 stars · {review.createdAt.toLocaleString()}</p><h2>{review.title}</h2></div><span className={`admin-status ${review.status === "approved" ? "admin-status--paid" : review.status === "pending" ? "admin-status--pending" : ""}`}>{review.status}</span></header>
      <p className="admin-review-meta"><Link href={`/products/${review.productSlug}`}>{review.productName}</Link> · {review.reviewer} · {review.email}</p>
      <p className="admin-review-comment">{review.comment}</p>
      {review.images.length > 0 && <ReviewImageGallery images={review.images.map((image, index) => ({ ...image, id: image.publicId, alt: `Review photo ${index + 1}` }))} label="Review photo" />}
      <div className="admin-review-actions">
        {review.status !== "approved" && <form action={moderateProductReview}><input type="hidden" name="review_id" value={review.id}/><input type="hidden" name="status" value="approved"/><button type="submit" className="button">Approve</button></form>}
        {review.status !== "hidden" && <form action={moderateProductReview}><input type="hidden" name="review_id" value={review.id}/><input type="hidden" name="status" value="hidden"/><button type="submit" className="button button--outline">Hide</button></form>}
      </div>
    </article>)}</div> : <p className="admin-empty">There are no {status} reviews.</p>}
    {pageCount > 1 && <nav className="review-pagination" aria-label="Review queue pages"><span>Page {result.page} of {pageCount}</span><div>{result.page > 1 && <Link href={pageHref(result.page - 1)}>← Previous</Link>}{result.page < pageCount && <Link href={pageHref(result.page + 1)}>Next →</Link>}</div></nav>}
  </>;
}
