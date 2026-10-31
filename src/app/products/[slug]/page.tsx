import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartCountLink, ProductPurchasePanel } from "@/app/cart-store";
import { AccountControl } from "@/app/account-control";
import { formatProductPrice, getProductBySlug } from "@/db/queries";
import { getCurrentUserId } from "@/lib/bag-service";
import { getCustomerReview, getProductReviewData, getVerifiedOrder, type ReviewSort } from "@/lib/review-service";
import { ReviewsPanel } from "@/app/products/[slug]/reviews-panel";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const queryValue = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const rawRating = Number(queryValue("rating"));
  const rating = Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : undefined;
  const rawSort = queryValue("sort");
  const sort: ReviewSort = rawSort === "highest" || rawSort === "lowest" ? rawSort : "newest";
  const userId = await getCurrentUserId();
  const rawPage = Number(queryValue("page"));
  const filters = { rating, photosOnly: queryValue("photos") === "1", verifiedOnly: queryValue("verified") === "1", sort, page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1 };
  const [reviews, purchase, customerReview] = await Promise.all([
    getProductReviewData(product.id, filters),
    userId ? getVerifiedOrder(userId, product.id) : Promise.resolve(null),
    userId ? getCustomerReview(userId, product.id) : Promise.resolve(null),
  ]);

  const price = formatProductPrice(product.priceCents, product.currency);
  const stockStatus = product.stockQuantity === 0
    ? "Out of stock"
    : product.stockQuantity <= 5
      ? "Low stock"
      : "In stock";

  return (
    <>
      <header className="site-header">
        <div className="product-nav page-shell">
          <Link className="product-back text-link" href="/new-arrivals">← Back to new arrivals</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="product-header-actions">
            <AccountControl className="product-account-link" />
            <CartCountLink className="product-bag-link" />
          </div>
        </div>
      </header>

      <main className="product-detail page-shell">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/new-arrivals">New arrivals</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-detail-grid">
          <div className="product-gallery" aria-label={`${product.name} imagery`}>
            <div className="product-detail-image product-detail-image--main">
              <Image src={product.imageUrl} alt={product.imageAlt} fill priority sizes="(max-width: 767px) 100vw, 58vw" />
            </div>
            <div className="product-detail-image product-detail-image--secondary">
              <Image src={product.detailImageUrl} alt={product.detailImageAlt} fill sizes="(max-width: 767px) 100vw, 28vw" />
            </div>
          </div>

          <aside className="product-information">
            <Link className="eyebrow product-category-link" href={`/collections/${product.categorySlug}`}>
              {product.categoryName} · {product.descriptor}
            </Link>
            <h1 className="product-detail-title">{product.name}</h1>
            <a className="product-review-summary-link" href="#product-reviews"><span className="review-stars">{reviews.totalApproved ? "★".repeat(Math.round(reviews.average)) + "☆".repeat(5 - Math.round(reviews.average)) : "☆☆☆☆☆"}</span><span>{reviews.totalApproved ? `${reviews.average.toFixed(1)} · ${reviews.totalApproved} ${reviews.totalApproved === 1 ? "review" : "reviews"}` : "No reviews yet"}</span></a>
            <p className="product-detail-price">{price}</p>
            <p className="product-stock"><span className={`stock-indicator${stockStatus === "In stock" ? "" : " stock-indicator--low"}`} />{stockStatus}</p>
            <ProductPurchasePanel product={{ slug, stockQuantity: product.stockQuantity }} initialNotice={queryValue("bagNotice")} />
            <hr className="rule product-detail-rule" />
            <p className="product-detail-description">{product.description}</p>
            <p className="product-detail-note">{product.note}</p>
            <div className="product-care-note">
              <span>Made with care</span>
              <span>Thoughtful materials, made for repeat wear.</span>
            </div>
            <Link className="text-link product-continue-link" href="/new-arrivals">Continue exploring <span aria-hidden="true">↗</span></Link>
          </aside>
        </div>
      </main>

      <ReviewsPanel productSlug={slug} data={reviews} review={customerReview} userId={userId} eligible={Boolean(purchase)} filters={filters} />

      <section className="product-detail-footer" aria-label="More from Aurel">
        <p className="eyebrow">Aurel, by design</p>
        <p>Well made things for the everyday.</p>
        <Link href="/">Return to the studio <span aria-hidden="true">↗</span></Link>
      </section>
    </>
  );
}
