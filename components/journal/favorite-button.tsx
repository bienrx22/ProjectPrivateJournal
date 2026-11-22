import { Star } from "lucide-react";
import { SubmitButton } from "@/components/journal/submit-button";
import { setFavorite } from "@/app/(main)/journal/actions";

export function FavoriteButton({ id, isFavorite }: { id: string; isFavorite: boolean }) {
  return (
    <form action={setFavorite.bind(null, id, !isFavorite)}>
      <SubmitButton variant="ghost" size="sm" aria-pressed={isFavorite}>
        <Star className={isFavorite ? "fill-jaffa text-jaffa" : ""} />
        {isFavorite ? "Favorited" : "Favorite"}
      </SubmitButton>
    </form>
  );
}
