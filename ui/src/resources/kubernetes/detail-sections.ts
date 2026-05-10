import type { DetailSection } from "@/components/resource-management"

type ResourceLike = {
  metadata?: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
    ownerReferences?: unknown
  }
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  data?: Record<string, string>
  binaryData?: Record<string, string>
  rules?: unknown
  roleRef?: unknown
  subjects?: unknown
  subsets?: unknown
  endpoints?: unknown
  ports?: unknown
  addressType?: unknown
  type?: unknown
  reason?: unknown
  message?: unknown
  involvedObject?: unknown
  count?: unknown
  firstTimestamp?: unknown
  lastTimestamp?: unknown
  eventTime?: unknown
  source?: unknown
  provisioner?: unknown
  reclaimPolicy?: unknown
  volumeBindingMode?: unknown
  allowVolumeExpansion?: unknown
  parameters?: unknown
  secrets?: unknown
  imagePullSecrets?: unknown
  automountServiceAccountToken?: unknown
  stringData?: unknown
  [key: string]: unknown
}

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const labels = (value: unknown) => Object.entries(record(value)).map(([key, next]) => `${key}=${String(next)}`)
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ""
const remainingFields = (value: Record<string, unknown>, known: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key, next]) => !known.includes(key) && hasValue(next)))

const cleanSections = (sections: DetailSection[]) => sections.map((section) => ({
  ...section,
  items: section.items.filter((item) => hasValue(item.value)),
})).filter((section) => section.items.length > 0)

export const kubernetesPodDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Pod Status",
      items: [
        { label: "Phase", value: status.phase },
        { label: "Reason", value: status.reason },
        { label: "Message", value: status.message, fullWidth: true },
        { label: "Pod IP", value: status.podIP },
        { label: "Pod IPs", value: status.podIPs, fullWidth: true },
        { label: "Host IP", value: status.hostIP },
        { label: "Node", value: spec.nodeName },
        { label: "QoS Class", value: status.qosClass },
        { label: "Start Time", value: status.startTime },
        { label: "Conditions", value: status.conditions, fullWidth: true },
      ],
    },
    {
      title: "Containers",
      items: [
        { label: "Spec", value: spec.containers, fullWidth: true },
        { label: "Init Containers", value: spec.initContainers, fullWidth: true },
        { label: "Container Statuses", value: status.containerStatuses, fullWidth: true },
        { label: "Init Container Statuses", value: status.initContainerStatuses, fullWidth: true },
      ],
    },
    {
      title: "Scheduling",
      items: [
        { label: "Service Account", value: spec.serviceAccountName },
        { label: "Restart Policy", value: spec.restartPolicy },
        { label: "Priority Class", value: spec.priorityClassName },
        { label: "Priority", value: spec.priority },
        { label: "Node Selector", value: spec.nodeSelector, fullWidth: true },
        { label: "Tolerations", value: spec.tolerations, fullWidth: true },
        { label: "Affinity", value: spec.affinity, fullWidth: true },
      ],
    },
    {
      title: "Storage And Network",
      items: [
        { label: "Volumes", value: spec.volumes, fullWidth: true },
        { label: "DNS Policy", value: spec.dnsPolicy },
        { label: "Host Network", value: spec.hostNetwork },
        { label: "Host PID", value: spec.hostPID },
        { label: "Host IPC", value: spec.hostIPC },
      ],
    },
  ])
}

const workloadSections = (resource: ResourceLike, title: string): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  const template = record(spec.template)
  const templateSpec = record(template.spec)
  return cleanSections([
    {
      title,
      items: [
        { label: "Replicas", value: spec.replicas },
        { label: "Selector", value: record(spec.selector).matchLabels || spec.selector, fullWidth: true },
        { label: "Strategy", value: spec.strategy || spec.updateStrategy, fullWidth: true },
        { label: "Min Ready Seconds", value: spec.minReadySeconds },
        { label: "Revision History Limit", value: spec.revisionHistoryLimit },
      ],
    },
    {
      title: "Status",
      items: [
        { label: "Observed Generation", value: status.observedGeneration },
        { label: "Replicas", value: status.replicas },
        { label: "Ready Replicas", value: status.readyReplicas },
        { label: "Available Replicas", value: status.availableReplicas },
        { label: "Updated Replicas", value: status.updatedReplicas },
        { label: "Current Replicas", value: status.currentReplicas },
        { label: "Unavailable Replicas", value: status.unavailableReplicas },
        { label: "Collision Count", value: status.collisionCount },
        { label: "Conditions", value: status.conditions, fullWidth: true },
      ],
    },
    {
      title: "Pod Template",
      items: [
        { label: "Labels", value: record(template.metadata).labels, fullWidth: true },
        { label: "Annotations", value: record(template.metadata).annotations, fullWidth: true },
        { label: "Service Account", value: templateSpec.serviceAccountName },
        { label: "Containers", value: templateSpec.containers, fullWidth: true },
        { label: "Init Containers", value: templateSpec.initContainers, fullWidth: true },
        { label: "Volumes", value: templateSpec.volumes, fullWidth: true },
      ],
    },
  ])
}

