import { Bot, CalendarClock, Database, FlaskConical, Layers, MessageSquareText, Play, Workflow } from 'lucide-react'
import { ResourceGroup, ResourceLink } from './ExplorerPrimitives'
import { isInProgress } from './explorerTime'
import type { GlobalExplorerSidebarModel } from './useGlobalExplorerSidebar'

export function GlobalExplorerSections({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  return (
    <>
      <ScheduleSection explorer={explorer} />
      <PipelineSection explorer={explorer} />
      <ResearchSection explorer={explorer} />
      <WorkflowSection explorer={explorer} />
      <AgentSection explorer={explorer} />
      <PromptSection explorer={explorer} />
      <DestinationSection explorer={explorer} />
      <RunsSection explorer={explorer} />
      {explorer.needle && !explorer.hasResults && (
        <p className="px-4 py-3 text-xs text-muted-foreground">No matching resources.</p>
      )}
    </>
  )
}

function WorkflowSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.workflows.length === 0) return null
  return (
    <ResourceGroup label="Workflows" icon={Layers} indexHref="/workflows" onRefetch={explorer.refreshWorkflows} isRefetching={explorer.workflowsFetching}>
      {explorer.workflows.map((wf) => (
        <ResourceLink key={wf.id} href={`/workflows/${wf.id}`} label={wf.name} active={explorer.pathname === `/workflows/${wf.id}`} status="configured" />
      ))}
    </ResourceGroup>
  )
}

function AgentSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.agents.length === 0) return null
  return (
    <ResourceGroup label="Agents" icon={Bot} indexHref="/agents" addHref="/agents/new" onRefetch={explorer.refreshAgents} isRefetching={explorer.agentsFetching}>
      {explorer.agents.map((agent) => (
        <ResourceLink key={agent.id} href={`/agents/${agent.slug}`} label={agent.name} active={explorer.pathname.includes(`/agents/${agent.slug}`)} status="configured" />
      ))}
    </ResourceGroup>
  )
}

function PipelineSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.pipelines.length === 0) return null

  return (
    <ResourceGroup
      label="Pipelines"
      icon={Workflow}
      indexHref="/pipelines"
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
  if (explorer.schedules.length === 0) return null

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
  if (explorer.researchSources.length === 0) return null

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
      {explorer.researchSources.map((source) => (
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
    </ResourceGroup>
  )
}

function PromptSection({ explorer }: { explorer: GlobalExplorerSidebarModel }) {
  if (explorer.prompts.length === 0) return null

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
  if (explorer.destinations.length === 0) return null

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
  if (explorer.runs.length === 0) return null

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
          href={`/runs/${run.id}`}
          label={run.title ?? run.pipelineName ?? run.workflowName ?? 'Run'}
          active={explorer.pathname === `/runs/${run.id}`}
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
