import { z } from "zod";

export const preferencesSchema = z.object({
  enabled: z.boolean().default(true),
  scheme: z.enum(["graphite", "charcoal", "paper"]).default("graphite"),
  layoutVersion: z.literal(2).default(2),
  background: z.enum(["custom", "lunar", "saturn", "galaxy", "nebula"]).default("custom"),
  characterSize: z.number().int().min(4).max(20).default(6),
  backgroundScale: z.number().int().min(100).max(200).default(100),
  animated: z.boolean().default(false),
  interactive: z.boolean().default(false),
  wallpaperEnabled: z.boolean().default(false),
  width: z.enum(["focused", "wide", "full"]).default("full"),
  spacing: z.enum(["comfortable", "compact"]).default("compact"),
  visibility: z.number().int().min(5).max(100).default(10),
  position: z.enum(["center", "top", "bottom"]).default("center"),
  image: z
    .string()
    .max(1_800_000)
    .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/)
    .nullable()
    .default(null),
});

export type Preferences = z.output<typeof preferencesSchema>;

export function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte))
    return "image/png";
  if (
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return "image/webp";
  throw new Error(
    "Choose a JPEG, PNG, or WebP image. SVG and GIF are not supported.",
  );
}