export const kubernetesDeploymentDetailSections = (resource: ResourceLike): DetailSection[] => workloadSections(resource, "Deployment")
export const kubernetesStatefulSetDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  return [
    ...workloadSections(resource, "StatefulSet"),
    ...cleanSections([{ title: "StatefulSet Storage", items: [
      { label: "Service Name", value: spec.serviceName },
      { label: "Pod Management Policy", value: spec.podManagementPolicy },
      { label: "Volume Claim Templates", value: spec.volumeClaimTemplates, fullWidth: true },
      { label: "Persistent Volume Claim Retention", value: spec.persistentVolumeClaimRetentionPolicy, fullWidth: true },
    ] }]),
  ]
}
export const kubernetesDaemonSetDetailSections = (resource: ResourceLike): DetailSection[] => workloadSections(resource, "DaemonSet")
export const kubernetesReplicaSetDetailSections = (resource: ResourceLike): DetailSection[] => workloadSections(resource, "ReplicaSet")

export const kubernetesJobDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Job",
      items: [
        { label: "Parallelism", value: spec.parallelism },
        { label: "Completions", value: spec.completions },
        { label: "Completion Mode", value: spec.completionMode },
        { label: "Backoff Limit", value: spec.backoffLimit },
        { label: "Active Deadline Seconds", value: spec.activeDeadlineSeconds },
        { label: "TTL Seconds After Finished", value: spec.ttlSecondsAfterFinished },
        { label: "Selector", value: spec.selector, fullWidth: true },
      ],
    },
    {
      title: "Status",
      items: [
        { label: "Active", value: status.active },
        { label: "Succeeded", value: status.succeeded },
        { label: "Failed", value: status.failed },
        { label: "Ready", value: status.ready },
        { label: "Start Time", value: status.startTime },
        { label: "Completion Time", value: status.completionTime },
        { label: "Conditions", value: status.conditions, fullWidth: true },
      ],
    },
  ])
}

export const kubernetesCronJobDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "CronJob",
      items: [
        { label: "Schedule", value: spec.schedule },
        { label: "Timezone", value: spec.timeZone },
        { label: "Suspend", value: spec.suspend },
        { label: "Concurrency Policy", value: spec.concurrencyPolicy },
        { label: "Starting Deadline Seconds", value: spec.startingDeadlineSeconds },
        { label: "Successful Jobs History Limit", value: spec.successfulJobsHistoryLimit },
        { label: "Failed Jobs History Limit", value: spec.failedJobsHistoryLimit },
        { label: "Job Template", value: spec.jobTemplate, fullWidth: true },
      ],
    },
    {
      title: "Status",
      items: [
        { label: "Last Schedule Time", value: status.lastScheduleTime },
        { label: "Last Successful Time", value: status.lastSuccessfulTime },
        { label: "Active Jobs", value: status.active, fullWidth: true },
      ],
    },
  ])
}

export const kubernetesConfigMapDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Config Data",
    items: [
      { label: "Data", value: resource.data, fullWidth: true },
      { label: "Binary Data", value: resource.binaryData, fullWidth: true },
    ],
  },
])

export const kubernetesSecretDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Secret",
    items: [
      { label: "Type", value: resource.type },
      { label: "Keys", value: Object.keys(resource.data || {}), fullWidth: true },
      { label: "String Data", value: resource.stringData, fullWidth: true },
    ],
  },
])

