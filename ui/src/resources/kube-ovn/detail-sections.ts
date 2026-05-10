import type { DetailSection } from "@/components/resource-management"

type ResourceLike = {
  kind?: string
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ""
const remainingFields = (value: Record<string, unknown>, known: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key, next]) => !known.includes(key) && hasValue(next)))

const cleanSections = (sections: DetailSection[]) => sections.map((section) => ({
  ...section,
  items: section.items.filter((item) => hasValue(item.value)),
})).filter((section) => section.items.length > 0)

const specItems = (spec: Record<string, unknown>) =>
  Object.entries(spec).map(([label, value]) => ({ label, value, fullWidth: typeof value === "object" }))

const statusSection = (status: Record<string, unknown>): DetailSection => ({
  title: "Status",
  items: Object.entries(status).map(([label, value]) => ({ label, value, fullWidth: typeof value === "object" })),
})

export const kubeOvnDetailSections = (resource: ResourceLike): DetailSection[] => {
  const spec = record(resource.spec)
  const status = record(resource.status)

  switch (resource.kind) {
    case "Subnet":
      {
      const known = ["cidrBlock", "gateway", "protocol", "vpc", "provider", "vlan", "natOutgoing", "excludeIps", "namespaces", "private", "allowSubnets", "gatewayType", "disableGatewayCheck", "disableInterConnection", "logicalGateway", "u2oInterconnection", "vpcNatGateway", "enableLb", "enableEcmp", "routeTable", "securityGroups", "dhcpV4Options", "dhcpV6Options"]
      return cleanSections([
        { title: "Subnet", items: [{ label: "CIDR", value: spec.cidrBlock }, { label: "Gateway", value: spec.gateway }, { label: "Gateway Type", value: spec.gatewayType }, { label: "Protocol", value: spec.protocol }, { label: "VPC", value: spec.vpc }, { label: "Provider", value: spec.provider }, { label: "VLAN", value: spec.vlan }, { label: "NAT Outgoing", value: spec.natOutgoing }] },
        { title: "Address Management", items: [{ label: "Exclude IPs", value: spec.excludeIps, fullWidth: true }, { label: "Namespaces", value: spec.namespaces, fullWidth: true }, { label: "Private", value: spec.private }, { label: "Allow Subnets", value: spec.allowSubnets, fullWidth: true }, { label: "DHCP v4 Options", value: spec.dhcpV4Options, fullWidth: true }, { label: "DHCP v6 Options", value: spec.dhcpV6Options, fullWidth: true }] },
        { title: "Advanced Networking", items: [{ label: "Disable Gateway Check", value: spec.disableGatewayCheck }, { label: "Disable Interconnection", value: spec.disableInterConnection }, { label: "Logical Gateway", value: spec.logicalGateway }, { label: "U2O Interconnection", value: spec.u2oInterconnection }, { label: "VPC NAT Gateway", value: spec.vpcNatGateway }, { label: "Enable LB", value: spec.enableLb }, { label: "Enable ECMP", value: spec.enableEcmp }, { label: "Route Table", value: spec.routeTable }, { label: "Security Groups", value: spec.securityGroups, fullWidth: true }] },
        { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
        statusSection(status),
      ])
      }
    case "Vpc":
      {
      const known = ["namespaces", "default", "enableBfd", "staticRoutes", "policyRoutes", "vpcPeerings", "extraExternalSubnets", "enableExternal", "routeTables"]
      return cleanSections([
        { title: "VPC", items: [{ label: "Namespaces", value: spec.namespaces, fullWidth: true }, { label: "Default", value: spec.default }, { label: "Enable BFD", value: spec.enableBfd }, { label: "Enable External", value: spec.enableExternal }, { label: "Extra External Subnets", value: spec.extraExternalSubnets, fullWidth: true }] },
        { title: "Routing", items: [{ label: "Static Routes", value: spec.staticRoutes, fullWidth: true }, { label: "Policy Routes", value: spec.policyRoutes, fullWidth: true }, { label: "VPC Peerings", value: spec.vpcPeerings, fullWidth: true }, { label: "Route Tables", value: spec.routeTables, fullWidth: true }] },
        { title: "Additional Spec", items: [{ label: "Fields", value: remainingFields(spec, known), fullWidth: true }] },
        statusSection(status),
      ])
      }
    case "ProviderNetwork":
      return cleanSections([{ title: "Provider Network", items: [{ label: "Default Interface", value: spec.defaultInterface }, { label: "Custom Interfaces", value: spec.customInterfaces, fullWidth: true }, { label: "Exclude Nodes", value: spec.excludeNodes, fullWidth: true }] }, statusSection(status)])
    case "Vlan":
      return cleanSections([{ title: "VLAN", items: [{ label: "ID", value: spec.id }, { label: "Provider", value: spec.provider }] }, statusSection(status)])
    case "IPPool":
      return cleanSections([{ title: "IP Pool", items: [{ label: "Subnet", value: spec.subnet }, { label: "IPs", value: spec.ips, fullWidth: true }] }, statusSection(status)])
    case "IP":
      return cleanSections([{ title: "IP Allocation", items: [{ label: "Subnet", value: spec.subnet }, { label: "Namespace", value: spec.namespace }, { label: "Pod", value: spec.podName }, { label: "Node", value: spec.nodeName }, { label: "IPv4", value: spec.v4IPAddress || spec.ipAddress }, { label: "IPv6", value: spec.v6IPAddress }, { label: "MAC", value: spec.macAddress }, { label: "Attach Subnets", value: spec.attachSubnets, fullWidth: true }] }, statusSection(status)])
    case "VpcNatGateway":
    case "VpcEgressGateway":
    case "VpcDns":
      return cleanSections([{ title: "Gateway", items: [{ label: "VPC", value: spec.vpc }, { label: "Subnet", value: spec.subnet || spec.internalSubnet }, { label: "External Subnet", value: spec.externalSubnet }, { label: "External Subnets", value: spec.externalSubnets, fullWidth: true }, { label: "LAN IP", value: spec.lanIp }, { label: "Replicas", value: spec.replicas }, { label: "Namespace", value: spec.namespace }] }, statusSection(status)])
    case "IptablesEIP":
    case "OvnEip":
      return cleanSections([{ title: "EIP", items: [{ label: "NAT Gateway", value: spec.natGwDp }, { label: "External Subnet", value: spec.externalSubnet }, { label: "IPv4", value: spec.v4ip }, { label: "IPv6", value: spec.v6ip }, { label: "MAC", value: spec.macAddress }, { label: "QoS Policy", value: spec.qosPolicy }, { label: "Type", value: spec.type }] }, statusSection(status)])
    case "IptablesDnatRule":
    case "OvnDnatRule":
      return cleanSections([{ title: "DNAT", items: [{ label: "EIP", value: spec.eip }, { label: "External Port", value: spec.externalPort }, { label: "Internal IP", value: spec.internalIp }, { label: "Internal Port", value: spec.internalPort }, { label: "Protocol", value: spec.protocol }] }, statusSection(status)])
    case "IptablesSnatRule":
    case "OvnSnatRule":
      return cleanSections([{ title: "SNAT", items: [{ label: "EIP", value: spec.eip }, { label: "Internal CIDR", value: spec.internalCIDR }, { label: "VPC Subnet", value: spec.vpcSubnet }] }, statusSection(status)])
    case "IptablesFIPRule":
    case "OvnFip":
      return cleanSections([{ title: "Floating IP", items: [{ label: "EIP", value: spec.eip || spec.ovnEip }, { label: "Internal IP", value: spec.internalIp }, { label: "IP Name", value: spec.ipName }, { label: "Type", value: spec.type }] }, statusSection(status)])
    case "Vip":
      return cleanSections([{ title: "VIP", items: [{ label: "Subnet", value: spec.subnet }, { label: "IPv4", value: spec.v4ip }, { label: "IPv6", value: spec.v6ip }, { label: "MAC", value: spec.macAddress }, { label: "Attach Subnets", value: spec.attachSubnets, fullWidth: true }] }, statusSection(status)])
    case "SwitchLBRule":
      return cleanSections([{ title: "Load Balancer Rule", items: [{ label: "VIP", value: spec.vip }, { label: "Ports", value: spec.ports, fullWidth: true }, { label: "Session Affinity", value: spec.sessionAffinity }, { label: "Namespace", value: spec.namespace }, { label: "Selector", value: spec.selector, fullWidth: true }] }, statusSection(status)])
    case "QoSPolicy":
      return cleanSections([{ title: "QoS Policy", items: [{ label: "Bandwidth Limit Rules", value: spec.bandwidthLimitRules, fullWidth: true }, { label: "Shared", value: spec.shared }, { label: "Binding Type", value: spec.bindingType }] }, statusSection(status)])
    case "SecurityGroup":
      return cleanSections([{ title: "Security Group", items: [{ label: "Allow Same Group Traffic", value: spec.allowSameGroupTraffic }, { label: "Ingress Rules", value: spec.ingressRules, fullWidth: true }, { label: "Egress Rules", value: spec.egressRules, fullWidth: true }] }, statusSection(status)])
    case "DNSNameResolver":
      return cleanSections([{ title: "DNS Resolver", items: [{ label: "Names", value: spec.names, fullWidth: true }] }, statusSection(status)])
    default:
      return cleanSections([{ title: "Spec", items: specItems(spec) }, statusSection(status)])
  }
}
