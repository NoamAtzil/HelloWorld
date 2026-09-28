"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormState } from "./actions";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(updateProfile, undefined);

  const isIncomplete = !profile.first_name || !profile.last_name;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isIncomplete && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Please add your first and last name to finish setting up your
          account.
        </p>
      )}

      {profile.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt="Profile photo"
          className="h-20 w-20 rounded-full object-cover"
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="first_name" className="text-sm font-medium">
          First name
        </label>
        <input
          id="first_name"
          name="first_name"
          defaultValue={profile.first_name ?? ""}
          required
          className="rounded border border-black/10 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="last_name" className="text-sm font-medium">
          Last name
        </label>
        <input
          id="last_name"
          name="last_name"
          defaultValue={profile.last_name ?? ""}
          required
          className="rounded border border-black/10 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="avatar" className="text-sm font-medium">
          Profile photo
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/*"
          className="text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