export const kubernetesNamespaceDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    { title: "Namespace", items: [{ label: "Phase", value: status.phase }, { label: "Finalizers", value: spec.finalizers, fullWidth: true }, { label: "Conditions", value: status.conditions, fullWidth: true }] },
  ])
}

export const kubernetesEventDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Event",
    items: [
      { label: "Type", value: resource.type },
      { label: "Reason", value: resource.reason },
      { label: "Message", value: resource.message, fullWidth: true },
      { label: "Count", value: resource.count },
      { label: "First Timestamp", value: resource.firstTimestamp },
      { label: "Last Timestamp", value: resource.lastTimestamp },
      { label: "Event Time", value: resource.eventTime },
      { label: "Involved Object", value: resource.involvedObject, fullWidth: true },
      { label: "Source", value: resource.source, fullWidth: true },
    ],
  },
])

export const kubernetesServiceAccountDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Service Account",
    items: [
      { label: "Secrets", value: resource.secrets, fullWidth: true },
      { label: "Image Pull Secrets", value: resource.imagePullSecrets, fullWidth: true },
      { label: "Automount Token", value: resource.automountServiceAccountToken },
    ],
  },
])

export const kubernetesRoleDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  { title: "RBAC Rules", items: [{ label: "Rules", value: resource.rules, fullWidth: true }] },
])

export const kubernetesRoleBindingDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  { title: "Binding", items: [{ label: "Role Ref", value: resource.roleRef, fullWidth: true }, { label: "Subjects", value: resource.subjects, fullWidth: true }] },
])

export const kubernetesPodDisruptionBudgetDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Disruption Budget",
      items: [
        { label: "Min Available", value: spec.minAvailable },
        { label: "Max Unavailable", value: spec.maxUnavailable },
        { label: "Selector", value: spec.selector, fullWidth: true },
        { label: "Unhealthy Pod Eviction Policy", value: spec.unhealthyPodEvictionPolicy },
      ],
    },
    {
      title: "Status",
      items: [
        { label: "Current Healthy", value: status.currentHealthy },
        { label: "Desired Healthy", value: status.desiredHealthy },
        { label: "Expected Pods", value: status.expectedPods },
        { label: "Disruptions Allowed", value: status.disruptionsAllowed },
        { label: "Disrupted Pods", value: status.disruptedPods, fullWidth: true },
        { label: "Conditions", value: status.conditions, fullWidth: true },
      ],
    },
  ])
}

export const kubernetesStorageClassDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Storage Class",
    items: [
      { label: "Provisioner", value: resource.provisioner },
      { label: "Reclaim Policy", value: resource.reclaimPolicy },
      { label: "Volume Binding Mode", value: resource.volumeBindingMode },
      { label: "Allow Volume Expansion", value: resource.allowVolumeExpansion },
      { label: "Parameters", value: resource.parameters, fullWidth: true },
      { label: "Allowed Topologies", value: resource.allowedTopologies, fullWidth: true },
      { label: "Mount Options", value: resource.mountOptions, fullWidth: true },
    ],
  },
])

export const kubernetesCustomResourceDefinitionDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Definition",
      items: [
        { label: "Group", value: spec.group },
        { label: "Scope", value: spec.scope },
        { label: "Names", value: spec.names, fullWidth: true },
        { label: "Versions", value: spec.versions, fullWidth: true },
        { label: "Conversion", value: spec.conversion, fullWidth: true },
      ],
    },
    { title: "Status", items: [{ label: "Stored Versions", value: status.storedVersions, fullWidth: true }, { label: "Accepted Names", value: status.acceptedNames, fullWidth: true }, { label: "Conditions", value: status.conditions, fullWidth: true }] },
  ])
}

export const kubernetesNetworkPolicyDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const known = ["podSelector", "policyTypes", "ingress", "egress"]
  return cleanSections([
    {
      title: "Policy Target",
      items: [
        { label: "Pod Selector", value: labels(record(spec.podSelector).matchLabels), fullWidth: true },
        { label: "Policy Types", value: spec.policyTypes, fullWidth: true },
      ],
    },
    {
      title: "Rules",
      items: [
        { label: "Ingress", value: spec.ingress, fullWidth: true },
        { label: "Egress", value: spec.egress, fullWidth: true },
      ],
    },
    { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
  ])
}

