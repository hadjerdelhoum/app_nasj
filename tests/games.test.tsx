// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Memory from "../src/games/Memory";
import Paint from "../src/games/Paint";

describe("mini-games", () => {
  it("memory: all pairs can be found and onDone fires", async () => {
    const u = userEvent.setup(), done = vi.fn();
    render(<Memory band="easy" onSay={() => {}} onDone={done} />);
    const matched = new Set<number>();
    const all = () => screen.getAllByRole("button");
    for (let a = 0; a < 6; a++) {
      if (matched.has(a)) continue;
      for (let b = a + 1; b < 6 && !matched.has(a); b++) {
        if (matched.has(b)) continue;
        await u.click(all()[a]); await u.click(all()[b]);
        await new Promise((r) => setTimeout(r, 1100));
        if (all()[a].getAttribute("aria-label") === "Carte retournée") { matched.add(a); matched.add(b); }
      }
    }
    await waitFor(() => expect(done).toHaveBeenCalled(), { timeout: 3000 });
  }, 60000);
  it("paint: finish enabled after 12 cells", async () => {
    const u = userEvent.setup(), done = vi.fn();
    render(<Paint onSay={() => {}} onDone={done} />);
    const cells = screen.getAllByRole("button", { name: "Case vide" });
    for (let i = 0; i < 12; i++) await u.click(cells[i]);
    await u.click(screen.getByRole("button", { name: /J'ai fini/ }));
    expect(done).toHaveBeenCalledWith(0, { cells: 12 });
  });
});
