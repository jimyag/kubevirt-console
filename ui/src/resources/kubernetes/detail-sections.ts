import type { DetailSection } from "@/components/resource-management"

type ResourceLike = {
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  subsets?: unknown
  endpoints?: unknown
  ports?: unknown
  addressType?: unknown
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