export const kubernetesIngressDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  const known = ["ingressClassName", "defaultBackend", "rules", "tls"]
  return cleanSections([
    {
      title: "Routing",
      items: [
        { label: "Class", value: spec.ingressClassName },
        { label: "Default Backend", value: spec.defaultBackend, fullWidth: true },
        { label: "Rules", value: spec.rules, fullWidth: true },
        { label: "TLS", value: spec.tls, fullWidth: true },
      ],
    },
    {
      title: "Load Balancer",
      items: [
        { label: "Ingress", value: record(status.loadBalancer).ingress, fullWidth: true },
      ],
    },
    { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
  ])
}

export const kubernetesServiceDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Service",
      items: [
        { label: "Type", value: spec.type },
        { label: "Cluster IP", value: spec.clusterIP },
        { label: "Cluster IPs", value: spec.clusterIPs, fullWidth: true },
        { label: "IP Families", value: spec.ipFamilies, fullWidth: true },
        { label: "Session Affinity", value: spec.sessionAffinity },
      ],
    },
    {
      title: "Traffic",
      items: [
        { label: "Selector", value: labels(spec.selector), fullWidth: true },
        { label: "Ports", value: spec.ports, fullWidth: true },
        { label: "External IPs", value: spec.externalIPs, fullWidth: true },
        { label: "Load Balancer Source Ranges", value: spec.loadBalancerSourceRanges, fullWidth: true },
      ],
    },
    {
      title: "Load Balancer",
      items: [
        { label: "Status", value: status.loadBalancer, fullWidth: true },
      ],
    },
  ])
}

export const kubernetesEndpointsDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Endpoints",
    items: [
      { label: "Subsets", value: resource.subsets, fullWidth: true },
    ],
  },
])

export const kubernetesEndpointSliceDetailSections = (resource: ResourceLike): DetailSection[] => cleanSections([
  {
    title: "Endpoint Slice",
    items: [
      { label: "Address Type", value: resource.addressType },
      { label: "Endpoints", value: resource.endpoints, fullWidth: true },
      { label: "Ports", value: resource.ports, fullWidth: true },
    ],
  },
])

export const kubernetesIngressClassDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  return cleanSections([
    {
      title: "Ingress Class",
      items: [
        { label: "Controller", value: spec.controller },
        { label: "Parameters", value: spec.parameters, fullWidth: true },
      ],
    },
  ])
}

export const gatewayClassDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  return cleanSections([
    {
      title: "Gateway Class",
      items: [
        { label: "Controller", value: spec.controllerName },
        { label: "Description", value: spec.description },
        { label: "Parameters", value: spec.parametersRef, fullWidth: true },
      ],
    },
    { title: "Status", items: [{ label: "Conditions", value: status.conditions, fullWidth: true }] },
  ])
}

export const gatewayDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  const known = ["gatewayClassName", "addresses", "listeners", "infrastructure", "backendTLS"]
  return cleanSections([
    {
      title: "Gateway",
      items: [
        { label: "Class", value: spec.gatewayClassName },
        { label: "Addresses", value: status.addresses || spec.addresses, fullWidth: true },
        { label: "Listeners", value: spec.listeners, fullWidth: true },
        { label: "Infrastructure", value: spec.infrastructure, fullWidth: true },
        { label: "Backend TLS", value: spec.backendTLS, fullWidth: true },
      ],
    },
    { title: "Status", items: [{ label: "Conditions", value: status.conditions, fullWidth: true }, { label: "Listeners", value: status.listeners, fullWidth: true }] },
    { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
  ])
}

export const httpRouteDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  const known = ["parentRefs", "hostnames", "rules"]
  return cleanSections([
    {
      title: "Route",
      items: [
        { label: "Parents", value: spec.parentRefs, fullWidth: true },
        { label: "Hostnames", value: spec.hostnames, fullWidth: true },
        { label: "Rules", value: spec.rules, fullWidth: true },
      ],
    },
    { title: "Status", items: [{ label: "Parents", value: status.parents, fullWidth: true }] },
    { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
  ])
}

export const networkAttachmentDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  let config: unknown = spec.config
  try {
    config = typeof config === "string" ? JSON.parse(config) : config
  } catch {
    config = spec.config
  }
  return cleanSections([
    {
      title: "Network Attachment",
      items: [
        { label: "CNI Config", value: config, fullWidth: true },
      ],
    },
  ])
}
