import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { researchCategoryLabel } from './researchCategories'
import { useExplorerResources } from './useExplorerResources'
import { useResearchRefresh } from './useResearchRefresh'

export function useGlobalExplorerSidebar() {
  const { pathname } = useLocation()

  // Local navigation state.
  const [query, setQuery] = useState('')

  // Isolated hooks own server queries and mutation feedback.
  const resources = useExplorerResources()
  const researchRefresh = useResearchRefresh()
  const needle = query.trim().toLowerCase()

  // Search-filtered view models consumed by the section renderers.
  const visiblePipelines = useMemo(
    () => needle ? resources.pipelines.filter((pipeline) => pipeline.name.toLowerCase().includes(needle)) : resources.pipelines,
    [resources.pipelines, needle],
  )
  const visibleSchedules = useMemo(
    () => needle ? resources.schedules.filter((schedule) => schedule.name.toLowerCase().includes(needle)) : resources.schedules,
    [resources.schedules, needle],
  )
  const visibleAgents = useMemo(
    () => needle ? resources.agents.filter((agent) => `${agent.name} ${agent.category}`.toLowerCase().includes(needle)) : resources.agents,
    [resources.agents, needle],
  )
  const visibleSources = useMemo(
    () => needle
      ? resources.researchSources.filter((source) => `${source.name} ${researchCategoryLabel(source.category)}`.toLowerCase().includes(needle))
      : resources.researchSources,
    [resources.researchSources, needle],
  )
  const visibleDestinations = useMemo(
    () => needle ? resources.destinations.filter((destination) => destination.name.toLowerCase().includes(needle)) : resources.destinations,
    [resources.destinations, needle],
  )
  const visiblePrompts = useMemo(
    () => needle
      ? resources.prompts.filter((prompt) => `${prompt.name} ${prompt.category}`.toLowerCase().includes(needle))
      : resources.prompts,
    [resources.prompts, needle],
  )
  const visibleRuns = useMemo(
    () => needle
      ? resources.runs.filter((run) => (run.pipelineName + ' ' + (run.title ?? '')).toLowerCase().includes(needle))
      : resources.runs,
    [resources.runs, needle],
  )
  const visibleWorkflows = useMemo(
    () => needle
      ? resources.workflows.filter((wf) => `${wf.name} ${wf.category} ${(wf.tags ?? []).join(' ')}`.toLowerCase().includes(needle))
      : resources.workflows,
    [resources.workflows, needle],
  )
  return {
    pathname,
    query,
    setQuery,
    needle,
    pipelines: visiblePipelines,
    agents: visibleAgents,
    schedules: visibleSchedules,
    destinations: visibleDestinations,
    prompts: visiblePrompts,
    runs: visibleRuns,
    researchSources: visibleSources,
    workflows: visibleWorkflows,
    hasResults: visiblePipelines.length > 0
      || visibleAgents.length > 0
      || visibleSchedules.length > 0
      || visibleSources.length > 0
      || visiblePrompts.length > 0
      || visibleDestinations.length > 0
      || visibleRuns.length > 0
      || visibleWorkflows.length > 0,
    pipelinesFetching: resources.pipelinesFetching,
    agentsFetching: resources.agentsFetching,
    schedulesFetching: resources.schedulesFetching,
    destinationsFetching: resources.destinationsFetching,
    promptsFetching: resources.promptsFetching,
    runsFetching: resources.runsFetching,
    workflowsFetching: resources.workflowsFetching,
    refreshPipelines: resources.refreshPipelines,
    refreshAgents: resources.refreshAgents,
    refreshSchedules: resources.refreshSchedules,
    refreshDestinations: resources.refreshDestinations,
    refreshPrompts: resources.refreshPrompts,
    refreshRuns: resources.refreshRuns,
    refreshWorkflows: resources.refreshWorkflows,
    checkResearch: researchRefresh.checkResearch,
    checkSource: researchRefresh.checkSource,
    checkingAllResearch: researchRefresh.checkingAll,
    checkingSourceId: researchRefresh.checkingSourceId,
    researchCheckPending: researchRefresh.pending,
  }
}

export type GlobalExplorerSidebarModel = ReturnType<typeof useGlobalExplorerSidebar>
