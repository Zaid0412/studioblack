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

// The cell renders a single `<input>` in both modes — read-only when not
// editing, editable when editing. Tests target the input via aria-label.
describe("BoqEditableCell", () => {
  it("renders the display value when not editing", () => {
    render(
      <BoqEditableCell
        value="10"
        display="10 units"
        mode="number"
        onSave={vi.fn()}
        ariaLabel="qty"
      />
    );
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    expect(input.value).toBe("10 units");
    expect(input.readOnly).toBe(true);
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);

    await waitFor(() => expect(input.readOnly).toBe(false));
    expect(input.value).toBe("5");

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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe("5");
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
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

    const input = screen.getByLabelText("description") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("is disabled when the prop is set", () => {
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("5");
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

    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("7"));
  });

  it("parses feet-inches input and saves decimal feet", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <BoqEditableCell
        value="2.5"
        display={`2'6"`}
        mode="feet-inches"
        onSave={onSave}
        ariaLabel="length"
      />
    );

    const input = screen.getByLabelText("length") as HTMLInputElement;
    fireEvent.click(input);
    await waitFor(() => expect(input.readOnly).toBe(false));
    // Seeded with the feet-inches form so the user edits in that notation.
    expect(input.value).toBe(`2'6"`);

    fireEvent.change(input, { target: { value: `7'10"` } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const saved = onSave.mock.calls[0][0] as string;
    expect(Number.parseFloat(saved)).toBeCloseTo(7.8333, 4);
  });
});
