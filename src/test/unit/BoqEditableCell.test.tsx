// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  fireEvent,
  screen,
  cleanup,
  waitFor,
} from "@testing-library/react";

import { BoqEditableCell } from "@/app/(dashboard)/projects/[id]/boq/_components/BoqEditableCell";

afterEach(() => {
  cleanup();
});

describe("BoqEditableCell", () => {
  it("renders the display value when not editing", () => {
    render(
      <BoqEditableCell
        value="10"
        display="10 units"
        mode="number"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("10 units")).toBeDefined();
  });

  it("enters edit mode on click and saves on Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    const trigger = screen.getByRole("button", { name: "qty" });
    fireEvent.click(trigger);

    const input = await screen.findByRole("textbox");
    expect((input as HTMLInputElement).value).toBe("5");

    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("12"));
  });

  it("reverts on Escape without calling onSave", async () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "qty" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("5")).toBeDefined();
  });

  it("does not call onSave when value is unchanged", async () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "qty" }));
    const input = await screen.findByRole("textbox");
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("silently reverts invalid number input", async () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "qty" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("enforces min bound in number mode", async () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        min={0}
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "qty" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "-3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses blank text input", async () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="desc"
        display="desc"
        mode="text"
        onSave={onSave}
        ariaLabel="description"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "description" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("is read-only when disabled", () => {
    const onSave = vi.fn();
    render(
      <BoqEditableCell
        value="5"
        display="5"
        disabled
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    expect(screen.queryByRole("button", { name: "qty" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("5")).toBeDefined();
  });

  it("saves on blur after edit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <BoqEditableCell
        value="5"
        display="5"
        mode="number"
        onSave={onSave}
        ariaLabel="qty"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "qty" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("7"));
  });
});
