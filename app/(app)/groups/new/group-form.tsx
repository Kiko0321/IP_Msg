"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/avatar";
import { GROUP_MEMBERS_MAX, GROUP_TITLE_MAX } from "@/lib/validation/group";
import { createGroup, type GroupState } from "../actions";

export type Person = { id: string; display_name: string; avatar_url: string | null };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700";

export function GroupForm({ people }: { people: Person[] }) {
  const [state, formAction, pending] = useActionState<GroupState, FormData>(createGroup, {});
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(state.values?.memberIds));
  const [filter, setFilter] = useState("");

  const term = filter.trim().toLowerCase();
  const visible = term ? people.filter((p) => p.display_name.toLowerCase().includes(term)) : people;
  const full = selected.size >= GROUP_MEMBERS_MAX;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        Group name
        <input
          name="title"
          required
          maxLength={GROUP_TITLE_MAX}
          defaultValue={state.values?.title}
          placeholder="e.g. Design team"
          className={inputClass}
        />
        {state.fieldErrors?.title && <span className="text-red-600 dark:text-red-400">{state.fieldErrors.title[0]}</span>}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">
          Members <span className="text-neutral-500">({selected.size} selected)</span>
        </legend>

        {/* Selected people are always submitted, even when the filter hides them. */}
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="memberIds" value={id} />
        ))}

        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name"
          aria-label="Filter people by name"
          className={inputClass}
        />

        {people.length === 0 ? (
          <p className="text-sm text-neutral-500">No other users yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-neutral-500">No one matches “{filter.trim()}”.</p>
        ) : (
          <ul className="flex max-h-80 flex-col divide-y divide-neutral-200 overflow-y-auto rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {visible.map((person) => {
              const checked = selected.has(person.id);
              return (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggle(person.id)}
                    />
                    <Avatar name={person.display_name} url={person.avatar_url} size="sm" />
                    <span className="truncate">{person.display_name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {full && <p className="text-sm text-neutral-500">That&apos;s the most a group can have.</p>}
        {state.fieldErrors?.memberIds && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.fieldErrors.memberIds[0]}</p>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || selected.size === 0}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
