import { useState } from 'react'
import { Check, GitFork, Rss, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { useCommunityFeeds, useCommunityPipelines, useForkCommunityPipeline, useSubscribeCommunityFeed } from '@project/sdk'
import { Button } from '@/components/ui/Button'

export function CommunityPage() {
  const [tab, setTab] = useState<'pipelines' | 'feeds'>('pipelines')
  const pipelines = useCommunityPipelines()
  const feeds = useCommunityFeeds()
  const fork = useForkCommunityPipeline()
  const subscribe = useSubscribeCommunityFeed()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold">Community</h1>
      <p className="text-sm text-muted-foreground">Public starter resources. Copies and runs stay private in your workspace.</p>
      <div className="flex gap-2 mt-5 mb-4">
        <Button size="sm" variant={tab === 'pipelines' ? 'default' : 'outline'} onClick={() => setTab('pipelines')}><Workflow size={13} /> Pipelines</Button>
        <Button size="sm" variant={tab === 'feeds' ? 'default' : 'outline'} onClick={() => setTab('feeds')}><Rss size={13} /> Feeds</Button>
      </div>
      <div className="divide-y rounded border bg-surface">
        {tab === 'pipelines' && (pipelines.data ?? []).map((pipeline) => (
          <div key={pipeline.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{pipeline.name}</p><p className="text-xs text-muted-foreground truncate">{pipeline.description || `${pipeline._count?.agents ?? 0} agents`}</p></div>
            <Button size="sm" variant="outline" loading={fork.isPending} onClick={async () => { await fork.mutateAsync(pipeline.id); toast.success('Private pipeline copy created') }}><GitFork size={13} /> Use pipeline</Button>
          </div>
        ))}
        {tab === 'feeds' && (feeds.data ?? []).map((feed) => (
          <div key={feed.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{feed.name}</p><p className="text-xs text-muted-foreground">{feed.sourceType} · {feed.category || 'uncategorized'} · {feed._count?.items ?? 0} items</p></div>
            <Button size="sm" variant="outline" loading={subscribe.isPending} onClick={async () => { await subscribe.mutateAsync(feed.id); toast.success('Feed added to workspace') }}><Check size={13} /> Add feed</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
