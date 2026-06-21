import { CalendarClock, Database, FlaskConical, MessageSquareText, Play, Workflow } from 'lucide-react'
import { ResearchCategoryGroup, ResourceGroup, ResourceLink } from './ExplorerPrimitives'
import { isInProgress } from './explorerTime'
import type { GlobalExplorerSidebarModel } from './useGlobalExplorerSidebar'

export function GlobalExplorerSections({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  return (
    <>
      <PipelineSection explorer={explorer} />
      <ScheduleSection explorer={explorer} />
      <ResearchSection explorer={explorer} />
      <PromptSection explorer={explorer} />
      <DestinationSection explorer={explorer} />
      <RunsSection explorer={explorer} />
      {explorer.needle && !explorer.hasResults && (
        <p className="px-4 py-3 text-xs text-muted-foreground">No matching resources.</p>
      )}
    </>
  )
}

function PipelineSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.pipelines.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Pipelines"
      icon={Workflow}
      indexHref="/"
      addHref="/pipelines/new"
      onRefetch={explorer.refreshPipelines}
      isRefetching={explorer.pipelinesFetching}
    >
      {explorer.pipelines.map((pipeline) => (
        <ResourceLink
          key={pipeline.id}
          href={`/pipelines/${pipeline.slug}`}
          label={pipeline.name}
          active={explorer.pathname.includes(`/pipelines/${pipeline.slug}`)}
          status={pipeline.status}
          activityAt={pipeline.lastRunAt}
          activityLabel="Last run"
        />
      ))}
    </ResourceGroup>
  )
}

function ScheduleSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.schedules.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Schedules"
      icon={CalendarClock}
      indexHref="/schedules"
      addHref="/schedules/new"
      onRefetch={explorer.refreshSchedules}
      isRefetching={explorer.schedulesFetching}
    >
      {explorer.schedules.map((schedule) => (
        <ResourceLink
          key={schedule.id}
          href={`/schedules/${schedule.id}`}
          label={schedule.name}
          active={explorer.pathname.includes(`/schedules/${schedule.id}`)}
          status={scheduleStatus(schedule)}
          activityAt={schedule.lastRunAt}
          activityLabel="Last execution"
          activityState={isInProgress(schedule.lastExecutionStatus) ? 'Running' : undefined}
        />
      ))}
    </ResourceGroup>
  )
}

function ResearchSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.researchGroups.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Research"
      icon={FlaskConical}
      indexHref="/research"
      addHref="/research/new"
      onRefetch={() => explorer.checkResearch()}
      isRefetching={explorer.checkingAllResearch}
      isRefreshDisabled={Boolean(explorer.checkingSourceId)}
      refreshTitle="Check all active research feeds"
    >
      {explorer.researchGroups.map((group) => (
        <ResearchCategoryGroup
          key={group.category}
          label={group.label}
          count={group.sources.length}
          collapsed={group.collapsed}
          onToggle={() => explorer.toggleResearchCategory(group.category)}
          onRefetch={() => explorer.checkResearch(group.category)}
          isRefetching={group.isRefetching}
          disabled={explorer.researchCheckPending}
        >
          {group.sources.map((source) => (
            <ResourceLink
              key={source.id}
              href={`/research/${source.slug}`}
              label={source.name}
              active={explorer.pathname.includes(`/research/${source.slug}`)}
              status={source.status}
              activityAt={source.lastChecked}
              activityLabel="Last checked"
              onRefetch={() => explorer.checkSource(source)}
              isRefetching={explorer.checkingSourceId === source.id}
              refreshDisabled={explorer.researchCheckPending}
              refreshTitle={`Check ${source.name}`}
            />
          ))}
        </ResearchCategoryGroup>
      ))}
    </ResourceGroup>
  )
}

function PromptSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.prompts.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Prompts"
      icon={MessageSquareText}
      indexHref="/prompts"
      addHref="/prompts/new"
      onRefetch={explorer.refreshPrompts}
      isRefetching={explorer.promptsFetching}
    >
      {explorer.prompts.map((prompt) => (
        <ResourceLink
          key={prompt.id}
          href={`/prompts/${prompt.slug}`}
          label={prompt.name}
          active={explorer.pathname.includes(`/prompts/${prompt.slug}`)}
          status={prompt.kind === 'TRANSFORMATIONAL' ? 'active' : 'configured'}
        />
      ))}
    </ResourceGroup>
  )
}

function DestinationSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.destinations.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Destinations"
      icon={Database}
      indexHref="/destinations"
      addHref="/destinations/new"
      onRefetch={explorer.refreshDestinations}
      isRefetching={explorer.destinationsFetching}
    >
      {explorer.destinations.map((destination) => (
        <ResourceLink
          key={destination.id}
          href={`/destinations/${destination.id}`}
          label={destination.name}
          active={explorer.pathname.includes(`/destinations/${destination.id}`)}
          status="configured"
        />
      ))}
    </ResourceGroup>
  )
}

function RunsSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.runs.length === 0 && explorer.needle) return null

  return (
    <ResourceGroup
      label="Runs"
      icon={Play}
      indexHref="/runs"
      onRefetch={explorer.refreshRuns}
      isRefetching={explorer.runsFetching}
    >
      {explorer.runs.slice(0, 20).map((run) => (
        <ResourceLink
          key={run.id}
          href={`/pipelines/${run.pipelineSlug}`}
          label={run.title ?? run.pipelineName}
          active={false}
          status={runStatus(run.status)}
          activityAt={run.startedAt}
          activityLabel="Started"
          activityState={run.status === 'running' || run.status === 'queued' ? capitalise(run.status) : undefined}
        />
      ))}
    </ResourceGroup>
  )
}

function scheduleStatus(schedule: GlobalExplorerSidebarModel['schedules'][number]) {
  if (schedule.lastExecutionStatus === 'failed') return 'failed'
  if (schedule.lastExecutionStatus === 'partial') return 'warning'
  return schedule.enabled ? 'active' : 'paused'
}

function runStatus(status: string) {
  if (status === 'completed' || status === 'posted') return 'active'
  if (status === 'failed') return 'failed'
  if (status === 'running' || status === 'queued') return 'paused'
  return 'draft'
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
