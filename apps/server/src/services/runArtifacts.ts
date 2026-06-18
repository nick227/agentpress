export interface RunAgentPrompt {
  uid: string
  name: string
  outputTarget: string
  cacheStatus: string
  systemPrompt: string
  userPrompt: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPostHtml(post: {
  title: string
  excerpt: string
  body: string
  thumbnailLocalPath?: string
}): string {
  const title = escapeHtml(post.title || 'Untitled')
  const excerpt = post.excerpt
    ? `<p class="excerpt">${escapeHtml(post.excerpt)}</p>`
    : ''
  const thumbnail = post.thumbnailLocalPath
    ? '<figure class="thumbnail"><img src="./thumbnail.png" alt="Featured image" /></figure>'
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.75rem; line-height: 1.25; margin-bottom: 0.5rem; }
    .excerpt { font-size: 1.05rem; color: #444; margin: 0 0 1.5rem; }
    .thumbnail img { width: 100%; height: auto; border-radius: 6px; }
    .body { font-size: 1rem; }
    .body figure { margin: 1.5rem 0; }
    .body img { max-width: 100%; height: auto; border-radius: 4px; }
    figcaption { font-size: 0.875rem; color: #666; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    ${excerpt}
    ${thumbnail}
    <div class="body">${post.body}</div>
  </article>
</body>
</html>`
}
