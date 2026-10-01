import { test, expect, describe } from "bun:test";
import { createDetachChord } from "../src/client/attach.ts";

const CTRL_B = 0x02;
function harness() {
  const forwarded: string[] = [];
  let detached = 0;
  const chord = createDetachChord({
    onDetach: () => { detached++; },
    onForward: (b) => forwarded.push(new TextDecoder().decode(b)),
  }, 800);
  return { chord, forwarded, detached: () => detached };
}

describe("detach chord (design §8.4)", () => {
  test("two separate Ctrl-B reads -> detach", () => {
    const h = harness();
    h.chord.feed(new Uint8Array([CTRL_B]));
    h.chord.feed(new Uint8Array([CTRL_B]));
    expect(h.detached()).toBe(1);
    expect(h.forwarded).toEqual([]);
    h.chord.dispose();
  });

  test("two Ctrl-B coalesced into one read -> detach", () => {
    const h = harness();
    h.chord.feed(new Uint8Array([CTRL_B, CTRL_B]));
    expect(h.detached()).toBe(1);
    h.chord.dispose();
  });

  test("printable input is forwarded verbatim", () => {
    const h = harness();
    h.chord.feed(new TextEncoder().encode("hello"));
    expect(h.forwarded).toEqual(["hello"]);
    expect(h.detached()).toBe(0);
    h.chord.dispose();
  });

  test("a lone Ctrl-B is swallowed (prefix); a following key forwards the key, no detach", () => {
    const h = harness();
    h.chord.feed(new Uint8Array([CTRL_B]));       // prefix, swallowed
    h.chord.feed(new TextEncoder().encode("x"));  // not a second Ctrl-B
    expect(h.detached()).toBe(0);
    expect(h.forwarded).toEqual(["x"]);           // the dropped prefix is not forwarded
    h.chord.dispose();
  });

  test("prefix expires after the window (no detach on a later lone Ctrl-B)", async () => {
    const forwarded: string[] = [];
    let detached = 0;
    const chord = createDetachChord({ onDetach: () => { detached++; }, onForward: (b) => forwarded.push(String(b)) }, 20);
    chord.feed(new Uint8Array([CTRL_B]));
    await Bun.sleep(40); // window lapses
    chord.feed(new Uint8Array([CTRL_B])); // a fresh prefix, not a second tap
    expect(detached).toBe(0);
    chord.dispose();
  });
});
