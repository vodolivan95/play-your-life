import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectQuestPhoto } from "../src/questPhoto.ts";
test("растровая сигнатура, лимит файла и размер проверяются до декодирования", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqCEAAAAASUVORK5CYII=",
    "base64",
  );
  assert.deepEqual(
    await inspectQuestPhoto(
      new File([png], "photo.png", { type: "image/png" }),
    ),
    { width: 1, height: 1 },
  );
  await assert.rejects(
    inspectQuestPhoto(new File(["<svg/>"], "fake.jpg", { type: "image/jpeg" })),
  );
  await assert.rejects(
    inspectQuestPhoto(new File([png], "fake.svg", { type: "image/svg+xml" })),
  );
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  huge.writeUInt32BE(100000, 20);
  await assert.rejects(
    inspectQuestPhoto(new File([huge], "huge.png", { type: "image/png" })),
    /40 мегапикселей/,
  );
  await assert.rejects(
    inspectQuestPhoto(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.jpg", {
        type: "image/jpeg",
      }),
    ),
    /5 МБ/,
  );
});
