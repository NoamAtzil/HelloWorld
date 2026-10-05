import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Book = {
  id: number;
  title: string;
  author: string;
  year: number | null;
};

export default async function BooksPage() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, year")
    .order("id")
    .overrideTypes<Book[], { merge: false }>();

  if (error) {
    return (
      <p role="alert" className="mx-auto mt-10 max-w-xl rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
        Failed to load books: {error.message}
      </p>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Books</h1>
      <ul className="space-y-3">
        {data.map((book) => (
          <li key={book.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="font-medium">{book.title}</p>
            <p className="text-sm text-muted">
              {book.author}
              {book.year ? ` · ${book.year}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
