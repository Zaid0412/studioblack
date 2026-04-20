// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { useState } from "react";

import { TagInput } from "@/components/ui/TagInput";

function Harness({
  initial = [],
  maxTags,
  onChangeSpy,
}: {
  initial?: string[];
  maxTags?: number;
  onChangeSpy?: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <TagInput
      label="Tags"
      placeholder="Type and press space"
      value={tags}
      maxTags={maxTags}
      onChange={(t) => {
        setTags(t);
        onChangeSpy?.(t);
      }}
    />
  );
}

describe("TagInput", () => {
  afterEach(cleanup);

  it("commits a tag when Space is pressed", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByPlaceholderText("Type and press space");
    fireEvent.change(input, { target: { value: "concrete" } });
    fireEvent.keyDown(input, { key: " " });
    expect(onChange).toHaveBeenCalledWith(["concrete"]);
    expect(screen.getByText("concrete")).toBeDefined();
  });

  it("commits a tag when Enter is pressed", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByPlaceholderText("Type and press space");
    fireEvent.change(input, { target: { value: "steel" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["steel"]);
  });

  it("commits a tag when comma is pressed", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByPlaceholderText("Type and press space");
    fireEvent.change(input, { target: { value: "tile" } });
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["tile"]);
  });

  it("commits the draft on blur", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByPlaceholderText("Type and press space");
    fireEvent.change(input, { target: { value: "paint" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(["paint"]);
  });

  it("trims whitespace around tags", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByPlaceholderText("Type and press space");
    fireEvent.change(input, { target: { value: "  wood  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["wood"]);
  });

  it("rejects duplicate tags case-insensitively", () => {
    const onChange = vi.fn();
    render(<Harness initial={["Brick"]} onChangeSpy={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "brick" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes the last tag when Backspace is pressed on an empty input", () => {
    const onChange = vi.fn();
    render(<Harness initial={["a", "b"]} onChangeSpy={onChange} />);
    const tagInput = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.keyDown(tagInput, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("does not remove a tag on Backspace when the input has text", () => {
    const onChange = vi.fn();
    render(<Harness initial={["a", "b"]} onChangeSpy={onChange} />);
    const tagInput = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: "c" } });
    fireEvent.keyDown(tagInput, { key: "Backspace" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when its X button is clicked", () => {
    const onChange = vi.fn();
    render(<Harness initial={["a", "b", "c"]} onChangeSpy={onChange} />);
    const removeB = screen.getByLabelText("Remove b");
    fireEvent.click(removeB);
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  it("does not commit when the draft is empty", () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops committing once maxTags is reached", () => {
    const onChange = vi.fn();
    render(
      <Harness initial={["a", "b"]} maxTags={2} onChangeSpy={onChange} />
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the draft even when the tag is rejected as a duplicate", () => {
    render(<Harness initial={["a"]} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });
});
