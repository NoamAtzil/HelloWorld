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
        <p className="rounded-xl bg-tint p-3 text-sm text-accent-text">
          Please add your first and last name to finish setting up your
          account.
        </p>
      )}

      {profile.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt="Profile photo"
          className="h-20 w-20 rounded-full object-cover ring-2 ring-glow ring-offset-2 ring-offset-surface"
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
          className="field"
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
          className="field"
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
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-tint file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-text"
        />
      </div>

      {state?.error && <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary press"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
