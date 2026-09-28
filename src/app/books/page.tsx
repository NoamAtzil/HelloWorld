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
    return <p>Failed to load books: {error.message}</p>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Books</h1>
      <ul className="space-y-3">
        {data.map((book) => (
          <li key={book.id} className="rounded border border-black/10 p-4">
            <p className="font-medium">{book.title}</p>
            <p className="text-sm text-zinc-600">
              {book.author}
              {book.year ? ` · ${book.year}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
