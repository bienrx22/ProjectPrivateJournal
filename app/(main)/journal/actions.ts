"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DATE_RE } from "@/lib/journal";

export type EntryFormState = {
  error?: string;
  values?: Record<string, string>;
};

/** Every action re-checks the session; never trust the page that rendered the form. */
async function authedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");
  return supabase;
}

function parseEntry(formData: FormData) {
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const values = {
    title: field("title"),
    entry_date: field("entry_date"),
    location: field("location"),
    mood: field("mood"),
    body: field("body"),
  };

  let error: string | undefined;
  if (!values.title) error = "Give your memory a title.";
  else if (values.title.length > 200) error = "Title must be 200 characters or fewer.";
  else if (!DATE_RE.test(values.entry_date)) error = "Pick a valid date.";
  else if (values.mood.length > 50) error = "Mood must be 50 characters or fewer.";

  const row = {
    title: values.title,
    entry_date: values.entry_date,
    location: values.location || null,
    mood: values.mood || null,
    body: values.body || null,
  };
  return { values, row, error };
}

export async function createEntry(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { values, row, error } = parseEntry(formData);
  if (error) return { error, values };

  const supabase = await authedClient();
  const { data, error: dbError } = await supabase
    .from("journal_entries")
    .insert(row)
    .select("id")
    .single();
  if (dbError) return { error: dbError.message, values };

  revalidatePath("/", "layout");
  redirect(`/journal/${data.id}`);
}

export async function updateEntry(
  id: string,
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { values, row, error } = parseEntry(formData);
  if (error) return { error, values };

  const supabase = await authedClient();
  const { error: dbError } = await supabase
    .from("journal_entries")
    .update(row)
    .eq("id", id)
    .select("id")
    .single();
  if (dbError) return { error: dbError.message, values };

  revalidatePath("/", "layout");
  redirect(`/journal/${id}`);
}

export async function deleteEntry(id: string) {
  const supabase = await authedClient();
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function setFavorite(id: string, isFavorite: boolean) {
  const supabase = await authedClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
