import { asc } from "drizzle-orm";
import { categories } from "@/db/schema";
import { db } from "@/lib/db";
import { deleteCategory, saveCategory, setCategoryActive } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

function CategoryForm({ category }: { category?: typeof categories.$inferSelect }) {
  return <form action={saveCategory} className="admin-form">
    {category && <input type="hidden" name="id" value={category.id} />}
    <div className="admin-form-grid">
      <label className="admin-field">Name<input name="name" defaultValue={category?.name} required /></label>
      <label className="admin-field">Slug (optional)<input name="slug" defaultValue={category?.slug} /></label>
      <label className="admin-field">Short note<input name="note" defaultValue={category?.note} required /></label>
      <label className="admin-field">Image URL<input name="image_url" defaultValue={category?.imageUrl} required /></label>
      <label className="admin-field">Image description<input name="image_alt" defaultValue={category?.imageAlt} required /></label>
      <label className="admin-field">Sort order<input name="sort_order" type="number" min="0" step="1" defaultValue={category?.sortOrder ?? 0} required /></label>
    </div>
    <button className="button" type="submit">{category ? "Save category" : "Create category"}</button>
  </form>;
}

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const items = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  return <>
    <header className="admin-page-heading"><div><p className="eyebrow">Catalog structure</p><h1 className="admin-title">Categories</h1></div><span>{items.length} total</span></header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Add a department</p><h2>New category</h2></div></div><CategoryForm /></section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Catalog structure</p><h2>Manage categories</h2></div></div>
      {items.map((category) => <details className="admin-record" key={category.id}><summary><span><strong>{category.name}</strong><small>{category.slug} · {category.note}</small></span><span className={category.isActive ? "admin-status admin-status--paid" : "admin-status"}>{category.isActive ? "Active" : "Archived"}</span></summary>
        <div className="admin-record-body"><CategoryForm category={category}/><div className="admin-inline-actions"><form action={setCategoryActive}><input type="hidden" name="id" value={category.id}/><input type="hidden" name="active" value={String(!category.isActive)}/><button className="button button--outline" type="submit">{category.isActive ? "Archive" : "Restore"}</button></form><form action={deleteCategory}><input type="hidden" name="id" value={category.id}/><button className="button button--outline" type="submit">Delete permanently</button></form></div></div>
      </details>)}
    </section>
  </>;
}
