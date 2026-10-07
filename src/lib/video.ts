import { readFileSync } from 'node:fs';

/**
 * The length in seconds of an MP4 file, read from its movie header (`mvhd`).
 * The build fails when the header comes after the video data: a browser would
 * then fetch the end of the file before it could start playing, so videos are
 * encoded with `-movflags +faststart` (see Videos in AGENTS.md).
 */
export function mp4Duration(file: string): number {
  const data = readFileSync(file);
  // Top-level boxes: a 32-bit size (1: a 64-bit size follows; 0: to the end of the file), then the type.
  for (let box = 0; box + 8 <= data.length; ) {
    const short = data.readUInt32BE(box);
    const size = short === 1 ? Number(data.readBigUInt64BE(box + 8)) : short || data.length - box;
    const type = data.toString('latin1', box + 4, box + 8);
    if (type === 'mdat' || size < 8) break;
    if (type === 'moov') {
      for (let child = box + 8; child + 8 <= box + size; ) {
        const childSize = data.readUInt32BE(child);
        if (childSize < 8) break;
        if (data.toString('latin1', child + 4, child + 8) === 'mvhd') {
          // Version, flags, creation and modification times, then the timescale and duration.
          const v1 = data[child + 8] === 1;
          const timescale = data.readUInt32BE(child + (v1 ? 28 : 20));
          const duration = v1 ? Number(data.readBigUInt64BE(child + 32)) : data.readUInt32BE(child + 24);
          return duration / timescale;
        }
        child += childSize;
      }
    }
    box += size;
  }
  throw new Error(`${file} has no movie header before its video data: encode it with -movflags +faststart (see Videos in AGENTS.md).`);
}
