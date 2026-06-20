const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function downloadRunAsset(runId: string, assetId: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pipeline-runs/${runId}/assets/${assetId}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error('Download failed')
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.includes('/') ? filename.split('/').pop()! : filename
  anchor.click()
  URL.revokeObjectURL(url)
}
