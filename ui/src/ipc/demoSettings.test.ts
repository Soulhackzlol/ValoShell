import { describe, expect, it } from "vitest";
import { defaultSettings, withDefaults } from "./demoSettings";

describe("withDefaults", () => {
  it("fills fields an older saved section lacks", () => {
    const saved = { interface: { theme: "glass", ui_volume: 0.2, motion: "full", backdrop: "x" } };

    const settings = withDefaults(saved as never);

    expect(settings.interface.ui_volume).toBe(0.2);
    expect(settings.interface.ui_scale).toBe(defaultSettings().interface.ui_scale);
    expect(settings.interface.color_vision).toBe("default");
  });

  it("adds whole sections an older save never had", () => {
    expect(withDefaults({}).updates.should_check_for_updates).toBe(true);
  });

  it("keeps saved plain values as they are", () => {
    expect(withDefaults({ region: "na" }).region).toBe("na");
  });
});
