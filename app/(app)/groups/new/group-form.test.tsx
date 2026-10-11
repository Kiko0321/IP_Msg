import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GroupForm } from "./group-form";

describe("GroupForm (MSG-37)", () => {
  const people = [
    { id: "a", display_name: "Alice", avatar_url: null },
    { id: "b", display_name: "Bob", avatar_url: null },
  ];
  const hiddenIds = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="memberIds"]')].map((i) => i.value);

  it("keeps chosen people selected while the filter hides them", async () => {
    const { container } = render(<GroupForm people={people} />);
    expect(screen.getByRole("button", { name: "Create group" })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /Alice/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "bo");

    expect(screen.queryByRole("checkbox", { name: /Alice/ })).not.toBeInTheDocument();
    expect(hiddenIds(container)).toEqual(["a"]);
    expect(screen.getByText("(1 selected)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create group" })).toBeEnabled();
  });
});
