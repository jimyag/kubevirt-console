import type { DetailSection } from "@/components/resource-management"

type ResourceLike = {
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const list = (value: unknown) => Array.isArray(value) ? value : []
const text = (value: unknown) => value === undefined || value === null || value === "" ? undefined : String(value)
const labels = (value: unknown) => Object.entries(record(value)).map(([key, next]) => `${key}=${String(next)}`)
const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0
  if (record(value) === value) return Object.keys(value).length > 0
  return value !== undefined && value !== null && value !== ""
}
const compactRecord = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, next]) => hasValue(next)))
const remainingFields = (value: Record<string, unknown>, known: string[]) =>
  compactRecord(Object.fromEntries(Object.entries(value).filter(([key]) => !known.includes(key))))

const firstText = (...values: unknown[]) => values.map(text).find(Boolean)

export const ciliumEndpointDetailSections = (resource: ResourceLike): DetailSection[] => {
  const status = record(resource.status)
  const identity = record(status.identity)
  const networking = record(status.networking)
  const addressing = list(networking.addressing).map((item) => {
    const next = record(item)
    return {
      ipv4: text(next.ipv4),
      ipv6: text(next.ipv6),
    }
  })
  const externalIdentifiers = record(status["external-identifiers"])
  const controllers = list(status.controllers).map((item) => {
    const next = record(item)
    return {
      name: text(next.name),
      status: text(next.status),
      "last-success": text(next["last-success"]),
      "consecutive-failure-count": text(next["consecutive-failure-count"]),
    }
  })
  const namedPorts = list(status["named-ports"]).map((item) => {
    const next = record(item)
    return {
      name: text(next.name),
      port: text(next.port),
      protocol: text(next.protocol),
    }
  })

  return [
    {
      title: "Endpoint",
      items: [
        { label: "State", value: status.state },
        { label: "Endpoint ID", value: status.id },
        { label: "Service Account", value: status["service-account"] },
        { label: "Node", value: networking.node },
        { label: "Encryption", value: status.encryption },
      ],
    },
    {
      title: "Addressing",
      items: [
        { label: "Addresses", value: addressing, fullWidth: true },
        { label: "Named Ports", value: namedPorts, fullWidth: true },
      ],
    },
    {
      title: "Identity",
      items: [
        { label: "ID", value: identity.id },
        { label: "Labels", value: labels(identity.labels), fullWidth: true },
      ],
    },
    {
      title: "Kubernetes Binding",
      items: [
        { label: "Namespace", value: firstText(externalIdentifiers["k8s-namespace"], externalIdentifiers.namespace) },
        { label: "Pod Name", value: firstText(externalIdentifiers["k8s-pod-name"], externalIdentifiers["pod-name"]) },
        { label: "Container ID", value: externalIdentifiers["container-id"] },
        { label: "CNI Attachment ID", value: externalIdentifiers["cni-attachment-id"] },
      ],
    },
    {
      title: "Controllers",
      items: [
        { label: "Controllers", value: controllers, fullWidth: true },
      ],
    },
  ].filter((section) => section.items.some((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0
    return item.value !== undefined && item.value !== null && item.value !== ""
  }))
}

const ciliumRuleItems = (rules: unknown) => list(rules).map((item) => {
  const rule = record(item)
  const known = [
    "description",
    "fromEndpoints",
    "fromRequires",
    "fromCIDR",
    "fromCIDRSet",
    "fromEntities",
    "fromNodes",
    "fromGroups",
    "toEndpoints",
    "toRequires",
    "toCIDR",
    "toCIDRSet",
    "toEntities",
    "toFQDNs",
    "toGroups",
    "toServices",
    "toPorts",
    "toNodes",
    "icmps",
    "authentication",
  ]
  const next = compactRecord({
    description: rule.description,
    "from-endpoints": rule.fromEndpoints,
    "from-requires": rule.fromRequires,
    "from-cidr": rule.fromCIDR,
    "from-cidr-set": rule.fromCIDRSet,
    "from-entities": rule.fromEntities,
    "from-nodes": rule.fromNodes,
    "from-groups": rule.fromGroups,
    "to-endpoints": rule.toEndpoints,
    "to-requires": rule.toRequires,
    "to-cidr": rule.toCIDR,
    "to-cidr-set": rule.toCIDRSet,
    "to-entities": rule.toEntities,
    "to-fqdns": rule.toFQDNs,
    "to-groups": rule.toGroups,
    "to-services": rule.toServices,
    "to-ports": rule.toPorts,
    "to-nodes": rule.toNodes,
    "icmp": rule.icmps,
    auth: rule.authentication,
    other: remainingFields(rule, known),
  })
  return Object.keys(next).length > 0 ? next : { rule: "All traffic" }
})

export const ciliumPolicyDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)
  const knownSpec = ["endpointSelector", "nodeSelector", "description", "ingress", "egress", "ingressDeny", "egressDeny", "labels", "enableDefaultDeny"]
  return [
    {
      title: "Policy Selector",
      items: [
        { label: "Endpoint Selector", value: spec.endpointSelector, fullWidth: true },
        { label: "Node Selector", value: spec.nodeSelector, fullWidth: true },
        { label: "Description", value: spec.description },
        { label: "Labels", value: spec.labels, fullWidth: true },
        { label: "Enable Default Deny", value: spec.enableDefaultDeny, fullWidth: true },
      ],
    },
    {
      title: "Traffic Rules",
      items: [
        { label: "Ingress", value: ciliumRuleItems(spec.ingress), fullWidth: true },
        { label: "Egress", value: ciliumRuleItems(spec.egress), fullWidth: true },
        { label: "Ingress Deny", value: ciliumRuleItems(spec.ingressDeny), fullWidth: true },
        { label: "Egress Deny", value: ciliumRuleItems(spec.egressDeny), fullWidth: true },
      ],
    },
    {
      title: "Additional Spec",
      items: [
        { label: "Fields", value: remainingFields(spec, knownSpec), fullWidth: true },
      ],
    },
    {
      title: "Status",
      items: [
        { label: "Conditions", value: status.conditions, fullWidth: true },
        { label: "Nodes", value: status.nodes, fullWidth: true },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (Array.isArray(item.value)) return item.value.length > 0
      return item.value !== undefined && item.value !== null && item.value !== ""
    }),
  })).filter((section) => section.items.length > 0)
}
