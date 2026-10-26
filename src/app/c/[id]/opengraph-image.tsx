import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { sharedImageUrl } from "@/lib/public-url";

export const alt = "A caption on caption";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let content = "caption";
  let image: string | null = null;
  if (Number.isInteger(id) && id > 0) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_post", { p_id: id });
    const post = (data ?? [])[0] as { content: string; image_path: string } | undefined;
    if (post) {
      content = post.content;
      image = sharedImageUrl(post.image_path);
    }
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff7ee", position: "relative" }}>
        {image && (
          <img src={image} alt="" width={1200} height={630} style={{ width: 1200, height: 630, objectFit: "cover" }} />
        )}
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 48,
            display: "flex",
            padding: "28px 44px 32px 36px",
            background: "rgba(255,240,227,0.95)",
            border: "3px solid rgba(255,122,26,0.5)",
            borderRadius: "28px 28px 120px 28px",
            fontSize: 46,
            fontWeight: 700,
            color: "#1f1712",
            lineHeight: 1.15,
          }}
        >
          {content.length > 120 ? `${content.slice(0, 117)}…` : content}
        </div>
      </div>
    ),
    size,
  );
}
