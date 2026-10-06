/** Validate raster signatures and dimensions before allocating a decoded preview. */
export async function inspectQuestPhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Выбери JPG, PNG или WEBP размером до 5 МБ.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    view = new DataView(bytes.buffer);
  let width = 0,
    height = 0;
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (
    file.type === "image/png" &&
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    ascii(1, 7) === "PNG\r\n\x1a\n" &&
    ascii(12, 4) === "IHDR"
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (
    file.type === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216
  ) {
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      ) {
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else if (
    file.type === "image/webp" &&
    bytes.length >= 30 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (chunk === "VP8L" && bytes[20] === 47) {
      const dims = view.getUint32(21, true);
      width = (dims & 16383) + 1;
      height = ((dims >>> 14) & 16383) + 1;
    } else if (
      chunk === "VP8 " &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    ) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    }
  }
  if (!width || !height)
    throw new Error("Файл не является поддерживаемым растровым изображением.");
  if (width * height > 40000000)
    throw new Error("Изображение слишком большое: максимум 40 мегапикселей.");
  return { width, height };
}
