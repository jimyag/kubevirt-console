import type { DetailSection } from "@/components/resource-management"

type ResourceLike = {
  kind?: string
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ""
const labels = (value: unknown) => Object.entries(record(value)).map(([key, next]) => `${key}=${String(next)}`)
const remainingFields = (value: Record<string, unknown>, known: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key, next]) => !known.includes(key) && hasValue(next)))

const cleanSections = (sections: DetailSection[]) => sections.map((section) => ({
  ...section,
  items: section.items.filter((item) => hasValue(item.value)),
})).filter((section) => section.items.length > 0)

export const calicoDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)

  switch (resource.kind) {
    case "NetworkPolicy":
    case "GlobalNetworkPolicy":
    case "StagedNetworkPolicy":
    case "StagedGlobalNetworkPolicy":
      {
      const known = ["tier", "order", "selector", "namespaceSelector", "serviceAccountSelector", "types", "ingress", "egress", "doNotTrack", "preDNAT", "applyOnForward", "performanceHints"]
      return cleanSections([
        {
          title: "Policy Target",
          items: [
            { label: "Tier", value: spec.tier },
            { label: "Order", value: spec.order },
            { label: "Selector", value: spec.selector },
            { label: "Namespace Selector", value: spec.namespaceSelector },
            { label: "Service Account Selector", value: spec.serviceAccountSelector },
            { label: "Types", value: spec.types, fullWidth: true },
          ],
        },
        {
          title: "Traffic Behavior",
          items: [
            { label: "Do Not Track", value: spec.doNotTrack },
            { label: "Pre DNAT", value: spec.preDNAT },
            { label: "Apply On Forward", value: spec.applyOnForward },
            { label: "Performance Hints", value: spec.performanceHints, fullWidth: true },
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
    case "StagedKubernetesNetworkPolicy":
      {
      const known = ["podSelector", "policyTypes", "ingress", "egress"]
      return cleanSections([
        {
          title: "Kubernetes Policy",
          items: [
            { label: "Pod Selector", value: labels(record(spec.podSelector).matchLabels), fullWidth: true },
            { label: "Policy Types", value: spec.policyTypes, fullWidth: true },
            { label: "Ingress", value: spec.ingress, fullWidth: true },
            { label: "Egress", value: spec.egress, fullWidth: true },
          ],
        },
        { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
      ])
      }
    case "IPPool":
      return cleanSections([
        {
          title: "Pool",
          items: [
            { label: "CIDR", value: spec.cidr },
            { label: "Encapsulation", value: spec.encapsulation },
            { label: "NAT Outgoing", value: spec.natOutgoing },
            { label: "Disabled", value: spec.disabled },
            { label: "Allowed Uses", value: spec.allowedUses, fullWidth: true },
            { label: "Node Selector", value: spec.nodeSelector },
            { label: "Block Size", value: spec.blockSize },
          ],
        },
      ])
    case "NetworkSet":
    case "GlobalNetworkSet":
      return cleanSections([{ title: "Network Set", items: [{ label: "Networks", value: spec.nets, fullWidth: true }, { label: "Labels", value: labels(resource.metadata && record(resource.metadata).labels), fullWidth: true }] }])
    case "HostEndpoint":
      return cleanSections([{ title: "Host Endpoint", items: [{ label: "Node", value: spec.node }, { label: "Interface", value: spec.interfaceName }, { label: "Expected IPs", value: spec.expectedIPs, fullWidth: true }, { label: "Ports", value: spec.ports, fullWidth: true }, { label: "Profiles", value: spec.profiles, fullWidth: true }] }])
    case "BGPPeer":
      return cleanSections([{ title: "BGP Peer", items: [{ label: "Peer IP", value: spec.peerIP }, { label: "Peer Selector", value: spec.peerSelector }, { label: "AS Number", value: spec.asNumber }, { label: "Node", value: spec.node }, { label: "Node Selector", value: spec.nodeSelector }, { label: "Filters", value: spec.filters, fullWidth: true }] }])
    case "BGPConfiguration":
      return cleanSections([{ title: "BGP Configuration", items: [{ label: "AS Number", value: spec.asNumber }, { label: "Node To Node Mesh", value: spec.nodeToNodeMeshEnabled }, { label: "Service Cluster IPs", value: spec.serviceClusterIPs, fullWidth: true }, { label: "Service External IPs", value: spec.serviceExternalIPs, fullWidth: true }, { label: "Prefix Advertisements", value: spec.prefixAdvertisements, fullWidth: true }] }])
    case "BGPFilter":
      return cleanSections([{ title: "BGP Filter", items: [{ label: "Import V4", value: spec.importV4, fullWidth: true }, { label: "Export V4", value: spec.exportV4, fullWidth: true }, { label: "Import V6", value: spec.importV6, fullWidth: true }, { label: "Export V6", value: spec.exportV6, fullWidth: true }] }])
    case "Tier":
      return cleanSections([{ title: "Tier", items: [{ label: "Order", value: spec.order }, { label: "Default Action", value: spec.defaultAction }] }])
    case "FelixConfiguration":
    case "KubeControllersConfiguration":
      return cleanSections([{ title: "Configuration", items: Object.entries(spec).map(([label, value]) => ({ label, value, fullWidth: typeof value === "object" })) }])
    case "BlockAffinity":
      return cleanSections([{ title: "Block Affinity", items: [{ label: "CIDR", value: spec.cidr }, { label: "Node", value: spec.node }, { label: "State", value: spec.state }] }])
    case "IPAMBlock":
      return cleanSections([{ title: "IPAM Block", items: [{ label: "CIDR", value: spec.cidr }, { label: "Affinity", value: spec.affinity }, { label: "Strict Affinity", value: spec.strictAffinity }, { label: "Allocations", value: spec.allocations, fullWidth: true }, { label: "Attributes", value: spec.attributes, fullWidth: true }] }])
    case "IPReservation":
      return cleanSections([{ title: "IP Reservation", items: [{ label: "Reserved CIDRs", value: spec.reservedCIDRs, fullWidth: true }] }])
    case "CalicoNodeStatus":
      return cleanSections([{ title: "Node Status", items: [{ label: "Classes", value: spec.classes, fullWidth: true }, { label: "Node", value: spec.node }, { label: "Agent", value: status.agent, fullWidth: true }, { label: "Routes", value: status.routes, fullWidth: true }] }])
    case "ClusterInformation":
      return cleanSections([{ title: "Cluster Information", items: [{ label: "Calico Version", value: spec.calicoVersion }, { label: "Cluster GUID", value: spec.clusterGUID }, { label: "Datastore Ready", value: spec.datastoreReady }] }])
    default:
      return cleanSections([
        { title: "Spec", items: Object.entries(spec).map(([label, value]) => ({ label, value, fullWidth: typeof value === "object" })) },
        { title: "Status", items: Object.entries(status).map(([label, value]) => ({ label, value, fullWidth: typeof value === "object" })) },
      ])
  }
}
