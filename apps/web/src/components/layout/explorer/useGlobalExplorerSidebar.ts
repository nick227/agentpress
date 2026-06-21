import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { groupResearchSources, researchCategoryLabel } from './researchCategories'
import { useExplorerResources } from './useExplorerResources'
import { useResearchRefresh } from './useResearchRefresh'

export function useGlobalExplorerSidebar() {
  const { pathname } = useLocation()

  // Local navigation state.
  const [query, setQuery] = useState('')
  const [collapsedResearchCategories, setCollapsedResearchCategories] = useState<Set<string>>(() => new Set())

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
  const visibleRuns = useMemo(
    () => needle
      ? resources.runs.filter((run) => (run.pipelineName + ' ' + (run.title ?? '')).toLowerCase().includes(needle))
      : resources.runs,
    [resources.runs, needle],
  )
  const researchGroups = useMemo(() => groupResearchSources(visibleSources), [visibleSources])

  // Category interaction.
  function toggleResearchCategory(category: string) {
    setCollapsedResearchCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return {
    pathname,
    query,
    setQuery,
    needle,
    pipelines: visiblePipelines,
    schedules: visibleSchedules,
    destinations: visibleDestinations,
    runs: visibleRuns,
    researchGroups: researchGroups.map((group) => ({
      ...group,
      collapsed: !needle && collapsedResearchCategories.has(group.category),
      isRefetching: researchRefresh.checkingCategory === group.category,
    })),
    hasResults: visiblePipelines.length > 0
      || visibleSchedules.length > 0
      || visibleSources.length > 0
      || visibleDestinations.length > 0
      || visibleRuns.length > 0,
    pipelinesFetching: resources.pipelinesFetching,
    schedulesFetching: resources.schedulesFetching,
    destinationsFetching: resources.destinationsFetching,
    runsFetching: resources.runsFetching,
    refreshPipelines: resources.refreshPipelines,
    refreshSchedules: resources.refreshSchedules,
    refreshDestinations: resources.refreshDestinations,
    refreshRuns: resources.refreshRuns,
    toggleResearchCategory,
    checkResearch: researchRefresh.checkResearch,
    checkSource: researchRefresh.checkSource,
    checkingAllResearch: researchRefresh.checkingAll,
    checkingSourceId: researchRefresh.checkingSourceId,
    researchCheckPending: researchRefresh.pending,
  }
}

export type GlobalExplorerSidebarModel = ReturnType<typeof useGlobalExplorerSidebar>
