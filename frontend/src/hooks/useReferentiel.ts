import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { referentielApi, MachineUpdate } from '../api/referentiel'

export const QUERY_KEYS = {
  sitesTree: ['sites', 'tree'] as const,
  allMachines: ['machines', 'all'] as const,
}

export function useSitesTree() {
  return useQuery({
    queryKey: QUERY_KEYS.sitesTree,
    queryFn: referentielApi.getSitesTree,
    staleTime: 30_000,
  })
}

export function useAllMachines() {
  return useQuery({
    queryKey: QUERY_KEYS.allMachines,
    queryFn: referentielApi.getAllMachines,
    staleTime: 15_000,
  })
}

export function useUpdateMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MachineUpdate }) =>
      referentielApi.updateMachine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sitesTree })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.allMachines })
    },
  })
}

// ── Events hooks ───────────────────────────────────────────────────────────────
import { eventsApi, EventCreate, PlannedCreate } from '../api/events'

export function useTimeline(machineId: string | null, days = 14) {
  return useQuery({
    queryKey: ['timeline', machineId, days],
    queryFn: () => eventsApi.getTimeline(machineId!, days),
    enabled: !!machineId,
    staleTime: 10_000,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ machineId, payload }: { machineId: string; payload: EventCreate }) =>
      eventsApi.createEvent(machineId, payload),
    onSuccess: (_, { machineId }) => {
      qc.invalidateQueries({ queryKey: ['timeline', machineId] })
    },
  })
}

export function useCreatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ machineId, payload }: { machineId: string; payload: PlannedCreate }) =>
      eventsApi.createPlanned(machineId, payload),
    onSuccess: (_, { machineId }) => {
      qc.invalidateQueries({ queryKey: ['timeline', machineId] })
    },
  })
}
