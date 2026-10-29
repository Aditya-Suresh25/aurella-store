import { asc } from "drizzle-orm";
import { categories, products } from "@/db/schema";
import { db } from "@/lib/db";
import { formatProductPrice } from "@/db/queries";
import { deleteProduct, saveProduct, setProductActive, updateInventory } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
const fields = [
  ["name", "Name"], ["slug", "Slug (optional; generated from name)"], ["description", "Description"], ["descriptor", "Listing descriptor"],
  ["price", "Price in USD"], ["currency", "Currency"], ["badge", "Badge (optional)"], ["image_url", "Listing image URL"], ["image_alt", "Listing image description"],
  ["detail_image_url", "Detail image URL"], ["detail_image_alt", "Detail image description"], ["note", "Product note"], ["stock_quantity", "Available stock"], ["sort_order", "Sort order"],
] as const;
const fieldKeys: Record<string, keyof typeof products.$inferSelect> = {
  name: "name", slug: "slug", description: "description", descriptor: "descriptor", price: "priceCents", currency: "currency", badge: "badge",
  image_url: "imageUrl", image_alt: "imageAlt", detail_image_url: "detailImageUrl", detail_image_alt: "detailImageAlt", note: "note", stock_quantity: "stockQuantity", sort_order: "sortOrder",
};

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [items, departments] = await Promise.all([db.select().from(products).orderBy(asc(products.sortOrder)), db.select().from(categories).orderBy(asc(categories.sortOrder))]);
  function editor(product?: typeof items[number]) {
    return <form action={saveProduct} className="admin-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="admin-form-grid">
        {fields.map(([name, label]) => <label className="admin-field" key={name}>{label}<input name={name} defaultValue={product ? (name === "price" ? (product.priceCents / 100).toFixed(2) : String(product[fieldKeys[name]] ?? "")) : (name === "currency" ? "USD" : name === "stock_quantity" || name === "sort_order" ? "0" : "")} required={name !== "slug" && name !== "badge"} />
          {name === "price" && <span>Displayed in cents in the database.</span>}
        </label>)}
        <label className="admin-field">Category<select name="category_id" defaultValue={product?.categoryId ?? departments[0]?.id} required>{departments.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.isActive ? " (archived)" : ""}</option>)}</select></label>
      </div>
      <button className="button" type="submit">{product ? "Save product" : "Create product"}</button>
    </form>;
  }
  return <>
    <header className="admin-page-heading"><div><p className="eyebrow">Catalog</p><h1 className="admin-title">Products</h1></div><span>{items.length} total</span></header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Add to catalog</p><h2>New product</h2></div></div>{departments.length ? editor() : <p className="admin-empty">Create a category before adding products.</p>}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Catalog records</p><h2>Manage products</h2></div></div>
      {items.map((product) => <details className="admin-record" key={product.id}><summary><span><strong>{product.name}</strong><small>{product.slug} · {formatProductPrice(product.priceCents, product.currency)} · {product.stockQuantity} in stock</small></span><span className={product.isActive ? "admin-status admin-status--paid" : "admin-status"}>{product.isActive ? "Active" : "Archived"}</span></summary>
        <div className="admin-record-body">{editor(product)}<div className="admin-inline-actions"><form action={updateInventory} className="admin-inline-form"><input type="hidden" name="id" value={product.id}/><label className="admin-field">Set available stock<input type="number" name="stock_quantity" min="0" step="1" defaultValue={product.stockQuantity} required /></label><button className="button button--outline" type="submit">Update stock</button></form>
          <form action={setProductActive}><input type="hidden" name="id" value={product.id}/><input type="hidden" name="active" value={String(!product.isActive)}/><button className="button button--outline" type="submit">{product.isActive ? "Archive" : "Restore"}</button></form>
          <form action={deleteProduct}><input type="hidden" name="id" value={product.id}/><button className="button button--outline" type="submit">Delete permanently</button></form>
        </div></div>
      </details>)}
    </section>
  </>;
}
